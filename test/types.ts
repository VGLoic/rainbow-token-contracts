import { BigNumberish } from "ethers";

export type Color = {
  r: number;
  g: number;
  b: number;
};

export type Player = {
  blendingPrice: BigNumberish;
  color: Color;
  originalColor: Color;
};
