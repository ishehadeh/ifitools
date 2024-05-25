import { stringify } from "jsr:@std/csv";
import * as json from "https://deno.land/std@0.224.0/json/mod.ts";
import { Posting } from "../ifx/ifx-zod.ts";
import { TextLineStream } from "https://deno.land/std/streams/mod.ts";

const jsonlStream = Deno.stdin.readable
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream())
  .pipeThrough(new json.JsonParseStream());

const csv: Posting<Record<string, unknown>>[] = [];
for await (const record of jsonlStream.values()) {
  const posting = Posting.parse(record);
  csv.push(posting);
}

console.log(stringify(csv, {
  columns: [
    "account",
    "amount",
    "commodity",
    "status",
    "date",
    ["ext", "description"],
  ],
}));
