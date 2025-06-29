import { Posting } from "../ifx/ifx-zod.ts";

export type TransactionMatcherOptions = {
    /** an override for all source accounts in the given postings, or a map from Firefly Source Account to Posting source account matcher.
     * A 'source account' are accounts on a posting with an amount < 0
     */
    sourceAccount?: string | Record<string, string|RegExp>

    /** an override for all destination accounts in the given postings, or a map from Firefly Destination Account to Posting destination account matcher.
     * A 'destination account' are those with an amount >= 0
     */
    destinationAccount?: string | Record<string, string|RegExp>,

    defaultToPostingAccount?: boolean,

    bufferTimeBefore?: Temporal.Duration,
    bufferTimeAfter?: Temporal.Duration,

    fireflyKey: string,
    fireflyBaseURL: string,
}

export type TransactionSearchResult = {
    id: string,
    type: 'transaction',
    attributes: Record<string, any>
}

export class TransactioMatchError extends Error {
    response: any;
    status: number;
    statusText: string;

    constructor(status: number, statusText: string, response: any) {
        super('Search Request Failed, error code: ' + status + ', ' + statusText);
        this.status = status;
        this.statusText = statusText;
        this.response = response;
    }
}

export class TransactioMatcher {
    #sourceAccount: Record<string, string|RegExp> = {};
    #destinationAccount: Record<string, string|RegExp> = {};
    #bufferTimeBefore: Temporal.Duration;
    #bufferTimeAfter: Temporal.Duration;
    #defaultToPostingAccount: boolean;
    #fireflyKey: string;
    #fireflyBaseURL: string

    constructor(opts: TransactionMatcherOptions) {
        if (typeof(opts.sourceAccount) === 'string') {
            this.#sourceAccount[opts.sourceAccount] = /.*/; 
        } else if (typeof(opts.sourceAccount) === 'object') {
            this.#sourceAccount = opts.sourceAccount
        }
        
        if (typeof(opts.destinationAccount) === 'string') {
            this.#destinationAccount[opts.destinationAccount] = /.*/; 
        } else if (typeof(opts.destinationAccount) === 'object') {
            this.#destinationAccount = opts.destinationAccount
        }

        this.#bufferTimeAfter = opts.bufferTimeAfter ?? Temporal.Duration.from({ 'days': 1})
        this.#bufferTimeBefore = opts.bufferTimeBefore ?? Temporal.Duration.from({ 'days': 1})

        this.#defaultToPostingAccount = opts.defaultToPostingAccount ?? false;
        this.#fireflyKey = opts.fireflyKey;
        this.#fireflyBaseURL = opts.fireflyBaseURL;
    }

    async findMatchingTransaction(posting: Posting): Promise<TransactionSearchResult[]> {
        const searchString = this.#generateSearchForPosting(posting);
        const query = new URLSearchParams();
        query.set('query', searchString);
        const result = await fetch(this.#fireflyBaseURL + '/api/v1/search/transactions?' + query.toString(), {
            'method': 'GET',
            'headers': {
                'Authorization':  `Bearer ${this.#fireflyKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        const resultBody = await result.json();
        if (!result.ok) {
            throw new TransactioMatchError(result.status, result.statusText, resultBody);
        };
        return resultBody.data as TransactionSearchResult[];
    }

    #generateSearchForPosting(posting: Posting): string {
        const date = Temporal.PlainDateTime.from(posting.date);
        const dateRangeEnd = date.add(this.#bufferTimeAfter);
        const dateRangeStart = date.subtract(this.#bufferTimeBefore);
        const baseQuery = `amount:${posting.amount} date_after:${dateRangeStart.toPlainDate()} date_before:${dateRangeEnd.toPlainDate()}`;
        let accountQuery = '';
        if (posting.amount.startsWith('+')) {
            let account = this.#mapDestAccount(posting.account);
            if (this.#defaultToPostingAccount) {
                account ??= posting.account;
            }
            if (account != null)
                accountQuery = ` destination_account_is:"${account}"`
        } else if (posting.amount.startsWith('-')) {
            let account = this.#mapSourceAccount(posting.account);
            if (this.#defaultToPostingAccount) {
                account ??= posting.account;
            }
            if (account != null)
                accountQuery = ` source_account_is:"${account}"`
        }

        return baseQuery + accountQuery;
    }

    #mapDestAccount(postingAccount: string): string|null {
        return TransactioMatcher.#findAccountFromMap(postingAccount, this.#destinationAccount);
    }
    
    #mapSourceAccount(postingAccount: string): string|null {
        return TransactioMatcher.#findAccountFromMap(postingAccount, this.#sourceAccount);
    }

    static #findAccountFromMap(postingAccount: string, map: Record<string, string|RegExp>): string|null {
        for(const [fireflyAccount, matcher] of Object.entries(map)) {
            if (typeof(matcher) === 'string') {
                if (matcher === postingAccount) {
                    return fireflyAccount;
                }
            } else if (matcher.test(postingAccount)) {
                return fireflyAccount;
            }
        }
        return null;
    }
}