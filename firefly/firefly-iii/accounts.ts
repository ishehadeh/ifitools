import { FireflyRequestFailed, FireflyRequestOptions, PageOptions } from "./common.ts";

export type GetAccountsOptions = PageOptions & {
    date?: string,
    type?: string,
};

export type GetAccountsResult = {
    id: string,
    type: 'accounts',
    attributes: Record<string, any>
}
export async function getAccounts(opts: GetAccountsOptions & FireflyRequestOptions): Promise<GetAccountsResult[]> {
    const urlQuery = new URLSearchParams();
    if (opts.type) {
        urlQuery.set('type', `${opts.type}`);
    }
    if (opts.date) {
        urlQuery.set('date', `${opts.date}`);
    }
    if (opts.limit) {
        urlQuery.set('limit', `${opts.limit}`);
    }
    if (opts.page) {
        urlQuery.set('page', `${opts.page}`);
    }
    const url = opts.baseURL + '/api/v1/accounts?' + urlQuery.toString();
    const result = await fetch(url, {
        'method': 'GET',
        'headers': {
            'Authorization':  `Bearer ${opts.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });
    const resultBody = await result.json();
    if (!result.ok) {
        throw new FireflyRequestFailed(result.status, result.statusText, resultBody, url);
    };
    return resultBody['data'];
}