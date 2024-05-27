import { z } from "zod";
import { AmountString } from "../ifx/ifx-zod.ts";

export const PayeeExtModel = z.object({
  payee: z.string(),
});

export const DescriptionExtModel = z.object({
  description: z.string(),
});

export const BalanceExtModel = z.object({
  balancePostTx: AmountString,
});

export type PayeeExt = z.infer<typeof PayeeExtModel>;
export type DescriptionExt = z.infer<typeof DescriptionExtModel>;
export type BalanceExt = z.infer<typeof BalanceExtModel>;
