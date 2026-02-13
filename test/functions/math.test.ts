import assert from "node:assert/strict";
import { getBuiltinFunctionProvider } from "../../src/functions/builtins";
import { FunctionProvider } from "../../src/functions/provider";
import { evaluate } from "../helpers";

const provider: FunctionProvider = getBuiltinFunctionProvider();

function callHandler(name: string, args: unknown[]): unknown {
  const fn = provider.get(name);
  assert(fn);
  return fn.handler({
    args,
    context: null,
    rootContext: null,
    functionProvider: provider,
    evaluate: () => null,
  });
}

describe("math functions", () => {
  test("abs", () => {
    expect(evaluate("abs(@)", -5)).toBe(5);
    expect(evaluate("abs(@)", 5)).toBe(5);
  });

  test("ceil", () => {
    expect(evaluate("ceil(@)", 1.3)).toBe(2);
  });

  test("floor", () => {
    expect(evaluate("floor(@)", 1.7)).toBe(1);
  });

  test("sum", () => {
    expect(evaluate("sum(@)", [1, 2, 3])).toBe(6);
  });

  test("avg", () => {
    expect(evaluate("avg(@)", [1, 2, 3])).toBe(2);
    expect(evaluate("avg(@)", [])).toBeNull();
  });

  test("min of numbers", () => {
    expect(evaluate("min(@)", [3, 1, 2])).toBe(1);
  });

  test("min of strings", () => {
    expect(evaluate("min(@)", ["c", "a", "b"])).toBe("a");
  });

  test("min of empty array", () => {
    expect(evaluate("min(@)", [])).toBeNull();
  });

  test("max of numbers", () => {
    expect(evaluate("max(@)", [1, 3, 2])).toBe(3);
  });

  test("max of strings", () => {
    expect(evaluate("max(@)", ["a", "c", "b"])).toBe("c");
  });
});

describe("math handler defensive guards", () => {
  test("abs returns 0 for non-number", () => {
    expect(callHandler("abs", ["str"])).toBe(0);
  });

  test("ceil returns 0 for non-number", () => {
    expect(callHandler("ceil", ["str"])).toBe(0);
  });

  test("floor returns 0 for non-number", () => {
    expect(callHandler("floor", ["str"])).toBe(0);
  });

  test("sum returns 0 for non-array", () => {
    expect(callHandler("sum", ["str"])).toBe(0);
  });

  test("avg returns null for non-array", () => {
    expect(callHandler("avg", ["str"])).toBeNull();
  });

  test("sum skips non-number elements", () => {
    expect(callHandler("sum", [[1, "skip", 2]])).toBe(3);
  });

  test("avg skips non-number elements in sum but counts all", () => {
    expect(callHandler("avg", [[1, "skip", 2]])).toBe(1);
  });

  test("min with mixed types", () => {
    expect(callHandler("min", [[1, "a"]])).toBe(1);
  });

  test("max with mixed types", () => {
    expect(callHandler("max", [[1, "a"]])).toBe(1);
  });
});
