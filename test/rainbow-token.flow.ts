import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractReceipt } from "ethers";
import { ethers } from "hardhat";
import { RainbowToken } from "../typechain";

type Color = {
  r: number;
  g: number;
  b: number;
};

function areColorEquals(colorA: Color, colorB: Color) {
  return (
    colorA.r === colorB.r && colorA.g === colorB.g && colorA.b === colorB.b
  );
}

function isOriginalColorValid(color: Color) {
  return [color.r, color.g, color.b].every(
    (comp) => comp === 0 || comp === 255
  );
}

function mergeColors(colorA: Color, colorB: Color) {
  return {
    r: Math.floor((colorA.r + colorB.r) / 2),
    g: Math.floor((colorA.g + colorB.g) / 2),
    b: Math.floor((colorA.b + colorB.b) / 2),
  };
}

export function expectEvent(
  receipt: ContractReceipt,
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  argsCondition: (args: any) => boolean
): void {
  const index = receipt.events?.findIndex((e) => {
    return e.event === name && argsCondition(e?.args);
  });
  expect(Number(index) >= 0).to.equal(true);
}

describe("Rainbow Token - Flow Test", function () {
  let player0Signer: SignerWithAddress;
  let player1Signer: SignerWithAddress;
  let rainbowToken: RainbowToken;

  const TARGET_COLOR: Color = {
    r: 125,
    g: 125,
    b: 125,
  };
  const ENTRY_FEE = ethers.utils.parseUnits("0.1", "ether");
  const DEFAULT_BLENDING_PRICE = ethers.utils.parseUnits("0.1", "ether");
  const SELF_BLEND_PRICE = ethers.utils.parseUnits("0.5", "ether");

  before(async () => {
    [, player0Signer, player1Signer] = await ethers.getSigners();
    const RainbowToken = await ethers.getContractFactory("RainbowToken");
    rainbowToken = await RainbowToken.deploy(
      TARGET_COLOR.r,
      TARGET_COLOR.g,
      TARGET_COLOR.b
    );
    await rainbowToken.deployed();
  });

  it("game is properly initialized", async () => {
    const targetColor = await rainbowToken.getTargetColor();
    expect(areColorEquals(targetColor, TARGET_COLOR)).to.equal(true);
  });

  it("accounts join the game", async () => {
    for (const playerSigner of [player0Signer, player1Signer]) {
      const tx = await rainbowToken
        .connect(playerSigner)
        .joinGame({ value: ENTRY_FEE });
      const receipt = await tx.wait();

      expect(tx.value).to.equal(ENTRY_FEE);

      expectEvent(
        receipt,
        "PlayerJoined",
        (args) =>
          args.account === playerSigner.address &&
          isOriginalColorValid(args.originalColor)
      );

      expect(await rainbowToken.isPlayer(playerSigner.address)).to.equal(true);

      const player = await rainbowToken.getPlayer(playerSigner.address);
      expect(player.blendingPrice).to.equal(DEFAULT_BLENDING_PRICE);
      expect(areColorEquals(player.color, player.originalColor)).to.equal(true);
      expect(isOriginalColorValid(player.originalColor)).to.equal(true);
    }
  });

  it("player0 updates its blending price", async () => {
    const updatedBlendingPrice = DEFAULT_BLENDING_PRICE.mul(2);
    const tx = await rainbowToken
      .connect(player0Signer)
      .updateBlendingPrice(updatedBlendingPrice);
    expectEvent(
      await tx.wait(),
      "BlendingPriceUpdated",
      (args) =>
        args.account === player0Signer.address &&
        args.blendingPrice.toString() === updatedBlendingPrice.toString()
    );
    const player = await rainbowToken.getPlayer(player0Signer.address);
    expect(player.blendingPrice).to.equal(updatedBlendingPrice);
  });

  it("player 1 blends with player 0", async () => {
    const player0 = await rainbowToken.getPlayer(player0Signer.address);
    const tx = await rainbowToken
      .connect(player1Signer)
      .blend(player0Signer.address, player0.color, {
        value: DEFAULT_BLENDING_PRICE.mul(2),
      });
    const receipt = await tx.wait();

    expect(tx.value).to.equal(DEFAULT_BLENDING_PRICE.mul(2));

    const player1 = await rainbowToken.getPlayer(player1Signer.address);

    expectEvent(receipt, "Blended", (args) => {
      return (
        args.account === player1Signer.address &&
        args.blendingAccount === player0Signer.address &&
        areColorEquals(
          args.color,
          mergeColors(player0.color, player1.originalColor)
        ) &&
        areColorEquals(args.blendingColor, player0.color)
      );
    });

    expect(areColorEquals(player1.color, player1.originalColor)).to.equal(
      false
    );
    expect(
      areColorEquals(
        player1.color,
        mergeColors(player0.color, player1.originalColor)
      )
    ).to.equal(true);
  });

  it("player 0 blends with player 1", async () => {
    const player1 = await rainbowToken.getPlayer(player1Signer.address);
    const tx = await rainbowToken
      .connect(player0Signer)
      .blend(player1Signer.address, player1.color, {
        value: DEFAULT_BLENDING_PRICE,
      });
    const receipt = await tx.wait();

    expect(tx.value).to.equal(DEFAULT_BLENDING_PRICE);

    const player0 = await rainbowToken.getPlayer(player0Signer.address);

    expectEvent(receipt, "Blended", (args) => {
      return (
        args.account === player0Signer.address &&
        args.blendingAccount === player1Signer.address &&
        areColorEquals(
          args.color,
          mergeColors(player1.color, player0.originalColor)
        ) &&
        areColorEquals(args.blendingColor, player1.color)
      );
    });

    expect(areColorEquals(player0.color, player0.originalColor)).to.equal(
      false
    );
    expect(
      areColorEquals(
        player0.color,
        mergeColors(player1.color, player0.originalColor)
      )
    ).to.equal(true);
  });

  it("player 0 self blends", async () => {
    const player0 = await rainbowToken.getPlayer(player0Signer.address);
    const tx = await rainbowToken
      .connect(player0Signer)
      .selfBlend({ value: SELF_BLEND_PRICE });
    const receipt = await tx.wait();

    expect(tx.value).to.equal(SELF_BLEND_PRICE);

    const player0Updated = await rainbowToken.getPlayer(player0Signer.address);

    expectEvent(
      receipt,
      "SelfBlended",
      (args) =>
        args.account === player0Signer.address &&
        areColorEquals(
          args.color,
          mergeColors(player0.color, player0.originalColor)
        )
    );

    expect(
      areColorEquals(
        player0Updated.color,
        mergeColors(player0.color, player0.originalColor)
      )
    );
    expect(areColorEquals(player0.originalColor, player0Updated.originalColor));
  });
});
