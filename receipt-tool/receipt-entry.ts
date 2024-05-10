import { Confirm, Input, Number, prompt, Toggle } from "cliffy/prompt/mod.ts";
import { Amount } from "./prompts/Amount.ts";
import { keypress, KeyPressEvent } from "cliffy/keypress/mod.ts";
import { Posting, postingSchema } from "../ifx/ifx-zod.ts";
import { formatIfxAmount } from "../ifx/utils.ts";
import { AddressExtModel, ReceiptExtModel } from "./receipt-ext.ts";
import { bigint, z } from "zod";
import { bigNumberToIfxAmount } from "./util.ts";
// @deno-types="https://raw.githubusercontent.com/MikeMcl/bignumber.js/v9.1.2/bignumber.d.ts"
import BigNumber from "bignumber";

function suggestDate(inp: string): string[] {
  const parts = inp.split("-");
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  if (parts.length <= 1) {
    return [0, 1, 2, 3].map((x) => currentYear - x).map((x) =>
      x.toString().padStart(4, " ")
    );
  } else if (parts.length == 2) {
    let enteredYear = currentYear;
    try {
      enteredYear = parseInt(parts[0], 10);
    } catch (_e) { /* default to current year */ }
    const firstMonth = currentYear == enteredYear ? currentDate.getMonth() : 0;
    const monthSuggestions = [];
    for (let i = 0; i <= firstMonth; ++i) {
      monthSuggestions.push((firstMonth - i).toString().padStart(2, "0"));
    }
    for (let i = firstMonth + 1; i < 12; ++i) {
      monthSuggestions.push(i.toString().padStart(2, "0"));
    }

    return monthSuggestions.map((m) => [parts[0], m].join("-"));
  } else {
    const arr = [];
    for (let i = 1; i < 32; ++i) {
      arr.push(i.toString().padStart(2, "0"));
    }
    return arr.map((m) => [parts[0], parts[1], m].join("-"));
  }
}

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
  type: Input,
  list: true,
  suggestions: suggestDate,
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
  // await prompt([{
  //   name: "type",
  //   message: "Type",
  //   type: String,
  //   val,
  // }]);
  console.log("q to quit");
  const event: KeyPressEvent = await keypress();
  if (event.key == "q") {
    break;
  }
}

const ReceiptProductModel = postingSchema(ReceiptExtModel);
const ReceiptTaxModel = postingSchema(AddressExtModel);
type ReceiptProduct = z.infer<typeof ReceiptProductModel>;
type ReceiptTax = z.infer<typeof ReceiptProductModel>;

const fmtDateStr = state.date! + "T" + new Date().toISOString().split("T");

const ifxLineItemPosting: ReceiptProduct[] = postings.map((p) => ({
  account: "expense",
  date: fmtDateStr,
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
  date: fmtDateStr,
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

console.log(JSON.stringify([...ifxLineItemPosting, ifxTaxItem], undefined, 2));
