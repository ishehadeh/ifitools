import { stringify } from "jsr:@std/csv";
import * as json from "@std/json/mod.ts";
import { TextLineStream } from "@std/streams/mod.ts";
import { encodeBase64 } from "@std/encoding/base64.ts";
import { basename } from "@std/path/basename.ts";
import { join } from "@std/path/join.ts";
import { Command } from "cliffy/command/mod.ts";
import { Status, StatusModel, postingSchema } from "../ifx/ifx-zod.ts";
import { mapExt } from "../ifx/ifx-zod.ts";
import { Posting } from "../ifx/ifx-zod.ts";
import { DescriptionExtModel, PayeeExtModel, ProductExtModel } from "../ifx-ext/mod.ts";

await new Command()
  .name("ifx2ledger")
  .version("0.1.0")
  .description("Convert ifx document to ledger file")
  .arguments("[input:string]")
  .action((_, file) => main(file))
  .parse(Deno.args);

type LedgerStatus = '' | '*' | '!'

function ifiStatusToLedger(status: Status): LedgerStatus {
  switch (status) {
    case "VOID": return '';
    case "UNKNOWN": return '';
    case "PENDING": return '!';
    case "CLEARED": return '*';
  }
}

function postingsToString(postings: Posting[]) {
  const status = ifiStatusToLedger(postings.find(p => p.status != 'CLEARED')?.status ?? 'CLEARED')
  const mainDate = postings[0].date.split("T")[0];

  const payee = mapExt(postings[0], DescriptionExtModel, (p) => " " + p.description) ?? "";
  console.log(`${mainDate} ${status}${payee}`);
  
  postings.forEach(posting => {
    const datePurchased = posting.ext["datePurchased"];
    console.log(`    ${posting.account}    ${posting.amount[0]}$${posting.amount.slice(1)}`);
    if (datePurchased && typeof datePurchased === 'string') {
      console.log(`${" ".repeat(8)}; DatePurchased:: [${datePurchased.split("T")[0]}]`)
    }
    
    mapExt(posting, ProductExtModel, ext => {
      console.log("    ; desc: " + ext.product.name)
    });
  })

  console.log("");
}

async function main(file?: string) {
  const inputRaw = file
    ? (await Deno.open(file)).readable
    : Deno.stdin.readable;
  const input = inputRaw
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .pipeThrough(new json.JsonParseStream());
  
  const invoiceGroups: Record<string, Posting[]> = {};
  const lonePostings = []
  for await (const postingObj of input.values()) {
    const posting = await Posting.parseAsync(postingObj);
    if ('invoiceNumber' in posting.ext) {
      const id = posting.ext['invoiceNumber'];
      if (id in invoiceGroups) {
        invoiceGroups[id].push(posting);
      } else {
        invoiceGroups[id] = [posting]
      }
    } else {
      lonePostings.push(posting)
    }
  }

  for await (const postings of Object.values(invoiceGroups)) {
    postingsToString(postings);
  }
  for await (const postings of lonePostings) {
    postingsToString([postings]);
  }
}
