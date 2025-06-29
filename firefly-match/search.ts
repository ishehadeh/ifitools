
export type FireflyRequestOptions = {
    apiKey: string,
    baseURL: string
}

export type PageOptions =  {
    limit?: number,
    page?: number
}

export type TransactionSearchResult = {
    id: string,
    type: 'transaction',
    attributes: Record<string, any>
}

export class FireflyRequestFailed extends Error {
    response: any;
    status: number;
    statusText: string;

    constructor(status: number, statusText: string, response: any, url: string) {
        super(url + ' failed: error code: ' + status + ', ' + statusText);
        this.status = status;
        this.statusText = statusText;
        this.response = response;

    }
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