import { Posting } from "../ifx/ifx-zod.ts";

export interface IfxImporter {
  import(file: Uint8Array): Iterable<Posting>;
}

export interface IfxImporterAsync {
  import(file: Uint8Array): Promise<Iterable<Posting>>;
}
