import assert from "node:assert/strict";
import { getBuiltinFunctionProvider } from "../../src/functions/builtins";
import { makeExpressionRef } from "../../src/functions/datatype";
import { FunctionProvider } from "../../src/functions/provider";
import { InvalidArgumentTypeError } from "../../src/functions/validation";
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

describe("array functions", () => {
  test("sort numbers", () => {
    expect(evaluate("sort(@)", [10, 3, 1, 2])).toStrictEqual([1, 2, 3, 10]);
  });

  test("sort strings", () => {
    expect(evaluate("sort(@)", ["c", "a", "b"])).toStrictEqual(["a", "b", "c"]);
  });

  test("sort uses codepoint ordering (uppercase before lowercase)", () => {
    // Codepoint: B=66, Z=90, a=97, b=98
    // localeCompare would typically sort case-insensitively: a, B, b, Z
    expect(evaluate("sort(@)", ["a", "B", "b", "Z"])).toStrictEqual([
      "B",
      "Z",
      "a",
      "b",
    ]);
  });

  test("sort empty", () => {
    expect(evaluate("sort(@)", [])).toStrictEqual([]);
  });

  test("sort_by", () => {
    const data = [
      { name: "d", age: 10 },
      { name: "c", age: 3 },
      { name: "a", age: 1 },
      { name: "b", age: 2 },
    ];
    expect(evaluate("sort_by(@, &age)", data)).toStrictEqual([
      { name: "a", age: 1 },
      { name: "b", age: 2 },
      { name: "c", age: 3 },
      { name: "d", age: 10 },
    ]);
  });

  test("sort_by with strings", () => {
    const data = [{ name: "charlie" }, { name: "alice" }, { name: "bob" }];
    expect(evaluate("sort_by(@, &name)", data)).toStrictEqual([
      { name: "alice" },
      { name: "bob" },
      { name: "charlie" },
    ]);
  });

  test("sort_by uses codepoint ordering", () => {
    const data = [{ name: "banana" }, { name: "Apple" }, { name: "cherry" }];
    // Codepoint: A=65 < b=98 < c=99
    expect(evaluate("sort_by(@, &name)", data)).toStrictEqual([
      { name: "Apple" },
      { name: "banana" },
      { name: "cherry" },
    ]);
  });

  test("sort_by is stable (equal keys preserve original order)", () => {
    const data = [
      { name: "c", group: 1 },
      { name: "a", group: 1 },
      { name: "b", group: 1 },
    ];
    expect(evaluate("sort_by(@, &group)", data)).toStrictEqual([
      { name: "c", group: 1 },
      { name: "a", group: 1 },
      { name: "b", group: 1 },
    ]);
  });

  test("sort_by empty array", () => {
    expect(evaluate("sort_by(@, &name)", [])).toStrictEqual([]);
  });

  test("sort_by throws when expression evaluates to null", () => {
    expect(() =>
      evaluate("sort_by(@, &missing)", [{ a: 1 }, { a: 2 }]),
    ).toThrow(InvalidArgumentTypeError);
  });

  test("min_by", () => {
    const data = [
      { name: "b", age: 2 },
      { name: "a", age: 1 },
      { name: "c", age: 3 },
    ];
    expect(evaluate("min_by(@, &age)", data)).toStrictEqual({
      name: "a",
      age: 1,
    });
  });

  test("min_by with strings", () => {
    const data = [{ name: "charlie" }, { name: "alice" }, { name: "bob" }];
    expect(evaluate("min_by(@, &name)", data)).toStrictEqual({
      name: "alice",
    });
  });

  test("min_by uses codepoint ordering (uppercase < lowercase)", () => {
    const data = [{ name: "banana" }, { name: "Apple" }];
    // Codepoint: A=65 < b=98, so "Apple" is min
    expect(evaluate("min_by(@, &name)", data)).toStrictEqual({
      name: "Apple",
    });
  });

  test("min_by empty array", () => {
    expect(evaluate("min_by(@, &name)", [])).toBeNull();
  });

  test("max_by", () => {
    const data = [
      { name: "b", age: 2 },
      { name: "a", age: 1 },
      { name: "c", age: 3 },
    ];
    expect(evaluate("max_by(@, &age)", data)).toStrictEqual({
      name: "c",
      age: 3,
    });
  });

  test("max_by with strings", () => {
    const data = [{ name: "charlie" }, { name: "alice" }, { name: "bob" }];
    expect(evaluate("max_by(@, &name)", data)).toStrictEqual({
      name: "charlie",
    });
  });

  test("max_by uses codepoint ordering (lowercase > uppercase)", () => {
    const data = [{ name: "Zebra" }, { name: "apple" }];
    // Codepoint: Z=90 < a=97, so "apple" is max
    expect(evaluate("max_by(@, &name)", data)).toStrictEqual({
      name: "apple",
    });
  });

  test("max_by empty array", () => {
    expect(evaluate("max_by(@, &name)", [])).toBeNull();
  });

  test("keys", () => {
    expect(evaluate("keys(@)", { a: 1, b: 2 })).toStrictEqual(["a", "b"]);
  });

  test("values", () => {
    expect(evaluate("values(@)", { a: 1, b: 2 })).toStrictEqual([1, 2]);
  });

  test("merge", () => {
    expect(evaluate('merge(@, `{"c": 3}`)', { a: 1, b: 2 })).toStrictEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  test("not_null", () => {
    expect(evaluate("not_null(a, b, c)", { a: null, b: null, c: 3 })).toBe(3);
    expect(evaluate("not_null(a, b)", { a: null, b: null })).toBeNull();
  });

  test("group_by", () => {
    const data = [
      { name: "a", type: "x" },
      { name: "b", type: "y" },
      { name: "c", type: "x" },
    ];
    expect(evaluate("group_by(@, &type)", data)).toStrictEqual({
      x: [
        { name: "a", type: "x" },
        { name: "c", type: "x" },
      ],
      y: [{ name: "b", type: "y" }],
    });
  });

  test("group_by skips null keys", () => {
    const data = [
      { name: "a", type: "x" },
      { name: "b" },
      { name: "c", type: "x" },
    ];
    expect(evaluate("group_by(@, &type)", data)).toStrictEqual({
      x: [
        { name: "a", type: "x" },
        { name: "c", type: "x" },
      ],
    });
  });

  test("group_by throws on non-string keys", () => {
    const data = [
      { name: "a", type: "x" },
      { name: "b", type: 42 },
    ];
    expect(() => evaluate("group_by(@, &type)", data)).toThrow(
      /must evaluate to string or null/,
    );
  });

  test("items", () => {
    expect(evaluate("items(@)", { a: 1, b: 2 })).toStrictEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  test("from_items", () => {
    expect(
      evaluate("from_items(@)", [
        ["one", 1],
        ["two", 2],
      ]),
    ).toStrictEqual({ one: 1, two: 2 });
  });

  test("from_items with duplicate keys (last wins)", () => {
    expect(
      evaluate("from_items(@)", [
        ["one", 1],
        ["two", 2],
        ["one", 3],
      ]),
    ).toStrictEqual({ one: 3, two: 2 });
  });

  test("from_items throws on non-array entry", () => {
    expect(() => evaluate("from_items(@)", [["a", 1], "not-array"])).toThrow(
      /each array element must be a \[string, value\] pair/,
    );
  });

  test("from_items throws on non-string key", () => {
    expect(() =>
      evaluate("from_items(@)", [
        ["a", 1],
        [42, 2],
      ]),
    ).toThrow(/each array element must be a \[string, value\] pair/);
  });

  test("from_items throws on wrong-length pair", () => {
    expect(() => evaluate("from_items(@)", [["a", 1], ["x"]])).toThrow(
      /each array element must be a \[string, value\] pair/,
    );
  });

  test("zip", () => {
    expect(
      evaluate("zip(a, b)", { a: [1, 2, 3], b: ["a", "b", "c"] }),
    ).toStrictEqual([
      [1, "a"],
      [2, "b"],
      [3, "c"],
    ]);
  });

  test("zip with uneven lengths", () => {
    expect(
      evaluate("zip(a, b)", { a: [1, 2], b: ["a", "b", "c"] }),
    ).toStrictEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  test("map", () => {
    const data = [
      { name: "a", age: 1 },
      { name: "b", age: 2 },
    ];
    expect(evaluate("map(&name, @)", data)).toStrictEqual(["a", "b"]);
  });
});

describe("array handler defensive guards", () => {
  test("sort returns empty array for non-array", () => {
    expect(callHandler("sort", ["str"])).toStrictEqual([]);
  });

  test("sort number comparator guard with mixed types", () => {
    expect(callHandler("sort", [[1, "mixed"]])).toBeDefined();
  });

  test("sort string comparator guard with mixed types", () => {
    expect(callHandler("sort", [["a", 42]])).toBeDefined();
  });

  test("sort_by returns empty array for invalid args", () => {
    expect(callHandler("sort_by", ["str", "not-expref"])).toStrictEqual([]);
  });

  test("min_by returns null for invalid args", () => {
    expect(callHandler("min_by", ["str", "not-expref"])).toBeNull();
  });

  test("max_by returns null for invalid args", () => {
    expect(callHandler("max_by", ["str", "not-expref"])).toBeNull();
  });

  test("keys returns empty array for array or non-object", () => {
    expect(callHandler("keys", [[1, 2]])).toStrictEqual([]);
  });

  test("values returns empty array for array or non-object", () => {
    expect(callHandler("values", [[1, 2]])).toStrictEqual([]);
  });

  test("merge skips non-object args", () => {
    expect(callHandler("merge", [42])).toStrictEqual({});
  });

  test("group_by returns empty object for invalid args", () => {
    expect(callHandler("group_by", ["str", "not-expref"])).toStrictEqual({});
  });

  test("items returns empty array for non-object", () => {
    expect(callHandler("items", [[1, 2]])).toStrictEqual([]);
  });

  test("from_items returns empty object for non-array", () => {
    expect(callHandler("from_items", ["str"])).toStrictEqual({});
  });

  test("zip returns empty for non-array args", () => {
    expect(callHandler("zip", ["str"])).toStrictEqual([]);
  });

  test("zip returns empty for no args", () => {
    expect(callHandler("zip", [])).toStrictEqual([]);
  });

  test("map returns empty array for invalid args", () => {
    expect(callHandler("map", ["not-expref", [1, 2]])).toStrictEqual([]);
  });

  test("validateExpressionKeys returns number for empty array", () => {
    const fn = provider.get("sort_by");
    assert(fn);
    const expref = makeExpressionRef({
      type: "identifier" as const,
      id: "x",
    });
    expect(
      fn.handler({
        args: [[], expref],
        context: null,
        rootContext: null,
        functionProvider: provider,
        evaluate: () => null,
      }),
    ).toStrictEqual([]);
  });

  test("sort_by number comparator guard with inconsistent evaluate", () => {
    const fn = provider.get("sort_by");
    assert(fn);
    const expref = makeExpressionRef({
      type: "identifier" as const,
      id: "x",
    });
    let callCount = 0;
    const fakeEvaluate = () => {
      callCount++;
      // Return numbers for first 3, then a string on the 4th to trigger the guard
      return callCount <= 3 ? callCount : "str";
    };
    expect(() =>
      fn.handler({
        args: [["a", "b", "c", "d"], expref],
        context: null,
        rootContext: null,
        functionProvider: provider,
        evaluate: fakeEvaluate,
      }),
    ).toThrow(InvalidArgumentTypeError);
  });

  test("sort_by string comparator guard with inconsistent evaluate", () => {
    const fn = provider.get("sort_by");
    assert(fn);
    const expref = makeExpressionRef({
      type: "identifier" as const,
      id: "x",
    });
    let callCount = 0;
    const fakeEvaluate = () => {
      callCount++;
      // Return strings for first 3, then a number on the 4th to trigger the guard
      return callCount <= 3 ? `key${callCount}` : 42;
    };
    expect(() =>
      fn.handler({
        args: [["a", "b", "c", "d"], expref],
        context: null,
        rootContext: null,
        functionProvider: provider,
        evaluate: fakeEvaluate,
      }),
    ).toThrow(InvalidArgumentTypeError);
  });
});
