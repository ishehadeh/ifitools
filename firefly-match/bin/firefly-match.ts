#!/bin/env -S deno run --ext=ts --
import { Command, EnumType } from "cliffy/command/mod.ts";
import { Posting } from "../../ifx/ifx-zod.ts";
import * as json from "@std/json/mod.ts";
import { TextLineStream } from "@std/streams/mod.ts";
import { TransactioMatcher } from "../matcher.ts";

await new Command()
  .name("firefly-match")
  .version("0.1.0")
  .description("try to match IFX transactions to firefly-iii transactions")
  .option('--firefly-key [fireflyKey:string]', 'firefly-III api key, defaults to $FIREFLY_KEY')
  .option('--account [account:string]', 'firefly-III account to search')
  .arguments('[ifx:string]')
  .action(({ifx, fireflyKey, account}) => main(ifx, fireflyKey, account))
  .parse(Deno.args);


async function main(file?: string, fireflyKey?: string, account?: string) {
    const server = 'https://finance.shehadeh.net';
    const inputRaw = file
        ? (await Deno.open(file)).readable
        : Deno.stdin.readable;
    const input = inputRaw
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream())
        .pipeThrough(new json.JsonParseStream());
    fireflyKey ??= Deno.env.get('FIREFLY_KEY');
    if (fireflyKey == null) throw new Error('FIREFLY_KEY not set');

    const matcher = new TransactioMatcher({fireflyBaseURL: 'https://finance.shehadeh.net', fireflyKey})
    for await (const postingJson of input) {
        const posting = Posting.parse(postingJson);
        
        console.log(`${posting.date} ${posting.amount} "${posting.ext?.description ?? '' }"`);
        const matchingTransactions = await matcher.findMatchingTransaction(posting);
        
        if (matchingTransactions.length === 0) {
            console.log('   none found');
        } else {
            for (const txn of matchingTransactions) {
                console.log('    - ' + server + '/transactions/show/' + txn.id);
            }
        }
    }
}


function generateSearchForPosting(posting: Posting): string {
    const date = Temporal.PlainDateTime.from(posting.date);
    const dateRangeEnd = date.add(new Temporal.Duration(0, 0, 0, 3));
    const dateRangeStart = date.subtract(new Temporal.Duration(0, 0, 0, 3));
    return `amount:${posting.amount} date_after:${dateRangeStart.toPlainDate()} date_before:${dateRangeEnd.toPlainDate()}`;
}

