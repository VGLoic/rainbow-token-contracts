import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { RainbowToken } from "../typechain";
import {
  DEFAULT_BLENDING_PRICE,
  ENTRY_FEE,
  SELF_BLEND_PRICE,
} from "./constants";
import { Color } from "./types";
import {
  areBalancesClose,
  areColorEquals,
  expectEvent,
  isOriginalColorValid,
  JoinGameTrace,
  mergeColors,
  testSetup,
} from "./utils";

describe("Rainbow Token - Flow Test", function () {
  let playerSigners: SignerWithAddress[];
  let firstPlayerSigner: SignerWithAddress;
  let secondPlayerSigner: SignerWithAddress;
  let winnerSigner: SignerWithAddress;
  let winnerBlendingSigner: SignerWithAddress;
  let rainbowToken: RainbowToken;
  let joinGameTrace: JoinGameTrace;

  const TARGET_COLOR: Color = {
    r: 127,
    g: 127,
    b: 127,
  };

  before(async () => {
    const setup = await testSetup({ targetColor: TARGET_COLOR });
    playerSigners = setup.playerSigners;
    rainbowToken = setup.rainbowToken;
    firstPlayerSigner = setup.firstPlayerSigner;
    secondPlayerSigner = setup.secondPlayerSigner;
    winnerSigner = setup.winnerSigner;
    winnerBlendingSigner = setup.winnerBlendingSigner;
    joinGameTrace = setup.joinGameTrace;
  });

  it("game is properly initialized", async () => {
    const targetColor = await rainbowToken.getTargetColor();
    expect(areColorEquals(targetColor, TARGET_COLOR)).to.equal(true);
  });

  it("accounts join the game", async () => {
    const { txs, receipts, players } = joinGameTrace;
    for (let index = 0; index < playerSigners.length; index++) {
      const playerSigner = playerSigners[index];

      expect(txs[index].value).to.equal(ENTRY_FEE);
      expectEvent(
        receipts[index],
        "PlayerJoined",
        (args) =>
          args.account === playerSigner.address &&
          isOriginalColorValid(args.originalColor)
      );
      expect(await rainbowToken.isPlayer(playerSigner.address)).to.equal(true);

      const player = players[index];
      expect(player.blendingPrice).to.equal(DEFAULT_BLENDING_PRICE);
      expect(areColorEquals(player.color, player.originalColor)).to.equal(true);
      expect(isOriginalColorValid(player.originalColor)).to.equal(true);
    }
    const contractBalance = await ethers.provider.getBalance(
      rainbowToken.address
    );
    expect(contractBalance).to.equal(ENTRY_FEE.mul(playerSigners.length));
  });

  it("first player updates its blending price", async () => {
    const updatedBlendingPrice = DEFAULT_BLENDING_PRICE.mul(2);
    const tx = await rainbowToken
      .connect(firstPlayerSigner)
      .updateBlendingPrice(updatedBlendingPrice);
    expectEvent(
      await tx.wait(),
      "BlendingPriceUpdated",
      (args) =>
        args.account === firstPlayerSigner.address &&
        args.blendingPrice.toString() === updatedBlendingPrice.toString()
    );
    const player = await rainbowToken.getPlayer(firstPlayerSigner.address);
    expect(player.blendingPrice).to.equal(updatedBlendingPrice);
  });

  it("second player blends with first player", async () => {
    const firstPlayer = await rainbowToken.getPlayer(firstPlayerSigner.address);
    const tx = await rainbowToken
      .connect(secondPlayerSigner)
      .blend(firstPlayerSigner.address, firstPlayer.color, {
        value: DEFAULT_BLENDING_PRICE.mul(2),
      });
    const receipt = await tx.wait();

    expect(tx.value).to.equal(DEFAULT_BLENDING_PRICE.mul(2));

    const secondPlayer = await rainbowToken.getPlayer(
      secondPlayerSigner.address
    );

    expectEvent(receipt, "Blended", (args) => {
      return (
        args.account === secondPlayerSigner.address &&
        args.blendingAccount === firstPlayerSigner.address &&
        areColorEquals(
          args.color,
          mergeColors(firstPlayer.color, secondPlayer.originalColor)
        ) &&
        areColorEquals(args.blendingColor, firstPlayer.color)
      );
    });

    expect(
      areColorEquals(secondPlayer.color, secondPlayer.originalColor)
    ).to.equal(false);
    expect(
      areColorEquals(
        secondPlayer.color,
        mergeColors(firstPlayer.color, secondPlayer.originalColor)
      )
    ).to.equal(true);

    const contractBalance = await ethers.provider.getBalance(
      rainbowToken.address
    );
    expect(contractBalance).to.equal(
      ENTRY_FEE.mul(playerSigners.length).add(DEFAULT_BLENDING_PRICE)
    );
  });

  it("first player blends with second player", async () => {
    const secondPlayer = await rainbowToken.getPlayer(
      secondPlayerSigner.address
    );
    const tx = await rainbowToken
      .connect(firstPlayerSigner)
      .blend(secondPlayerSigner.address, secondPlayer.color, {
        value: DEFAULT_BLENDING_PRICE,
      });
    const receipt = await tx.wait();

    expect(tx.value).to.equal(DEFAULT_BLENDING_PRICE);

    const firstPlayer = await rainbowToken.getPlayer(firstPlayerSigner.address);

    expectEvent(receipt, "Blended", (args) => {
      return (
        args.account === firstPlayerSigner.address &&
        args.blendingAccount === secondPlayerSigner.address &&
        areColorEquals(
          args.color,
          mergeColors(secondPlayer.color, firstPlayer.originalColor)
        ) &&
        areColorEquals(args.blendingColor, secondPlayer.color)
      );
    });

    expect(
      areColorEquals(firstPlayer.color, firstPlayer.originalColor)
    ).to.equal(false);
    expect(
      areColorEquals(
        firstPlayer.color,
        mergeColors(secondPlayer.color, firstPlayer.originalColor)
      )
    ).to.equal(true);
    const contractBalance = await ethers.provider.getBalance(
      rainbowToken.address
    );
    expect(contractBalance).to.equal(
      ENTRY_FEE.mul(playerSigners.length)
        .add(DEFAULT_BLENDING_PRICE)
        .add(DEFAULT_BLENDING_PRICE.div(2))
    );
  });

  it("first player self blends", async () => {
    const firstPlayer = await rainbowToken.getPlayer(firstPlayerSigner.address);
    const tx = await rainbowToken
      .connect(firstPlayerSigner)
      .selfBlend({ value: SELF_BLEND_PRICE });
    const receipt = await tx.wait();

    expect(tx.value).to.equal(SELF_BLEND_PRICE);

    const firstPlayerUpdated = await rainbowToken.getPlayer(
      firstPlayerSigner.address
    );

    expectEvent(
      receipt,
      "SelfBlended",
      (args) =>
        args.account === firstPlayerSigner.address &&
        areColorEquals(
          args.color,
          mergeColors(firstPlayer.color, firstPlayer.originalColor)
        )
    );

    expect(
      areColorEquals(
        firstPlayerUpdated.color,
        mergeColors(firstPlayer.color, firstPlayer.originalColor)
      )
    );
    expect(
      areColorEquals(
        firstPlayer.originalColor,
        firstPlayerUpdated.originalColor
      )
    );
    const contractBalance = await ethers.provider.getBalance(
      rainbowToken.address
    );
    expect(contractBalance).to.equal(
      ENTRY_FEE.mul(playerSigners.length)
        .add(DEFAULT_BLENDING_PRICE)
        .add(DEFAULT_BLENDING_PRICE.div(2))
        .add(SELF_BLEND_PRICE)
    );
  });

  it("winner claims victory once it has the target color", async () => {
    const wonAmount = ENTRY_FEE.mul(playerSigners.length)
      .add(DEFAULT_BLENDING_PRICE.mul(2))
      .add(SELF_BLEND_PRICE);
    const blendingPlayer = await rainbowToken.getPlayer(
      winnerBlendingSigner.address
    );
    await rainbowToken
      .connect(winnerSigner)
      .blend(winnerBlendingSigner.address, blendingPlayer.color, {
        value: DEFAULT_BLENDING_PRICE,
      });

    const winnerBalanceBefore = await ethers.provider.getBalance(
      winnerSigner.address
    );
    const tx = await rainbowToken.connect(winnerSigner).claimVictory();
    const receipt = await tx.wait();

    expectEvent(
      receipt,
      "GameOver",
      (args) =>
        args.winner === winnerSigner.address &&
        args.amount.toString() === wonAmount.toString()
    );

    const contractBalance = await ethers.provider.getBalance(
      rainbowToken.address
    );
    expect(contractBalance).to.equal(0);

    const winnerBalanceAfter = await ethers.provider.getBalance(
      winnerSigner.address
    );
    expect(
      areBalancesClose(winnerBalanceAfter, winnerBalanceBefore.add(wonAmount))
    ).to.equal(true);
  });
});
