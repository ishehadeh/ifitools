import { DescriptionExtModel } from "../../ifx-ext/mod.ts";
import { Posting, postingHasExtension } from "../../ifx/ifx-zod.ts";

export default ((
  posting: Posting,
): Record<"description", string> => {
  if (postingHasExtension(posting, DescriptionExtModel)) {
    return { description: posting.ext.description };
  } else {
    return { description: "" };
  }
});
