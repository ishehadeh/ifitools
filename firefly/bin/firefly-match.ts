#!/bin/env -S deno run --ext=ts --
import { Command } from "cliffy/command/mod.ts";
import { Posting } from "../../ifx/ifx-zod.ts";
import * as json from "@std/json/mod.ts";
import { TextLineStream } from "@std/streams/mod.ts";
import { TransactioMatcher } from "../matcher.ts";
import { FireflyClient, throwOnError } from "../firefly-iii/client.ts";

await new Command()
  .name("firefly-match")
  .version("0.1.0")
  .description("try to match IFX transactions to firefly-iii transactions")
  .option('--firefly-key <fireflyKey:string>', 'firefly-III api key, defaults to $FIREFLY_KEY')
  .option('--account <account:string>', 'firefly-III account to search')
  .option('--days-before <daysBefore:number>', 'number of days before to allow')
  .option('--days-after <daysAfter:number>', 'number of days after to allow')
  .option('--show-unmatched', 'list firefly transactions with dates between the first and last posting, but do not match a posting')
  .arguments('[ifx:string]')
  .action(({fireflyKey, account, showUnmatched, daysBefore, daysAfter}, ifx) => main(ifx, fireflyKey, account, showUnmatched, daysBefore, daysAfter))
  .parse(Deno.args);


async function main(file?: string, fireflyKey?: string, account?: string, showUnmatched: boolean = false, daysBefore: number = 1, daysAfter: number = 1) {
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

    const client = new FireflyClient({
        baseUrl: 'https://finance.shehadeh.net/api',
        apiKey: fireflyKey,
    })
    const matcher = new TransactioMatcher(client, {
        bufferTimeBefore: Temporal.Duration.from({days: daysBefore }),
        bufferTimeAfter: Temporal.Duration.from({days: daysAfter })
    });
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
            const { data } = await throwOnError(client.fetch.GET('/v1/search/transactions', {
                params: {
                    query: {
                        query: allTransactionsQuery,
                        page,
                        limit
                    }
                }
            }));
            page += 1;
            for (const txn of data!.data) {
                if (!matchedIds.includes(txn.id)) {
                    console.log('    - ' + server + '/transactions/show/' + txn.id);
                }
            }
            if (data!.data.length < limit) {
                break;
            }
        }
    }
}

