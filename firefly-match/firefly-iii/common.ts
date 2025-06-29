
export type FireflyRequestOptions = {
    apiKey: string,
    baseURL: string
}

export type PageOptions =  {
    limit?: number,
    page?: number
}


export class FireflyRequestFailed extends Error {
    response: any;
    status: number;
    statusText: string;

    constructor(status: number, statusText: string, response: any, url: string) {
        super(url + ' failed: error code: ' + status + ', ' + statusText + '\nBody: ' + JSON.stringify(response, null, 2));
        this.status = status;
        this.statusText = statusText;
        this.response = response;

    }
}

