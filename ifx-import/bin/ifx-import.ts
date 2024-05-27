#!/bin/env -S deno run --ext=ts --
import { PNCAcitivityImporter } from "../pnc/pnc-activity.ts";
import { Command, EnumType } from "cliffy/command/mod.ts";
import { readAllSync } from "jsr:@std/io/read-all";

enum Importer {
  PncActivity = "pnc-activity",
}

const IMPORTERS = {
  [Importer.PncActivity]: PNCAcitivityImporter,
} as const;

await new Command()
  .name("ifx-import")
  .version("0.1.0")
  .description("Convert various things to IFX")
  .type("importer", new EnumType(Importer))
  .option("-I,--importer <name:importer>", "file type to import", {
    required: true,
  })
  .arguments("[input:string]")
  .action(({ importer }, file) => runImporter(importer, file))
  .parse(Deno.args);

function runImporter(importerName: Importer, file?: string) {
  let data: Uint8Array;
  if (file === undefined || file == "-") {
    data = readAllSync(Deno.stdin);
  } else {
    data = Deno.readFileSync(file);
  }

  const importer = new IMPORTERS[importerName]();
  for (const result of importer.import(data)) {
    console.log(JSON.stringify(result));
  }
}
