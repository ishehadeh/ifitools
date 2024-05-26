import { z } from "zod";

export const PayeeExtModel = z.object({
  payee: z.string(),
});

export const DescriptionExtModel = z.object({
  description: z.string(),
});

export type PayeeExt = z.infer<typeof PayeeExtModel>;
export type DescriptionExt = z.infer<typeof DescriptionExtModel>;
