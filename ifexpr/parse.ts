import BigNumber from "bignumber";

export const TOKEN = {
  word:
    /([a-zA-Z_\*\$\#\@\!\%\^\&][a-zA-Z_\*\$\#\@\!\%\^\&0-9]+)|({)|(})|(\s+)|(\.)/,
  quoteLeft: /\{/,
  quoteRight: /\}/,
  whitespace: /\s+/,
  access: /\./,
  number: /[0-9]+/,
} as const;

export enum TokenType {
  Word,
  QuoteL,
  QuoteR,
  Whitespace,
  Numbers,
}

export function* tokenize(
  s: string,
): IterableIterator<[number, number, string, TokenType]> {
  const TOKEN =
    /([a-zA-Z_\*\$\#\@\!\%\^\&][a-zA-Z_\*\$\#\@\!\%\^\&0-9]+)|({)|(})|(\s+)|([0-9]+(\.[0-9]+)?)/g;
  for (const match of s.matchAll(TOKEN)) {
    // console.log(`[tokenize] MATCH: [${match.join(", ")}]`);
    if (match[1]) yield [match.index, match.length, match[0], TokenType.Word];
    if (match[2]) yield [match.index, match.length, match[0], TokenType.QuoteL];
    if (match[3]) yield [match.index, match.length, match[0], TokenType.QuoteR];
    if (match[4]) {
      yield [match.index, match.length, match[0], TokenType.Whitespace];
    }
    if (match[5]) {
      yield [match.index, match.length, match[0], TokenType.Numbers];
    }
  }
}
export type Value = string | BigNumber | Value[];

export function stack(
  tokens: Iterator<[number, number, string, TokenType]>,
): Value[] {
  const values = [];
  for (let t = tokens.next(); !t.done; t = tokens.next()) {
    const [_start, _end, text, tok] = t.value;
    // console.log(`[stack] TOKEN: ${tok} [${text}]`);
    switch (tok) {
      // case TokenType.Access:
      //   break;
      case TokenType.Numbers:
        values.push(BigNumber(text));
        break;
      case TokenType.QuoteL:
        values.push(stack(tokens));
        break;
      case TokenType.QuoteR:
        return values.reverse();
      case TokenType.Whitespace:
        break;
      case TokenType.Word:
        values.push(text);
    }
  }

  return values.reverse();
}
