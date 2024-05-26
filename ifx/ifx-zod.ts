import { z } from "zod";

export const AmountString = z.string().regex(
  /^[\+\-][0-9,]+.[0-9]([0-9]*[1-9])?$/,
);
export type AmountString = z.infer<typeof AmountString>;
export const CommondityString = z.string().regex(/^[A-Z]+$/);
export type CommodityString = z.infer<typeof CommondityString>;

export const ExtensionList = z.record(
  z.string().regex(/[_\-a-z][a-z0-9_\-]+/),
  z.any(),
);

export const Status = z.enum(["CLEARED", "PENDING", "VOID", "UNKNOWN"]);
export type Status = z.infer<typeof Status>;

export const PostingCore = z.object({
  /// ISO YYYY-MM-DDTHH:MM:SS[(+|-)HH:MM
  date: z.string().datetime({ offset: true }),
  amount: AmountString,
  commodity: CommondityString,
  status: Status,
  account: z.string(),
});
// A single line item on a ledger

export const postingSchema = <T extends Record<string, unknown>>(
  extSchema: z.ZodSchema<T>,
) =>
  z.object({
    date: z.string().datetime({ offset: true }),
    amount: AmountString,
    commodity: CommondityString,
    status: Status,
    account: z.string(),
    ext: extSchema,
  });

export const Posting = postingSchema(ExtensionList);

export type Posting<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  date: string;
  amount: AmountString;
  commodity: CommodityString;
  status: Status;
  account: string;
  ext: T;
};

export function postingHasExtension<
  PostingExtT extends Record<string, unknown>,
  ValidateExtT extends Record<string, unknown>,
>(
  p: Posting<PostingExtT> | Posting<PostingExtT | ValidateExtT>,
  ext: z.ZodSchema<ValidateExtT>,
): p is Posting<ValidateExtT> {
  return ext.safeParse(p.ext).success;
}
