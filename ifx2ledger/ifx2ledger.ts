import { stringify } from "jsr:@std/csv";
import * as json from "@std/json/mod.ts";
import { TextLineStream } from "@std/streams/mod.ts";
import { encodeBase64 } from "@std/encoding/base64.ts";
import { basename } from "@std/path/basename.ts";
import { join } from "@std/path/join.ts";
import { Command } from "cliffy/command/mod.ts";
import { postingSchema } from "../ifx/ifx-zod.ts";
import { mapExt } from "../ifx/ifx-zod.ts";
import { Posting } from "../ifx/ifx-zod.ts";
import { DescriptionExtModel, PayeeExtModel } from "../ifx-ext/mod.ts";

await new Command()
  .name("ifx2ledger")
  .version("0.1.0")
  .description("Convert ifx document to ledger file")
  .arguments("[input:string]")
  .action((_, file) => main(file))
  .parse(Deno.args);

async function main(file?: string) {
  const inputRaw = file
    ? (await Deno.open(file)).readable
    : Deno.stdin.readable;
  const input = inputRaw
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .pipeThrough(new json.JsonParseStream());
  for await (const postingObj of input.values()) {
    const posting = await Posting.parseAsync(postingObj);
    const status = posting.status == "CLEARED" ? '*' : '!';
    const payee = mapExt(posting, DescriptionExtModel, (p) => " " + p.description) ?? "";
    const datePurchased = posting.ext["datePurchased"];
    const amount = (posting.amount[0] == '+' ? '-' : '+') + posting.amount.slice(1);
    console.log(`${posting.date.split('T')[0]} ${status}${payee}`);
    console.log(`    ${posting.account}    $${posting.amount}`);
    if (datePurchased) {
      console.log(`${" ".repeat(8)}; DatePurchased:: [${datePurchased.split("T")[0]}]`)
    }
    console.log(`    TODO                  $${amount}`);
    console.log("");
  }
}
