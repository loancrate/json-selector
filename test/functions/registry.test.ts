import { evaluateJsonSelector } from "../../src/evaluate";
import { FunctionRegistry } from "../../src/functions";
import { getBuiltinFunctionProvider } from "../../src/functions/builtins";
import { ANY_TYPE, NUMBER_TYPE } from "../../src/functions/datatype";
import { arg } from "../../src/functions/validation";
import { parseJsonSelector } from "../../src/parse";

describe("FunctionRegistry", () => {
  test("register and call custom function", () => {
    const registry = new FunctionRegistry();
    registry.register({
      name: "double",
      signatures: [[arg("value", NUMBER_TYPE)]],
      handler: ({ args }) => {
        const v = args[0];
        return typeof v === "number" ? v * 2 : null;
      },
    });
    expect(registry.has("double")).toBe(true);
  });

  test("unregister custom function", () => {
    const registry = new FunctionRegistry();
    registry.register({
      name: "custom_fn",
      signatures: [[arg("value", ANY_TYPE)]],
      handler: () => null,
    });
    expect(registry.has("custom_fn")).toBe(true);
    expect(registry.unregister("custom_fn")).toBe(true);
    expect(registry.has("custom_fn")).toBe(false);
    expect(registry.unregister("custom_fn")).toBe(false);
  });

  test("custom function overrides builtin", () => {
    const registry = new FunctionRegistry();
    registry.register({
      name: "length",
      signatures: [[arg("value", ANY_TYPE)]],
      handler: () => "custom",
    });
    const fn = registry.get("length");
    expect(
      fn?.handler({
        args: [],
        context: null,
        rootContext: null,
        functionProvider: registry,
        evaluate: () => null,
      }),
    ).toBe("custom");
  });

  test("includes builtins by default", () => {
    const registry = new FunctionRegistry();
    expect(registry.has("length")).toBe(true);
    expect(registry.has("sort")).toBe(true);
  });

  test("null base provider omits builtins", () => {
    const registry = new FunctionRegistry(null);
    expect(registry.has("length")).toBe(false);
    registry.register({
      name: "custom_fn",
      signatures: [[arg("value", ANY_TYPE)]],
      handler: () => null,
    });
    expect(registry.has("custom_fn")).toBe(true);
  });
});

describe("builtin function provider", () => {
  test("has built-in functions", () => {
    const provider = getBuiltinFunctionProvider();
    expect(provider.has("length")).toBe(true);
    expect(provider.has("sort")).toBe(true);
    expect(provider.has("abs")).toBe(true);
  });
});

describe("evaluateJsonSelector overloads", () => {
  test("legacy form with rootContext and options", () => {
    const provider = getBuiltinFunctionProvider();
    const selector = parseJsonSelector("length(@)");
    expect(
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- testing legacy overload
      evaluateJsonSelector(selector, "hello", "hello", {
        functionProvider: provider,
      }),
    ).toBe(5);
  });

  test("uses default rootContext and builtin provider", () => {
    const selector = parseJsonSelector("length(@)");
    expect(evaluateJsonSelector(selector, "hello")).toBe(5);
  });

  test("partial context with only functionProvider", () => {
    const provider = getBuiltinFunctionProvider();
    const selector = parseJsonSelector("length(@)");
    expect(
      evaluateJsonSelector(selector, "hello", {
        functionProvider: provider,
      }),
    ).toBe(5);
  });

  test("partial context with only rootContext", () => {
    const selector = parseJsonSelector("length($)");
    expect(
      evaluateJsonSelector(selector, [1, 2, 3], {
        rootContext: "hello",
      }),
    ).toBe(5);
  });

  test("empty object as rootContext is treated as legacy form", () => {
    const selector = parseJsonSelector("length(keys(@))");
    expect(evaluateJsonSelector(selector, {}, {})).toBe(0);
  });
});
