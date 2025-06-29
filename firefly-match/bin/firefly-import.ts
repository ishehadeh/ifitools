#!/bin/env -S deno run --ext=ts --
import { Command, EnumType } from "cliffy/command/mod.ts";
import  { Input } from "cliffy/prompt/mod.ts";
import { Posting } from "../../ifx/ifx-zod.ts";
import * as json from "@std/json/mod.ts";
import { TextLineStream } from "@std/streams/mod.ts";
import { TransactioMatcher } from "../matcher.ts";
import { late } from "zod";
import { fireflySearch } from "../firefly-iii/search.ts";
import { getAccounts } from "../firefly-iii/accounts.ts";
import { FireflyRequestFailed } from "../firefly-iii/common.ts";

await new Command()
  .name("firefly-match")
  .version("0.1.0")
  .description("try to match IFX transactions to firefly-iii transactions")
  .option('--firefly-key <fireflyKey:string>', 'firefly-III api key, defaults to $FIREFLY_KEY')
  .option('--source-account <account:string>', 'firefly-III account to search', {required: true})
  .option('--show-unmatched', 'list firefly transactions with dates between the first and last posting, but do not match a posting')
  .arguments('[ifx:string]')
  .action(({fireflyKey, sourceAccount, showUnmatched}, ifx) => main(ifx, sourceAccount, fireflyKey, showUnmatched))
  .parse(Deno.args);


async function main(file?: string, sourceAccount: string, fireflyKey?: string,  showUnmatched: boolean = false) {
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
    
    const accounts = [];
    let page = 0;
    const limit = 50;
    console.log('fetching account list...');
    while (true) {
        const accountsPage = await getAccounts({ page, limit, apiKey: fireflyKey, baseURL: 'https://finance.shehadeh.net'});
        accounts.push(...accountsPage);
        if (accountsPage.length < limit) break;
        page += 1;
        console.log('finished page ' + (page + 1));
    }

    const sourceAccountData = accounts.filter((a) => {
        if (sourceAccount.startsWith('#')) {
            return a.id == sourceAccount.substring(1);
        } else {
            return a.attributes['name'] == sourceAccount;
        }
    })

    if (sourceAccountData.length === 0) {
        throw new Error('could not find source account ');
    }
    if (sourceAccountData.length > 1) {
        throw new Error('source account is ambiguous');
    }

    const matcher = new TransactioMatcher({fireflyBaseURL: 'https://finance.shehadeh.net', fireflyKey })
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
                validate: (input) => /#([0-9]+)/g.test(input),
                suggestions: accounts.map((a) => `${a.attributes['name']} (${a.attributes['type']}, #${a.id})`) 
            });
            const accountId = accountStr.match(/#([0-9]+)/g)![0].substring(1);
            const accountInfo = accounts.find((a) => a.id === accountId)!;
            const type = accountInfo.attributes['type'] === 'asset'
                ? 'transfer'
                : (accountInfo.attributes['type'] === 'expense'
                    ? 'withdrawal'
                    : 'deposit');
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
                amount: posting.amount.substring(1)
            };
            const url = 'https://finance.shehadeh.net/api/v1/transactions';
            const result = await fetch(url, {
                'method': 'POST',
                'body': JSON.stringify({transactions: [newTransaction]}),
                'headers': {
                    'Authorization':  `Bearer ${fireflyKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            const resultBody = await result.json();
            if (!result.ok) {
                throw new FireflyRequestFailed(result.status, result.statusText, resultBody, url);
            };
            console.log(`created transaction: https://finance.shehadeh.net/transactions/show/${resultBody['data']['id']}`);
        } else {
            for (const txn of matchingTransactions) {
                console.log('    - ' + server + '/transactions/show/' + txn.id);
            }
        }
    }
}

