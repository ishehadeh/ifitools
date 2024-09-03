import { z } from "zod";
import { AmountString, IfxDateModel } from "../ifx/ifx-zod.ts";

export const PayeeExtModel = z.object({
  payee: z.string(),
});

export const DescriptionExtModel = z.object({
  description: z.string(),
});

export const BalanceExtModel = z.object({
  balancePostTx: AmountString,
});

export const ClearDateExtModel = z.object({
  clearDate: IfxDateModel,
});

export const BudgetCategoryExtModel = z.object({
  budgetCategory: z.string(),
});

export type PayeeExt = z.infer<typeof PayeeExtModel>;
export type DescriptionExt = z.infer<typeof DescriptionExtModel>;
export type BalanceExt = z.infer<typeof BalanceExtModel>;

export const ProductExtModel = z.object({
  product: z.object({
    name: z.string(),
    quantity: z.object({
      amount: AmountString,
      unit: z.string(),
    }).optional()
  })
});
export type ProductExt = z.infer<typeof ProductExtModel>;
