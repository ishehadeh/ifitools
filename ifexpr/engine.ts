import { stack, tokenize, Value } from "./parse.ts";
import BigNumber from "bignumber";

export class IFExprError extends Error {
}
export class IFExprErrorUndefinedSymbol extends IFExprError {
  constructor(public readonly symbol: string) {
    super(`undefined symbol: ${symbol}`);
  }
}

export class IFExprExternalError extends IFExprError {
  constructor(public readonly exception: Error) {
    super(`error in call to external function: ${exception}`, exception);
  }
}

export enum IFExprStackCellType {
  Executable,
  External,
  Value,
}

export type IFExprStackCell =
  | { t: IFExprStackCellType.Executable; program: Value[] }
  | {
    t: IFExprStackCellType.External;
    fn: (env: IFExprEnv) => void;
  }
  | { t: IFExprStackCellType.Value; value: Value[] };

export class IFExprEnv {
  private stack: Value[] = [];
  private registers: Record<string, IFExprStackCell> = {};

  constructor(private parent: IFExprEnv | undefined = undefined) {}

  execute(program: Iterable<Value>) {
    for (const v of program) {
      this.executionStep(v);
    }
  }

  child(): IFExprEnv {
    return new IFExprEnv(this);
  }

  set(symbol: string, value: IFExprStackCell) {
    this.registers[symbol] = value;
  }

  setAll(registers: Record<string, IFExprStackCell>) {
    this.registers = Object.assign(this.registers, registers);
  }

  call(fnName: string, ...args: Value[]) {
    args.forEach((x) => this.push(x));
    this.doSymbol(fnName);
  }

  push(cell: Value) {
    this.stack.push(cell);
  }

  pop(): Value | undefined {
    return this.stack.pop();
  }

  get(index: number): Value {
    return this.stack[index];
  }

  executionStep(value: Value) {
    // TODO: proper type narrowing function for value
    switch (true) {
      case value instanceof BigNumber:
        this.push([value]);
        break;
      case Array.isArray(value):
        this.push(value);
        break;
      case typeof value === "string":
        this.doSymbol(value);
    }
  }

  getSymbol(symbol: string): IFExprStackCell {
    const value = this.registers[symbol];
    if (value === undefined) {
      if (this.parent) {
        return this.parent.getSymbol(symbol);
      }
      throw new IFExprErrorUndefinedSymbol(symbol);
    }
    return value;
  }

  doSymbol(symbol: string) {
    const value = this.getSymbol(symbol);

    switch (value.t) {
      case IFExprStackCellType.Executable:
        this.execute(value.program);
        break;
      case IFExprStackCellType.External:
        try {
          value.fn(this);
        } catch (e) {
          throw new IFExprExternalError(e);
        }
        break;
      case IFExprStackCellType.Value:
        this.push(value.value);
        break;
    }
  }
}

export function ffi(
  fn: (env: IFExprEnv) => void,
): IFExprStackCell {
  return { t: IFExprStackCellType.External, fn };
}

function makeSimpleArithFn(
  name: string,
  opStr: (x: string, y: string) => string,
  opNum: (x: BigNumber, y: BigNumber) => BigNumber,
): IFExprStackCell {
  return ffi((env) => {
    const a = env.pop()!;
    if (!Array.isArray(a)) {
      throw new Error("type error");
    }

    let result = a[0];
    for (let index = 1; index < a.length; ++index) {
      const x = a[index];
      if (typeof x !== typeof result) {
        throw new Error("type error");
      }
      if (Array.isArray(x)) {
        if (!Array.isArray(result)) {
          throw new Error("type error");
        }

        if (result.length != x.length) {
          throw new Error("dim error");
        }

        result = result.map((v, i) => {
          env.call(name, [v, x[i]]);
          return env.pop()!;
        });
      } else if (x instanceof BigNumber) {
        if (!(result instanceof BigNumber)) {
          throw new Error("type error");
        }
        result = opNum(result, x);
      } else {
        if (typeof result !== "string") {
          throw new Error("type error");
        }
        result = opStr(result, x);
      }
    }
    env.push(result);
  });
}

const env = new IFExprEnv();
let COUNTER = 0;
function getNumber(): number {
  return COUNTER++;
}
env.setAll({
  "dbg": ffi((env) => {
    console.log(env.get(0));
  }),
  "sum": makeSimpleArithFn("sum", (x, y) => x + y, (x, y) => x.plus(y)),
  "product": makeSimpleArithFn("product", (x, y) => {
    throw new Error("type error");
  }, (x, y) => x.multipliedBy(y)),
  "divide": makeSimpleArithFn("divide", (x, y) => {
    throw new Error("type error");
  }, (x, y) => x.dividedBy(y)),
  "subtract": makeSimpleArithFn("subtract", (x, y) => {
    throw new Error("type error");
  }, (x, y) => x.minus(y)),
  "do": ffi((env) => {
    const block = env.pop();
    const sym = `__do${getNumber()}`;
    env.set(
      sym,
      ffi((env) => {
        if (!Array.isArray(block)) {
          throw new Error("expected block");
        }
        env.execute(block);
      }),
    );
    env.push(sym);
  }),
  "let": ffi((env) => {
    let pair;
    const child = env.child();
    while (true) {
      pair = env.pop();
      if (typeof pair === "string") {
        child.doSymbol(pair);
        for (let v = child.pop(); v !== undefined; v = child.pop()) {
          env.push(v);
        }
        break;
      }
      if (!Array.isArray(pair)) {
        throw new Error("let: expected quoted pair");
      }
      if (!(typeof pair[1] == "string")) {
        throw new Error("let: expected string-value pair");
      }
      child.set(pair[1], { t: IFExprStackCellType.Value, value: [pair[0]] });
    }
  }),
});

const program = stack(
  tokenize("dbg let { ac {1 2 3 4}} do { product dbg ac }"),
);
env.execute(program);
