import * as ofx from 'npm:@wademason/ofx'
import {  IfxImporter } from './common.ts';
import { Posting } from '../ifx/ifx-zod.ts';

// not sure why, but I can't import this normally with deno

function sgml2Xml(sgml: string): string {
  return sgml
      .replace(/>\s+</g, '><')    // remove whitespace inbetween tag close/open
      .replace(/\s+</g, '<')      // remove whitespace before a close tag
      .replace(/>\s+/g, '>')      // remove whitespace after a close tag
      .replace(/<([A-Z0-9_]*)+\.+([A-Z0-9_]*)>([^<]+)/g, '<\$1\$2>\$3' )
      .replace(/<(\w+?)>([^<]+)/g, '<\$1>\$2</\$1>');
}

export class OfxImporter implements IfxImporter {
  import(data: Uint8Array): Iterable<Posting> {
    const textData = new TextDecoder().decode(data);
    const [header, docSgml] = textData.split("\n\n", 2);
    const docXml = sgml2Xml(docSgml);
    const textDatatFixed = header + "\n\n" + docXml;
    const ofxData = new ofx.parse(textDatatFixed);
    console.log(ofxData);
    const ccTransfers = ofx.getCreditCardTransferList();
    const bankTransfers = ofx.getBankTransferList();
    const transactions: Posting[] = []

    for (const txn of bankTransfers) {
      transactions.push({
        date: txn.DTPOSTED.datetime!,
        amount: txn.TRNAMT,
        commodity: undefined,
        status: undefined,
        account: '',
        ext: {}
      })
    }

    for (const txn of ccTransfers) {
      transactions.push({
        date: txn.DTPOSTED.datetime!,
        amount: txn.TRNAMT,
        commodity: undefined,
        status: undefined,
        account: '',
        ext: {}
      })
    }


    return transactions;
  }  
}
