#!/bin/env -S deno run --ext=ts --
import { Command } from "cliffy/command/mod.ts";
import { Posting } from "../../ifx/ifx-zod.ts";
import * as json from "@std/json/mod.ts";
import { TextLineStream } from "@std/streams/mod.ts";
import { TransactioMatcher } from "../matcher.ts";
import { fireflySearch } from "../firefly-iii/search.ts";

await new Command()
  .name("firefly-match")
  .version("0.1.0")
  .description("try to match IFX transactions to firefly-iii transactions")
  .option('--firefly-key [fireflyKey:string]', 'firefly-III api key, defaults to $FIREFLY_KEY')
  .option('--account [account:string]', 'firefly-III account to search')
  .option('--show-unmatched', 'list firefly transactions with dates between the first and last posting, but do not match a posting')
  .arguments('[ifx:string]')
  .action(({ifx, fireflyKey, account, showUnmatched}) => main(ifx, fireflyKey, account, showUnmatched))
  .parse(Deno.args);


async function main(file?: string, fireflyKey?: string, account?: string, showUnmatched: boolean = false) {
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
    let earliestPosting = null;
    let latestPosting = null;
    const matchedIds = [] 

    const matcher = new TransactioMatcher({fireflyBaseURL: 'https://finance.shehadeh.net', fireflyKey })
    for await (const postingJson of input) {
        const posting = Posting.parse(postingJson);
        const date = Temporal.PlainDateTime.from(posting.date);
        if (!earliestPosting || Temporal.PlainDateTime.compare(earliestPosting, date) > 0) {
            earliestPosting = date
        }
        if (!latestPosting || Temporal.PlainDateTime.compare(latestPosting, date) < 0) {
            latestPosting = date
        }
        console.log(`${posting.date} ${posting.amount} "${posting.ext?.description ?? '' }"`);
        const matchingTransactions = await matcher.findMatchingTransaction(posting);
        
        if (matchingTransactions.length === 0) {
            console.log('   none found');
        } else {
            for (const txn of matchingTransactions) {
                matchedIds.push(txn.id);
                console.log('    - ' + server + '/transactions/show/' + txn.id);
            }
        }
    }
    if (showUnmatched) {
        console.log('finding missing transactions: from ', earliestPosting, " to ", latestPosting);
        let allTransactionsQuery = `date_after:${earliestPosting?.toPlainDate()} date_before:${latestPosting?.toPlainDate()}`;
        if (account) {
            allTransactionsQuery += ` account_is:"${account}"`;
        }
        let page = 1;
        const limit = 10;

        while (true) {
            const transactions = await fireflySearch(allTransactionsQuery, {
                apiKey: fireflyKey,
                baseURL: 'https://finance.shehadeh.net',
                page,
                limit
            });
            page += 1;
            for (const txn of transactions) {
                if (!matchedIds.includes(txn.id)) {
                    console.log('    - ' + server + '/transactions/show/' + txn.id);
                }
            }
            if (transactions.length < limit) {
                break;
            }
        }
    }
}

