import { Input, prompt } from "cliffy/prompt/mod.ts";
import { Amount } from "./prompts/Amount.ts";
import { keypress, KeyPressEvent } from "cliffy/keypress/mod.ts";
import { postingSchema } from "../ifx/ifx-zod.ts";
import { AddressExtModel, ReceiptExtModel } from "./receipt-ext.ts";
import { z } from "zod";
import { bigNumberToIfxAmount } from "./util.ts";
import BigNumber from "bignumber";
import { DatePrompt } from "./prompts/Date.ts";

const state = await prompt([{
  name: "business",
  message: "Business",
  list: true,
  type: Input,
}, {
  name: "recieptNumber",
  message: "Reciept Number",
  list: true,
  type: Input,
}, {
  name: "street",
  message: "Street",
  list: true,
  type: Input,
}, {
  name: "city",
  message: "City",
  list: true,
  type: Input,
}, {
  name: "state",
  message: "State",
  list: true,
  type: Input,
}, {
  name: "zip",
  message: "Zip",
  list: true,
  type: Input,
}, {
  name: "date",
  message: "Date",
  type: DatePrompt,
  list: true,
}]);

const postings = [];
while (true) {
  const txn = await prompt([{
    name: "product",
    message: "Product",
    type: Input,
  }, {
    name: "amount",
    message: "Amount",
    type: Amount,
  }]);
  postings.push(txn);
  console.log("q to quit");
  const event: KeyPressEvent = await keypress();
  if (event.key == "q") {
    break;
  }
}

const tax = await prompt([{
  name: "tax",
  message: "Tax",
  type: Amount,
  default: postings
    .reduce((a, b) => a.plus(b.amount!), new BigNumber(0))
    .times("0.06"),
}]);

const payments = [];
while (true) {
  const paymentInfo: { account: string; amount: BigNumber } = await prompt([{
    name: "account",
    message: "Account",
    type: Input,
  }, {
    name: "amount",
    message: "Amount",
    type: Amount,
    default: postings
      .reduce((a, b) => a.plus(b.amount!), new BigNumber(0))
      .plus(tax.tax!).minus(
        payments.reduce((a, b) => a.plus(b.amount!), new BigNumber(0)),
      ),
  }]);
  payments.push(paymentInfo);
  console.log("q to quit");
  const event: KeyPressEvent = await keypress();
  if (event.key == "q") {
    break;
  }
}

const ReceiptProductModel = postingSchema(ReceiptExtModel);
const ReceiptTaxModel = postingSchema(AddressExtModel);
const ReceiptPaymentModel = postingSchema(AddressExtModel);
type ReceiptProduct = z.infer<typeof ReceiptProductModel>;
type ReceiptTax = z.infer<typeof ReceiptTaxModel>;
type ReceiptPaymentModel = z.infer<typeof ReceiptPaymentModel>;

const ifxLineItemPosting: ReceiptProduct[] = postings.map((p) => ({
  account: "expense",
  date: state.date!,
  amount: bigNumberToIfxAmount(p.amount!),
  commodity: "USD",
  status: "CLEARED",
  ext: {
    payee: state.business!,
    product: p.product!,
    receipt: {
      receiptNumber: state.recieptNumber!,
    },
    address: {
      street: state.street,
      city: state.city!,
      state: state.state!,
      zip: state.zip!,
      country: "US",
    },
  },
}));

const ifxTaxItem: ReceiptTax[] = [{
  account: "tax",
  date: state.date!,
  amount: bigNumberToIfxAmount(tax.tax!),
  commodity: "USD",
  status: "CLEARED",
  ext: {
    address: {
      street: state.street,
      city: state.city!,
      state: state.state!,
      zip: state.zip!,
      country: "US",
    },
  },
}];

const ifxPaymentItems: ReceiptPaymentModel[] = payments.map((p) => ({
  account: p.account!,
  date: state.date!,
  amount: bigNumberToIfxAmount(p.amount!),
  commodity: "USD",
  status: "CLEARED",
  ext: {
    address: {
      street: state.street,
      city: state.city!,
      state: state.state!,
      zip: state.zip!,
      country: "US",
    },
  },
}));
Deno.writeTextFileSync(
  `${state.business}_${state.recieptNumber}.json`,
  JSON.stringify(
    [...ifxLineItemPosting, ifxTaxItem, ...ifxPaymentItems],
    undefined,
    2,
  ),
);
