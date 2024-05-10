// @deno-types="https://raw.githubusercontent.com/MikeMcl/bignumber.js/v9.1.2/bignumber.d.ts"
import BigNumber from "bignumber";

export function bigNumberToIfxAmount(n: BigNumber, prec?: number): string {
  const s = prec ? n.toFixed(prec, BigNumber.ROUND_HALF_CEIL) : n.toFixed();
  if (n.isPositive()) {
    return `+${s}`;
  } else {
    return s;
  }
}
