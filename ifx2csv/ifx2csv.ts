import { stringify } from "jsr:@std/csv";
import * as json from "https://deno.land/std@0.224.0/json/mod.ts";
import { TextLineStream } from "https://deno.land/std@0.224.0/streams/mod.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { basename } from "https://deno.land/std@0.224.0/path/basename.ts";
import { join } from "https://deno.land/std@0.224.0/path/join.ts";
import { Command } from "cliffy/command/mod.ts";

await new Command()
  .name("ifx2csv")
  .version("0.1.0")
  .description("Convert various things to IFX")
  .option("-a,--adapter <name:string>", "file type to import", {
    required: true,
  })
  .arguments("[input:string]")
  .action(({ adapter }, file) => main(adapter, file))
  .parse(Deno.args);

async function main(plugin: string, file?: string) {
  const pluginKw: Record<string, string> = {};

  // TODO: verify this module is local
  const defaultPluginPath = new URL(import.meta.resolve("./modules")).pathname;
  try {
    for (const module of Deno.readDirSync(defaultPluginPath)) {
      if (module.isFile && module.name.endsWith(".ts")) {
        pluginKw[basename(module.name, ".ts")] = join(
          defaultPluginPath,
          module.name,
        );
      }
    }
  } catch (e) {
    console.warn(`could not discover default plugins: ${e}`);
  }

  let pluginPath = pluginKw[plugin] ?? plugin;
  if (!/^[a-zA-Z]+:\/\//.test(pluginPath)) {
    pluginPath = `file://${pluginPath}`;
  }

  const workerScript = Deno.readTextFileSync(
    new URL(import.meta.resolve("./modules/webworker-template.ts")).pathname,
  )
    .replace("{USERMODULE}", pluginPath);

  const worker = new Worker(
    "data:application/javascript;charset=utf-8;base64," +
      encodeBase64(workerScript),
    {
      type: "module",

      "deno": {
        "permissions": "none",
      },
    },
  );

  const responseMap: Map<number, boolean> = new Map();
  const seq =
    () => (responseMap.set(responseMap.size, false), responseMap.size - 1);
  const resolveMsg = (seqNo: number) => responseMap.set(seqNo, true);
  let headers: string[];
  let done: () => void;
  const promise: Promise<void> = new Promise((resolve, reject) => {
    const lines: Map<number, string[]> = new Map();
    let allSent = false;
    const tryComplete = () => {
      if (allSent && [...responseMap.values()].reduce((a, b) => a && b)) {
        console.log(
          stringify(
            [...lines.entries()]
              .toSorted(([a, _0], [b, _1]) => a - b)
              .map(([_, a]) => a),
            { columns: headers!, headers: true },
          ),
        );

        worker.terminate();
        resolve();
      }
    };
    done = () => {
      allSent = true;
      tryComplete();
    };
    worker.onmessage = ({ data }) => {
      switch (data.t) {
        case "headers.resp": {
          headers = data.data.headers;
          break;
        }
        case "transform.resp": {
          lines.set(data.seq, data.data.columns as string[]);
          break;
        }
        default:
          reject(new Error(`unknown message type: ${data.t}`));
          return;
      }

      resolveMsg(data.seq);
      tryComplete();
    };
  });

  worker.postMessage({ t: "headers", seq: seq(), data: null });

  const inputRaw = file ? await Deno.open(file) : Deno.stdin;
  const input = inputRaw.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .pipeThrough(new json.JsonParseStream());
  for await (const posting of input.values()) {
    worker.postMessage({ t: "transform", seq: seq(), data: { posting } });
  }
  done!();
  return promise;
}
