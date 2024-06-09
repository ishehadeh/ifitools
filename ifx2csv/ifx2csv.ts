import { stringify } from "jsr:@std/csv";
import * as json from "https://deno.land/std@0.224.0/json/mod.ts";
import { Posting } from "../ifx/ifx-zod.ts";
import { TextLineStream } from "https://deno.land/std/streams/mod.ts";
import { ExtensionFlattener } from "./ext/common.ts";
import PayeeExtAdapter from "./ext/payee.ts";
import DescriptionExtAdapter from "./ext/description.ts";
import { encodeBase64 } from "https://deno.land/std@0.221.0/encoding/base64.ts";

export class CSVConverter<
  ExtFieldSetsT extends string[],
> {
  constructor(
    public adapters: {
      [I in keyof ExtFieldSetsT]: ExtensionFlattener<ExtFieldSetsT[I]>;
    },
  ) {
  }

  convert(
    posting: Posting,
  ): Record<
    | "date"
    | "status"
    | "account"
    | "amount"
    | "commodity"
    | ExtFieldSetsT[number],
    string
  > {
    return Object.assign({
      "date": posting.date,
      "status": posting.status,
      "amount": posting.amount,
      "commodity": posting.commodity,
      "account": posting.account,
    }, ...this.adapters.map((adapter) => adapter(posting)));
  }
}

async function main(plugin: string) {
  const root = `${import.meta.dirname}/modules`;
  const workerScript = Deno.readTextFileSync(`${root}/webworker-template.ts`)
    .replace(
      "{USERMODULE}",
      import.meta.resolve("./modules/IansExcelSheet.ts"),
    );

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

  const input = Deno.stdin.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .pipeThrough(new json.JsonParseStream());
  for await (const posting of input.values()) {
    worker.postMessage({ t: "transform", seq: seq(), data: { posting } });
  }
  done!();
  return promise;
}

await main("IansExcelSheet");
