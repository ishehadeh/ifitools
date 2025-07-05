#!/bin/env -S deno run --ext=ts --
import { Command } from "cliffy/command/mod.ts";
import  { Input } from "cliffy/prompt/mod.ts";
import { Posting } from "../../ifx/ifx-zod.ts";
import * as json from "@std/json/mod.ts";
import { TextLineStream } from "@std/streams/mod.ts";
import { TransactioMatcher } from "../matcher.ts";
import { FireflyRequestFailed } from "../firefly-iii/common.ts";
import { FireflyAccountRead, fireflyClient, FireflyClient, throwOnError } from "../firefly-iii/client.ts";
import BigNumber from "bignumber";

type FireflyImportOpts = {
    fireflyKey: string,
    fireflyUrl: string,
    sourceAccount: string,
    file: string|undefined
};

await new Command()
  .name("firefly-match")
  .version("0.1.0")
  .description("try to match IFX transactions to firefly-iii transactions")
  .option('--firefly-key <fireflyKey:string>', 'firefly-III API key')
  .env('FIREFLY_KEY=<fireflyKey:string>', 'firefly-III API key')
  .option('--firefly-url <fireflyUrl:string>', 'firefly-III base URL key (e.g. https://demo.firefly-iii.org)')
  .env('FIREFLY_URL=<fireflyUrl:string>', 'firefly-III base URL key (e.g. https://demo.firefly-iii.org)')
  .option('--source-account <account:string>', 'firefly-III account to search', {required: true})
  .arguments('[ifxFile:string]')
  .action((opts, file) => {
    const fireflyKey = opts.fireflyKey;
    if (fireflyKey === undefined) {
        throw new Error('firefly key unset');
    }
    const fireflyUrl = opts.fireflyUrl;
    if (fireflyUrl === undefined) {
        throw new Error('firefly url unset');
    }
    main({...opts, file, fireflyKey, fireflyUrl})
  })
  .parse(Deno.args);


async function main(opts: FireflyImportOpts) {
    const server = 'https://finance.shehadeh.net';
    const inputRaw = opts.file
        ? (await Deno.open(opts.file)).readable
        : Deno.stdin.readable;
    const input = inputRaw
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream())
        .pipeThrough(new json.JsonParseStream());
    const client = new FireflyClient({
        apiKey: opts.fireflyKey,
        baseUrl: opts.fireflyUrl
    });
    const accounts: FireflyAccountRead[] = [];
    let page = 0;
    const limit = 50;
    console.log('fetching account list...');
    while (true) {
        const accountsPage = await client.accounts.list({ page, limit });
        accounts.push(...accountsPage.data);
        if (accountsPage.data.length < limit) break;
        page += 1;
        console.log('finished page ' + (page + 1));
    }

    const sourceAccountData = accounts.filter((a) => {
        if (opts.sourceAccount.startsWith('#')) {
            return a.id == opts.sourceAccount.substring(1);
        } else {
            return a.attributes['name'] == opts.sourceAccount;
        }
    })

    if (sourceAccountData.length === 0) {
        throw new Error('could not find source account ');
    }
    if (sourceAccountData.length > 1) {
        throw new Error('source account is ambiguous');
    }

    const matcher = new TransactioMatcher(client, {
        bufferTimeBefore: Temporal.Duration.from({ days: 4 }),
        bufferTimeAfter: Temporal.Duration.from({ days: 1 }),
    });
    for await (const postingJson of input) {
        const posting = Posting.parse(postingJson);
        console.log(`${posting.date} ${posting.amount} "${posting.ext?.description ?? '' }"`);
        const matchingTransactions = await matcher.findMatchingTransaction(posting);
        
        if (matchingTransactions.length === 0) {
            console.log('No Transaction Found');
            const accountStr = await Input.prompt({
                message: "choose destination account",
                list: true,
                info: true,
                validate: (input) => input === 'SKIP' || /#([0-9]+)/g.test(input),
                suggestions: [...accounts.map((a) => `${a.attributes['name']} (${a.attributes['type']}, #${a.id})`), 'SKIP']
            });
            if (accountStr === 'SKIP') continue;

            const accountId = accountStr.match(/#([0-9]+)/g)![0].substring(1);
            const accountInfo = accounts.find((a) => a.id === accountId)!;
            const type: 'deposit'|'withdrawal'|'transfer' = accountInfo.attributes['type'] === 'asset'
                ? 'transfer'
                : (posting.amount.startsWith('-') ? 'withdrawal' : 'deposit');
            if (type === 'withdrawal' && posting.amount[0] != '-') {
                throw new Error('non-negative amounts are forbidden on withdrawals');
            }
            if (type === 'deposit' && posting.amount[0] != '+') {
                throw new Error('negative amounts are forbidden on transfer');
            }

            const sourceAccount = sourceAccountData[0].id;
            const destAccount = accountId

            const newTransaction = {
                type,
                date: posting.date,
                payment_date: posting.ext['datePurchased'],
                tags: ['firefly-import'],
                destination_id: posting.amount[0] == '+' ? sourceAccount : destAccount,
                source_id: posting.amount[0] == '+' ? destAccount : sourceAccount,
                description: posting.ext.description ?? '?',
                amount: posting.amount.substring(1),
            };
            const result = await throwOnError(client.fetch.POST('/v1/transactions', {
                body: {
                    fire_webhooks: true,
                    transactions: [newTransaction]
                }
            }));
            console.log(`created transaction: https://finance.shehadeh.net/transactions/show/${result.data!.data.id}`);
        } else {
            for (const txn of matchingTransactions) {
                console.log('    - ' + server + '/transactions/show/' + txn.id);
            }
        }
    }
}

