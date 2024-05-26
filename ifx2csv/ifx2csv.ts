import { stringify } from "jsr:@std/csv";
import * as json from "https://deno.land/std@0.224.0/json/mod.ts";
import { Posting } from "../ifx/ifx-zod.ts";
import { TextLineStream } from "https://deno.land/std/streams/mod.ts";
import { ExtensionFlattener } from "./ext/common.ts";
import PayeeExtAdapter from "./ext/payee.ts";
import DescriptionExtAdapter from "./ext/description.ts";

export class CSVConverter<
  ExtFieldSetsT extends string[],
> {
  constructor(
    public adapters: {
      [I in keyof ExtFieldSetsT]: ExtensionFlattener<ExtFieldSetsT[I]>;
    },
  ) {
  }

  convert(
    posting: Posting,
  ): Record<
    | "date"
    | "status"
    | "account"
    | "amount"
    | "commodity"
    | ExtFieldSetsT[number],
    string
  > {
    return Object.assign({
      "date": posting.date,
      "status": posting.status,
      "amount": posting.amount,
      "commodity": posting.commodity,
      "account": posting.account,
    }, ...this.adapters.map((adapter) => adapter(posting)));
  }
}

const jsonlStream = Deno.stdin.readable
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream())
  .pipeThrough(new json.JsonParseStream());

const conv = new CSVConverter([PayeeExtAdapter, DescriptionExtAdapter]);

const csv: Record<string, string>[] = [];
for await (const record of jsonlStream.values()) {
  const posting = Posting.parse(record);
  csv.push(conv.convert(posting));
}

console.log(stringify(csv, { columns: Object.keys(csv[0]) }));
