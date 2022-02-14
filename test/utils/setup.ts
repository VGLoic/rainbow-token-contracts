import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractReceipt, ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { RainbowToken } from "../../typechain";
import { ENTRY_FEE } from "../constants";
import { Color, Player } from "../types";
import { areColorEquals, mergeColors } from "./expect";

type TestSetupArgs = {
  targetColor: Color;
};
export type JoinGameTrace = {
  txs: ContractTransaction[];
  receipts: ContractReceipt[];
  players: Player[];
};
type TestSetup = {
  playerSigners: SignerWithAddress[];
  rainbowToken: RainbowToken;
  joinGameTrace: JoinGameTrace;
  firstPlayerSigner: SignerWithAddress;
  secondPlayerSigner: SignerWithAddress;
  winnerSigner: SignerWithAddress;
  winnerBlendingSigner: SignerWithAddress;
};
export async function testSetup({
  targetColor,
}: TestSetupArgs): Promise<TestSetup> {
  const [, ...signers] = await ethers.getSigners();
  const RainbowToken = await ethers.getContractFactory("RainbowToken");
  let retryCount = 0;
  const maxRetry = 10;
  while (retryCount < maxRetry) {
    console.log("hello");
    const rainbowToken = (await RainbowToken.deploy(
      targetColor.r,
      targetColor.g,
      targetColor.b
    )) as RainbowToken;
    await rainbowToken.deployed();
    const txs = await Promise.all(
      signers.map((signer) =>
        rainbowToken.connect(signer).joinGame({ value: ENTRY_FEE })
      )
    );
    const receipts = await Promise.all(txs.map((tx) => tx.wait()));
    const players = await Promise.all(
      signers.map((signer) => rainbowToken.getPlayer(signer.address))
    );

    try {
      const winnerIndicesPair = findWinnerPair(players, targetColor);
      const randomPlayersIndicesPair = findRandomPlayers(
        players,
        winnerIndicesPair
      );
      return {
        playerSigners: signers,
        winnerSigner: signers[winnerIndicesPair[0]],
        winnerBlendingSigner: signers[winnerIndicesPair[1]],
        firstPlayerSigner: signers[randomPlayersIndicesPair[0]],
        secondPlayerSigner: signers[randomPlayersIndicesPair[1]],
        rainbowToken,
        joinGameTrace: { txs, receipts, players },
      };
    } catch (err) {
      console.log("Retrying...", err);
    }
    retryCount += 1;
  }
  throw new Error("Unable to generate a proper test setup");
}

function findWinnerPair(
  players: Player[],
  targetColor: Color
): [number, number] {
  const [winner, ...otherPlayers] = players;
  for (let index = 0; index < otherPlayers.length; index++) {
    const player = otherPlayers[index];
    if (areColorEquals(mergeColors(winner.color, player.color), targetColor)) {
      return [0, index + 1];
    }
  }
  throw new Error("Winner pair not found");
}

function findRandomPlayers(
  players: Player[],
  forbiddenIndices: number[]
): [number, number] {
  const firstPlayerIndex = players.findIndex(
    (_, index) => !forbiddenIndices.includes(index)
  );
  if (firstPlayerIndex < 0) {
    throw new Error("Unable to find random players");
  }
  const firstPlayer = players[firstPlayerIndex];
  const secondPlayerIndex = players.findIndex((player, index) => {
    const isNotForbidden = ![...forbiddenIndices, firstPlayerIndex].includes(
      index
    );
    const hasDifferentColor = !areColorEquals(firstPlayer.color, player.color);
    return isNotForbidden && hasDifferentColor;
  });
  if (secondPlayerIndex < 0) {
    throw new Error("Unable to find random players");
  }
  return [firstPlayerIndex, secondPlayerIndex];
}
