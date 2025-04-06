// this is a receipt scanning service.
// it's built on doctr and postgresql

/// Receipts are a record of items bought.
export class Receipt {
  date: Temporal.ZonedDateTime
  transactionId: string;
  paymentInfo: PaymentInfo;
}

export type PaymentInfo = {
  type: "cash"
} | {
  type: "card";
  cardType: "visa" | "mastercard";
  name: string;
  accountNumber: string;
}
