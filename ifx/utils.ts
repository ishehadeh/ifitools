export function formatIfxAmount(n: number): string {
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
