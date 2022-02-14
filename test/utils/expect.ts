import { expect } from "chai";
import { BigNumber, ContractReceipt } from "ethers";
import { ethers } from "hardhat";
import { Color } from "../types";

export function areColorEquals(colorA: Color, colorB: Color) {
  return (
    colorA.r === colorB.r && colorA.g === colorB.g && colorA.b === colorB.b
  );
}

export function isOriginalColorValid(color: Color) {
  return [color.r, color.g, color.b].every(
    (comp) => comp === 0 || comp === 255
  );
}

export function mergeColors(colorA: Color, colorB: Color) {
  return {
    r: Math.floor((colorA.r + colorB.r) / 2),
    g: Math.floor((colorA.g + colorB.g) / 2),
    b: Math.floor((colorA.b + colorB.b) / 2),
  };
}

function formatNum(a: BigNumber) {
  return Math.floor(
    Math.floor(
      Number.parseFloat(
        ethers.utils.formatUnits(a.mul(10 ** 4), "ether").toString()
      )
    ) /
      10 ** 4
  ).toFixed(4);
}

export function areBalancesClose(a: BigNumber, b: BigNumber) {
  return formatNum(a) === formatNum(b);
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
