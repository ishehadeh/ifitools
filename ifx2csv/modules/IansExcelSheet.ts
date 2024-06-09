import {
  BudgetCategoryExtModel,
  DescriptionExtModel,
  PayeeExtModel,
} from "../../ifx-ext/mod.ts";
import { mapExt, Posting } from "../../ifx/ifx-zod.ts";

export const HEADERS = [
  "Date",
  "Amount",
  "Payee",
  "Account",
  "Category",
  "Description",
] as const;
export function transform(p: Posting): Record<typeof HEADERS[number], string> {
  return {
    "Date": p.date.replace(/T.*$/, ""),
    "Amount": p.amount,
    "Payee": mapExt(p, PayeeExtModel, (e) => e.payee) ?? "",
    "Account": p.account,
    "Category": mapExt(p, BudgetCategoryExtModel, (e) => e.budgetCategory) ??
      "",
    "Description": mapExt(p, DescriptionExtModel, (e) => e.description) ?? "",
  };
}
