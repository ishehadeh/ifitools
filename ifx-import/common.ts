import { Posting } from "../ifx/ifx-zod.ts";

export interface IfxImporter {
  import(file: Uint8Array): Iterable<Posting>;
}
