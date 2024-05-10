import { z } from "zod";

export const ProductExtModel = z.object({
  product: z.string(),
});

export const PayeeExtModel = z.object({
  payee: z.string(),
});

export const AddressExtModel = z.object({
  address: z.object({
    city: z.string(),
    street: z.string().optional(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
});

export const ReceiptMetaExtModel = z.object({
  receipt: z.object({
    receiptNumber: z.string(),
  }),
});

export const ReceiptExtModel = z.union([
  PayeeExtModel,
  ProductExtModel,
  AddressExtModel,
  ReceiptMetaExtModel,
]);
