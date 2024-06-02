import BigNumber from "bignumber";

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

export function formatIfxDate(date: Date): string {
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
