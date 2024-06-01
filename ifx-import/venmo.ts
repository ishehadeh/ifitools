import { parse } from "jsr:@std/csv";
import BigNumber from "bignumber";

export type VenmoActivityRecord = {
  id: string;
  datetime: Date;
  type: VenmoTransactionType;
  status: VenmoTransactionStatus;
  note: string;
  from: string;
  to: string;
  amountTotal: VenmoAmount;
  amountTip: VenmoAmount | undefined;
  amountTax: VenmoAmount | undefined;
  amountFee: VenmoAmount | undefined;
  taxRate: BigNumber | undefined;
  taxExempt: boolean;
  destination: string;
  fundingSource: string;
  terminalLocation: string;
};

export type VenmoActivity = {
  username: string;
  periodStart: Date;
  periodEnd: Date;
  balanceEnd: VenmoAmount;
  balanceStart: VenmoAmount;
  ytdVenmoFees: VenmoAmount;
  statementVenmoFees: VenmoAmount;
  activity: VenmoActivityRecord[];
};

export type VenmoAmount = {
  currency: string;
  quantity: BigNumber;
};

const MONTH_NAME_PREFIX: string[] = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export enum VenmoTransactionType {
  Payment = "Payment",
  Charge = "Charge",
  TransferInstant = "Instant Transfer",
  TransferStandard = "Standard Transfer",
}

export enum VenmoTransactionStatus {
  Issued = "Issued",
  Complete = "Complete",
  Failed = "Failed",
}

export function parseVenmoTransactionType(
  typeString: string,
): VenmoTransactionType {
  switch (typeString.toLowerCase().replace(/\s+/, "")) {
    case "payment":
      return VenmoTransactionType.Payment;
    case "charge":
      return VenmoTransactionType.Charge;
    case "instanttransfer":
      return VenmoTransactionType.TransferInstant;
    case "standardtransfer":
      return VenmoTransactionType.TransferStandard;
    default:
      throw new TypeError("unknown venmo transaction type: " + typeString);
  }
}

export function parseVenmoTransactionStatus(
  statusString: string,
): VenmoTransactionStatus {
  switch (statusString.toLowerCase()) {
    case "issued":
      return VenmoTransactionStatus.Issued;
    case "complete":
      return VenmoTransactionStatus.Complete;
    case "failed":
      return VenmoTransactionStatus.Failed;
    default:
      throw new TypeError("unknown venmo transaction status: " + statusString);
  }
}

export function parseVenmoAmount(
  amtString: string | "",
): VenmoAmount | undefined {
  if (amtString === "") return undefined;

  const RE_AMOUNT = /(\+|\-)?\s*([^0-9]*)([0-9]+(\.[0-9]+)?)([^0-9]*)/;
  const [_, sign, currencyLhs, quantity, _dec, currencyRhs] = RE_AMOUNT.exec(
    amtString,
  )!;

  return {
    quantity: BigNumber(quantity).multipliedBy(sign == "-" ? -1 : 1),
    currency: currencyLhs == "" ? currencyRhs : currencyLhs,
  };
}

export function adaptVenmoActivityRecord(
  [
    _documentTitle,
    id,
    datetime,
    type,
    status,
    note,
    from,
    to,
    amtTotal,
    amtTip,
    amtTax,
    amtFee,
    taxRate,
    taxExempt,
    fundingSource,
    destination,
    _beginningBalance,
    _endingBalance,
    _statementVenmoFees,
    terminalLocation,
    _ytdVenmoFees,
    _disclaimer,
  ]: string[],
): VenmoActivityRecord {
  const RE_DATETIME = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
  const [_, y, m, d, hr, min, sec] = RE_DATETIME.exec(datetime)!.map((x) => +x);
  return {
    id,
    datetime: new Date(y, m - 1, d, hr, min, sec),
    type: parseVenmoTransactionType(type),
    status: parseVenmoTransactionStatus(status),
    note,
    from,
    to,
    amountTotal: parseVenmoAmount(amtTotal)!,
    amountTip: parseVenmoAmount(amtTip),
    amountTax: parseVenmoAmount(amtTax),
    amountFee: parseVenmoAmount(amtFee),
    taxRate: taxRate === "" ? undefined : BigNumber(taxRate),
    taxExempt: taxExempt !== "",
    fundingSource,
    destination,
    terminalLocation,
  };
}

export function readVenmoActivityCSV(
  csvData: string,
): VenmoActivity {
  // Example venmo CSV preable:
  //
  // Account Statement - (@Ian-Shehadeh) - April 30th to June 1st 2024 ,,,,,,,,,,,,,,,,,,,,,
  // Account Activity,,,,,,,,,,,,,,,,,,,,,
  // ,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip),Amount (tax),Amount (fee),Tax Rate,Tax Exempt,Funding Source,Destination,Beginning Balance,Ending Balance,Statement Period Venmo Fees,Terminal Location,Year to Date Venmo Fees,Disclaimer

  const RE_STATEMENT_HEADER =
    /Account Statement\s+-\s+\(@([A-Za-z_0-9\-]+)\)\s+-\s+([a-zA-Z]+)\s+([0-9]+)[a-z]+\s+to\s+([a-zA-Z]+)\s+([0-9]+)[a-z]+\s+([0-9]+)/;

  const venmoActivityRows = parse(csvData);
  const [
    accountStatementHeader,
    accountActivityHeader,
    _headerRow,
    beginningBalance,
    ...activityCsvRows
  ] = venmoActivityRows;

  // validate the two title rows.
  const [
    _,
    username,
    startMonth,
    startDayOfMonth,
    endMonth,
    endDayOfMonth,
    endYear,
  ] = RE_STATEMENT_HEADER.exec(accountStatementHeader[0])!;

  if (accountActivityHeader[0] != "Account Activity") {
    throw new Error(
      "unexpected input, second line of venmo statement should have 'Account Activity' in first field",
    );
  }

  // Determine time range.
  const startMonthIndex = MONTH_NAME_PREFIX.indexOf(
    startMonth.slice(0, 3).toLowerCase(),
  );
  const endMonthIndex = MONTH_NAME_PREFIX.indexOf(
    endMonth.slice(0, 3).toLowerCase(),
  );
  const endYearNum = +endYear;
  const startYearNum = startMonthIndex < endMonthIndex
    ? endYearNum
    : endYearNum - 1;
  const periodStart = new Date(startYearNum, startMonthIndex, +startDayOfMonth);
  const periodEnd = new Date(startYearNum, startMonthIndex, +endDayOfMonth);

  const activity = activityCsvRows.slice(0, -1).map(adaptVenmoActivityRecord);
  const [
    endingBalance,
    statementVenmoFees,
    _terminalLocation,
    ytdVenmoFees,
    _disclaimer,
  ] = activityCsvRows[activityCsvRows.length - 1].slice(-5);

  return {
    username,
    periodStart,
    periodEnd,
    activity,
    balanceStart: parseVenmoAmount(beginningBalance[16])!,
    balanceEnd: parseVenmoAmount(endingBalance)!,
    statementVenmoFees: parseVenmoAmount(statementVenmoFees)!,
    ytdVenmoFees: parseVenmoAmount(ytdVenmoFees)!,
  };
}

console.log(
  JSON.stringify(readVenmoActivityCSV(Deno.readTextFileSync(Deno.args[0]))),
);
