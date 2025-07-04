import type { paths, components, operations } from './api.d.ts';
import createClient from 'npm:openapi-fetch';
import { FireflyRequestFailed } from "./common.ts";

export type OpenAPIFetchFireflyClient = ReturnType<typeof createClient<paths>>;
export type FireflyClientOpts = { baseUrl: string, apiKey: string };
export function fireflyClient({ baseUrl, apiKey } : FireflyClientOpts): OpenAPIFetchFireflyClient {
    return createClient<paths>({
        baseUrl,
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
}

export async function throwOnError<T extends { error?: unknown, response: Response }>(responsePromise: Promise<T>): Promise<T> {
    const response = await responsePromise;
    if (response.error != null) {
        throw new FireflyRequestFailed(response.response.status, response.response.statusText, response.error, response.response.url);
    }
    return response;
}

export type FireflyTransaction = components["schemas"]["TransactionRead"];

export class FireflyClient {
    public readonly fetch: OpenAPIFetchFireflyClient;

    constructor(opts: FireflyClientOpts) {
        this.fetch = fireflyClient(opts);
    }

    get accounts(): AccountsResource {
        return new AccountsResource(this);
    }
}


export type ListAccountParameters = operations['listAccount']['parameters']['query'];
export type ListAccountResult = operations['listAccount']['responses']['200']['content']['application/vnd.api+json'];
export type FireflyAccount = components['schemas']['Account'];
export type FireflyAccountRead = components['schemas']['AccountRead'];

export class AccountsResource {
    public readonly client: FireflyClient;

    constructor(client: FireflyClient) {
        this.client = client;
    }

    /**
     * @throws FireflyRequestFailed
     */
    async list(params: ListAccountParameters): Promise<ListAccountResult> {
        const { data } = await throwOnError(this.client.fetch.GET('/v1/accounts', { query: params }));
        return data!;
    }
}