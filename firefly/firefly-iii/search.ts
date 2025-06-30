import { PageOptions, FireflyRequestOptions, FireflyRequestFailed } from './common.ts';

export type TransactionSearchResult = {
    id: string,
    type: 'transaction',
    attributes: Record<string, any>
}

export async function fireflySearch(query: string, opts: PageOptions & FireflyRequestOptions): Promise<TransactionSearchResult[]> {
    const urlQuery = new URLSearchParams();
    urlQuery.set('query', query);
    if (opts.limit) {
        urlQuery.set('limit', `${opts.limit}`);
    }
    if (opts.page) {
        urlQuery.set('page', `${opts.page}`);
    }
    const url = opts.baseURL + '/api/v1/search/transactions?' + urlQuery.toString();
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