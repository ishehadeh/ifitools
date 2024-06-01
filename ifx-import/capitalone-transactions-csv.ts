import { parse as csvParse } from "jsr:@std/csv";
import { postingSchema } from "../ifx/ifx-zod.ts";
import {
  BudgetCategoryExtModel,
  ClearDateExtModel,
  DescriptionExtModel,
} from "../ifx-ext/mod.ts";
import * as z from "zod";
import { formatIfxDate } from "../ifx/utils.ts";
import { IfxImporter } from "./common.ts";

export type CapitalOneTransactionRecord = {
  "Transaction Date": string;
  "Posted Date": string;
  "Card No.": string;
  "Description": string;
  "Category": string;
  "Debit": string;
  "Credit": string;
};

export function readCapitalOneTransactions(
  content: string,
): CapitalOneTransactionRecord[] {
  return csvParse(content, {
    skipFirstRow: true,
    columns: [
      "Transaction Date",
      "Posted Date",
      "Card No.",
      "Description",
      "Category",
      "Debit",
      "Credit",
    ],
  });
}

const CapitalOneIfxPostingModel = postingSchema(z.intersection(
  DescriptionExtModel,
  z.intersection(ClearDateExtModel, BudgetCategoryExtModel),
));
export type CapitalOneIfxPosting = z.infer<typeof CapitalOneIfxPostingModel>;

export const C1_AMOUNT_RE = /[0-9,]+\.[0-9]+/;
export const C1_DATE_RE = /(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})/;

export function c1AmountToIfxAmount(
  amt: string,
  sign: "+" | "-" = "+",
): string {
  return sign +
    amt
      .replaceAll(",", "")
      .replace(/0+$/, "")
      .replace(/\.$/, ".0");
}

export function c1DateToIFxDate(c1Date: string): string {
  const [_, y, m, d] = C1_DATE_RE.exec(c1Date)!;
  // assume dates are in local time
  return formatIfxDate(new Date(+y, +m - 1, +d));
}

export function c1ActivityRecordToIFX(
  record: CapitalOneTransactionRecord,
): CapitalOneIfxPosting {
  // TODO: proper error handling
  return {
    date: c1DateToIFxDate(record["Transaction Date"]),
    account: record["Card No."],
    status: "UNKNOWN",
    commodity: "USD",
    amount: record.Credit == ""
      ? c1AmountToIfxAmount(record.Debit, "-")
      : c1AmountToIfxAmount(record.Credit, "+"),
    ext: {
      description: record.Description,
      budgetCategory: record.Category,
      clearDate: c1DateToIFxDate(record["Posted Date"]),
    },
  };
}

export class CapitalOneTransactionCSV implements IfxImporter {
  constructor() {}

  import(file: Uint8Array): CapitalOneIfxPosting[] {
    const text = new TextDecoder("utf-8").decode(file);
    return readCapitalOneTransactions(text).map(c1ActivityRecordToIFX);
  }
}
