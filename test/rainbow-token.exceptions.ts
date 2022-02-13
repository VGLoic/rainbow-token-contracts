import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { RainbowToken } from "../typechain";

describe("Rainbow Token - Exceptions Test", function () {
  describe("initialization", () => {
    const invalidTargetColors: [number, number, number][] = [
      [5, 0, 0],
      [250, 0, 0],
      [0, 5, 0],
      [0, 250, 0],
      [0, 0, 5],
      [0, 0, 250],
    ];
    for (const invalidTargetColor of invalidTargetColors) {
      it(`Should revert if the target color is not correct, target color: ${invalidTargetColor}`, async function () {
        const RainbowToken = await ethers.getContractFactory("RainbowToken");
        const revertReason = `InvalidTargetColor(${invalidTargetColor[0]}, ${invalidTargetColor[1]}, ${invalidTargetColor[2]})`;
        await expect(
          RainbowToken.deploy(...invalidTargetColor)
        ).to.be.revertedWith(revertReason);
      });
    }
  });

  describe("when the contract is successfully deployed", () => {
    let player0Signer: SignerWithAddress;
    let player1Signer: SignerWithAddress;
    let rainbowToken: RainbowToken;

    const TARGET_COLOR: [number, number, number] = [125, 125, 125];
    const ENTRY_FEE = ethers.utils.parseUnits("0.1", "ether");
    const SELF_BLEND_PRICE = ethers.utils.parseUnits("0.5", "ether");

    before(async () => {
      [, player0Signer, player1Signer] = await ethers.getSigners();
    });

    beforeEach(async () => {
      const RainbowToken = await ethers.getContractFactory("RainbowToken");
      rainbowToken = await RainbowToken.deploy(...TARGET_COLOR);
      await rainbowToken.deployed();
    });

    describe("joining game", () => {
      it("An account is not able to join the game if it is already a player", async () => {
        await rainbowToken
          .connect(player0Signer)
          .joinGame({ value: ENTRY_FEE });

        await expect(
          rainbowToken.connect(player0Signer).joinGame({ value: ENTRY_FEE })
        ).to.be.revertedWith(`SenderAlreadyPlayer("${player0Signer.address}")`);
      });

      it("An account is not able to join the game if not enough value is sent", async () => {
        const insufficientValue = ethers.utils.parseUnits("0.09", "ether");
        await expect(
          rainbowToken
            .connect(player0Signer)
            .joinGame({ value: insufficientValue })
        ).to.be.revertedWith(
          `InsufficientValue(${insufficientValue.toString()})`
        );
      });
    });

    describe("update blending price", () => {
      it("An account is not able to update its blending price if not player", async () => {
        await expect(
          rainbowToken
            .connect(player0Signer)
            .updateBlendingPrice(ethers.utils.parseUnits("1.0", "ether"))
        ).to.be.revertedWith(`SenderNotAPlayer("${player0Signer.address}")`);
      });
      it("A player account is not able to update its blending price to 0", async () => {
        await rainbowToken
          .connect(player0Signer)
          .joinGame({ value: ENTRY_FEE });
        await expect(
          rainbowToken.connect(player0Signer).updateBlendingPrice(0)
        ).to.be.revertedWith(`InvalidZeroBlendingPrice()`);
      });
    });

    describe("self blend", () => {
      it("An account is not able to self blending if not player", async () => {
        await expect(
          rainbowToken
            .connect(player0Signer)
            .selfBlend({ value: SELF_BLEND_PRICE })
        ).to.be.revertedWith(`SenderNotAPlayer("${player0Signer.address}")`);
      });

      it("A player account is not able to self blend if not enough value is sent", async () => {
        await rainbowToken
          .connect(player0Signer)
          .joinGame({ value: ENTRY_FEE });
        const insufficientValue = ethers.utils.parseUnits("0.49", "ether");
        await expect(
          rainbowToken
            .connect(player0Signer)
            .selfBlend({ value: insufficientValue })
        ).to.be.revertedWith(
          `InsufficientValue(${insufficientValue.toString()})`
        );
      });
    });

    describe("blend", () => {
      it("An account is not able to blend if not a player", async () => {
        await rainbowToken
          .connect(player1Signer)
          .joinGame({ value: ENTRY_FEE });
        const player1 = await rainbowToken.getPlayer(player1Signer.address);

        await expect(
          rainbowToken
            .connect(player0Signer)
            .blend(player1Signer.address, player1.color, {
              value: player1.blendingPrice,
            })
        ).to.be.revertedWith(`SenderNotAPlayer("${player0Signer.address}")`);
      });

      it("A player account is not able to blend if the blending account is not player", async () => {
        await rainbowToken
          .connect(player0Signer)
          .joinGame({ value: ENTRY_FEE });
        const player1 = await rainbowToken.getPlayer(player1Signer.address);

        await expect(
          rainbowToken
            .connect(player0Signer)
            .blend(player1Signer.address, player1.color, {
              value: player1.blendingPrice,
            })
        ).to.be.revertedWith(
          `BlendingAccountNotAPlayer("${player1Signer.address}")`
        );
      });

      it("A player account is not able to blend if not enough value is sent", async () => {
        await rainbowToken
          .connect(player0Signer)
          .joinGame({ value: ENTRY_FEE });
        await rainbowToken
          .connect(player1Signer)
          .joinGame({ value: ENTRY_FEE });
        const player1 = await rainbowToken.getPlayer(player1Signer.address);

        const insufficientValue = player1.blendingPrice.sub(
          ethers.utils.parseUnits("0.01", "ether")
        );
        await expect(
          rainbowToken
            .connect(player0Signer)
            .blend(player1Signer.address, player1.color, {
              value: insufficientValue,
            })
        ).to.be.revertedWith(
          `InsufficientValue(${insufficientValue.toString()})`
        );
      });

      for (let index = 0; index < 3; index++) {
        it(`A player account is not able to blend if the specified blending color is different than the actual one. Difference in ${
          index === 0 ? "r" : index === 1 ? "g" : "b"
        } component`, async () => {
          await rainbowToken
            .connect(player0Signer)
            .joinGame({ value: ENTRY_FEE });
          await rainbowToken
            .connect(player1Signer)
            .joinGame({ value: ENTRY_FEE });
          const player1 = await rainbowToken.getPlayer(player1Signer.address);
          const incorrectBlendingColor = { ...player1.color };
          if (index === 0) {
            incorrectBlendingColor.r = Math.floor(player1.color.r / 2) + 1;
          } else if (index === 1) {
            incorrectBlendingColor.g = Math.floor(player1.color.g / 2) + 1;
          } else {
            incorrectBlendingColor.b = Math.floor(player1.color.b / 2) + 1;
          }
          incorrectBlendingColor[index] =
            Math.floor(player1.color[index] / 2) + 1;
          const displayColor = (color: [number, number, number]) =>
            `[${color[0]}, ${color[1]}, ${color[2]}]`;
          const revertReason = `ColorNotMatching(${displayColor(
            incorrectBlendingColor
          )}, ${displayColor(player1.color)})`;
          await expect(
            rainbowToken
              .connect(player0Signer)
              .blend(player1Signer.address, incorrectBlendingColor, {
                value: player1.blendingPrice,
              })
          ).to.be.revertedWith(revertReason);
        });
      }
    });

    describe("claim victory", () => {
      it("An account is not able to claim victory if not a player", async () => {
        await expect(
          rainbowToken.connect(player0Signer).claimVictory()
        ).to.be.revertedWith(`SenderNotAPlayer("${player0Signer.address}")`);
      });

      it("A player account is not able to claim victory if its color is not close enough to the target one", async () => {
        await rainbowToken
          .connect(player0Signer)
          .joinGame({ value: ENTRY_FEE });
        await expect(
          rainbowToken.connect(player0Signer).claimVictory()
        ).to.be.revertedWith(`PlayerNotWinner("${player0Signer.address}")`);
      });
    });
  });
});
