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

  execute(program: Iterable<Value>) {
    for (const v of program) {
      this.executionStep(v);
    }
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

  doSymbol(symbol: string) {
    const value = this.registers[symbol];
    if (value === undefined) {
      throw new IFExprErrorUndefinedSymbol(symbol);
    }

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
env.setAll({
  "dbg": ffi((env) => {
    console.log(env.get(0));
  }),
  "sum": makeSimpleArithFn("add", (x, y) => x + y, (x, y) => x.plus(y)),
  "product": makeSimpleArithFn("mul", (x, y) => {
    throw new Error("type error");
  }, (x, y) => x.plus(y)),
  "divide": makeSimpleArithFn("div", (x, y) => {
    throw new Error("type error");
  }, (x, y) => x.dividedBy(y)),
  "subtract": makeSimpleArithFn("div", (x, y) => {
    throw new Error("type error");
  }, (x, y) => x.minus(y)),
});

const program = stack(
  tokenize("{1 2 3} product dbg"),
);
env.execute(program);
