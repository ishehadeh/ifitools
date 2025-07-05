import BigNumber from "bignumber";
import { AmountString } from "./ifx-zod.ts";

export function formatIfxAmount(n: number | BigNumber): string {
  let s = n.toFixed();
  if (s[0] == ".") {
    s = "0." + s;
  }

  if (s[0] != "-" && s[0] != "+") {
    s = "+" + s;
  }

  if (!s.includes(".")) {
    s += ".0";
  }
  return s;
}

export function splitIfxAmount(s: string): { sign: '+' | '-', integer: string, fraction: string } {
  AmountString.parse(s);
  const [sign, integer, fraction] = [s[0], ...s.slice(1).split('.')];

  // just to be sure double check...
  if (sign !== '+' && sign !== '-') throw new Error(`Invalid IFX amount: '${s}', first character must be + or -`);
  if (!/^[0-9]+$/.test(integer)) throw new Error(`Invalid IFX amount: '${s}', expected integer part to be all decimal digits, found '${integer}'`);
  if (!/^[0-9]+$/.test(fraction)) throw new Error(`Invalid IFX amount: '${s}', expected fraction part to be all decimal digits, found '${integer}'`);
  return { sign, integer, fraction }
}

export function parseIfxAmount(s: string): BigNumber {
  AmountString.parse(s);
  return BigNumber(s)
}

export function formatIfxDate(date: Date|Temporal.ZonedDateTime): string {
  if (date instanceof Temporal.ZonedDateTime) {
      return date.toString({
        calendarName: 'never',
        timeZoneName: 'never',
        smallestUnit: 'second'
      });
  }

  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? "+" : "-";
  const pad = (num: number) => (num < 10 ? "0" : "") + num;

  return date.getFullYear() +
    "-" + pad(date.getMonth() + 1) +
    "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) +
    ":" + pad(date.getMinutes()) +
    ":" + pad(date.getSeconds()) +
    dif + pad(Math.floor(Math.abs(tzo) / 60)) +
    ":" + pad(Math.abs(tzo) % 60);
}

export function mapCurrencySymbolToCommodity(symbol: string): string {
  switch (symbol) {
    case "$":
      return "USD";
    // TODO: rest of these....
    default:
      throw new Error("unrecognized currency symbol: " + symbol);
  }
}
