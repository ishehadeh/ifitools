import { parse as csvParse } from "jsr:@std/csv";
import { postingSchema } from "../ifx/ifx-zod.ts";
import {
  ClearDateExtModel,
  DescriptionExtModel,
} from "../ifx-ext/mod.ts";
import * as z from "zod";
import { formatIfxDate } from "../ifx/utils.ts";
import { IfxImporter } from "./common.ts";

export type CapitalOneTransactionRecord = {
  "Run Date": string,
  "Action": string,
  "Symbol": string,
  "Description": string,
  "Type": string,
  "Quantity": string,
  "Price ($)": string,
  "Commission ($)": string,
  "Fees ($)": string,
  "Accrued Interest ($)": string,
  "Amount ($)": string,
  "Cash Balance ($)": string,
  "Settlement Date": string
};

export function readFidelityTransactions(
  content: string,
): CapitalOneTransactionRecord[] {
  const startIdx = content.indexOf('Run Date');
  const endIdx = content.indexOf('"The data and information in this spreadsheet is provided to you solely for your use and is not for distribution');
  const csvContent = content.substring(startIdx, endIdx).trim();
  return csvParse(csvContent, {
    skipFirstRow: true,
    columns: [
      "Run Date",
      "Action",
      "Symbol",
      "Description",
      "Type",
      "Quantity",
      "Price ($)",
      "Commission ($)",
      "Fees ($)",
      "Accrued Interest ($)",
      "Amount ($)",
      "Cash Balance ($)",
      "Settlement Date",
    ],
  });
}


const CapitalOneIfxPostingModel = postingSchema(z.intersection(
  DescriptionExtModel,
  ClearDateExtModel,
));
export type FidelityIfxPosting = z.infer<typeof CapitalOneIfxPostingModel>;

export const FIDELITY_AMOUNT_RE = /[0-9,]+\.[0-9]+/;
export const FIDELITY_DATE_RE = /(?<m>\d{2})\/(?<d>\d{2})\/(?<y>\d{4})/;

export function c1AmountToIfxAmount(
  amt: string,
): string {
  if (amt.startsWith('-') || amt.startsWith('+')) {
    return amt
  } else {
    return '+' + amt;
  }
}

export function fidelityDateToIFxDate(c1Date: string): string {
  const [_, m, d, y,] = FIDELITY_DATE_RE.exec(c1Date)!;
  // assume dates are in local time
  return formatIfxDate(Temporal.ZonedDateTime.from({ year: +y, month: +m, day: +d, timeZone: 'America/New_York'}));
}

export function c1ActivityRecordToIFX(
  record: CapitalOneTransactionRecord,
): FidelityIfxPosting {
  // TODO: proper error handling
  return {
    date: fidelityDateToIFxDate(record["Run Date"]),
    account: '',
    status: "UNKNOWN",
    commodity: "USD",
    amount: c1AmountToIfxAmount(record["Amount ($)"]),
    ext: {
      description: record.Description,
      clearDate: record["Settlement Date"] ? fidelityDateToIFxDate(record["Settlement Date"]) : undefined,
    },
  };
}

export class FidelityActivityIfxImporter implements IfxImporter {
  constructor() {}

  import(file: Uint8Array): FidelityIfxPosting[] {
    const text = new TextDecoder("utf-8").decode(file);
    return readFidelityTransactions(text).map(c1ActivityRecordToIFX);
  }
}
