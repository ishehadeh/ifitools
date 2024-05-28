import { parse as csvParse } from "jsr:@std/csv";
import { postingSchema } from "../../ifx/ifx-zod.ts";
import { BalanceExtModel, DescriptionExtModel } from "../../ifx-ext/mod.ts";
import * as z from "zod";
import { formatIfxDate } from "../../ifx/utils.ts";
import { IfxImporter } from "../common.ts";

// PNCActivityRecord represents a single line in a PNC accountActivity file.
// These files can be obtained from pnc.com > Account Activity, and clicking "export" above the transaction table.
// Although all values are 'string', those typed '"" | string' indicate a nullable column.
export type PNCActivityRecord = {
  Date: string;
  Description: string;
  Withdrawals: string | "";
  Deposits: string | "";
  Category: string | "";
  Balance: string;
};

export function readPNCActivity(content: string): PNCActivityRecord[] {
  return csvParse(content, {
    skipFirstRow: true,
    columns: [
      "Date",
      "Description",
      "Withdrawals",
      "Deposits",
      "Category",
      "Balance",
    ],
  });
}

const PNCIFxPostingModel = postingSchema(z.union([
  DescriptionExtModel,
  BalanceExtModel,
]));
export type PNCIfxPosting = z.infer<typeof PNCIFxPostingModel>;

export const PNC_AMOUNT_RE = /\$[0-9,]+\.[0-9]+/;
export const PNC_DATE_RE = /(?<m>\d{2})\/(?<d>\d{2})\/(?<y>\d{4})/;

export function pncAmountToIfxAmount(
  amt: string,
  sign: "+" | "-" = "+",
): string {
  return sign +
    amt.substring(1).replaceAll(",", "").replace(/0+$/, "").replace(
      /\.$/,
      ".0",
    );
}

export function csvActivityRecordToIFX(
  record: PNCActivityRecord,
): PNCIfxPosting {
  // TODO: proper error handling
  const [_, m, d, y] = PNC_DATE_RE.exec(record.Date)!;

  return {
    // assume dates are in local time
    date: formatIfxDate(new Date(+y, +m - 1, +d)),
    account: "",
    status: "UNKNOWN",
    commodity: "USD",
    amount: record.Withdrawals == ""
      ? pncAmountToIfxAmount(record.Deposits, "+")
      : pncAmountToIfxAmount(record.Withdrawals, "-"),
    ext: {
      description: record.Description,
      balancePostTx: pncAmountToIfxAmount(record.Balance),
    },
  };
}

export class PNCAcitivityImporter implements IfxImporter {
  constructor() {}

  import(file: Uint8Array): PNCIfxPosting[] {
    const text = new TextDecoder("utf-8").decode(file);
    return readPNCActivity(text).map(csvActivityRecordToIFX);
  }
}
