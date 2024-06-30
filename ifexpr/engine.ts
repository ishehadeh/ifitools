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

const env = new IFExprEnv();
env.setAll({
  "dbg": ffi((env) => {
    console.log(env.get(0));
  }),
  "prod": ffi((env) => {
    const a = env.pop()!;
    if (!Array.isArray(a)) {
      throw new Error("type error");
    }

    let result = BigNumber("0");
    for (const x of a) {
      if (!(x instanceof BigNumber)) {
        throw new Error("type error");
      }
      result = result.multipliedBy(x);
    }
    env.push(result);
  }),
  "add": ffi((env) => {
    const a = env.pop()!;
    if (!Array.isArray(a)) {
      throw new Error("type error");
    }

    let result = BigNumber("0");
    for (const x of a) {
      if (!(x instanceof BigNumber)) {
        throw new Error("type error");
      }
      result = result.plus(x);
    }
    env.push(result);
  }),
});

const program = stack(tokenize("{1 2 3} add dbg"));
env.execute(program);
