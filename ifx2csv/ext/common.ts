import { Posting } from "../../ifx/ifx-zod.ts";

export type ExtensionFlattener<T extends string> = (
  p: Posting,
) => Record<T, string>;

export type ExtensionFlattenerFields<T> = T extends (
  p: Posting,
) => Record<infer FieldsT, string> ? FieldsT
  : never;
