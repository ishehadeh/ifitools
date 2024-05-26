import { PayeeExtModel } from "../../ifx-ext/mod.ts";
import { Posting, postingHasExtension } from "../../ifx/ifx-zod.ts";

export default function (posting: Posting): Record<"payee", string> {
  if (postingHasExtension(posting, PayeeExtModel)) {
    return { payee: posting.ext.payee };
  } else {
    return { payee: "" };
  }
}
