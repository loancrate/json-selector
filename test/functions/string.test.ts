import assert from "node:assert/strict";
import { getBuiltinFunctionProvider } from "../../src/functions/builtins";
import { FunctionProvider } from "../../src/functions/provider";
import { InvalidArgumentValueError } from "../../src/functions/validation";
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

describe("string functions", () => {
  test("length of array", () => {
    expect(evaluate("length(@)", [1, 2, 3])).toBe(3);
  });

  test("length of object", () => {
    expect(evaluate("length(@)", { a: 1, b: 2 })).toBe(2);
  });

  test("reverse of array", () => {
    expect(evaluate("reverse(@)", [1, 2, 3])).toStrictEqual([3, 2, 1]);
  });

  test("starts_with", () => {
    expect(evaluate("starts_with(@, 'foo')", "foobar")).toBe(true);
    expect(evaluate("starts_with(@, 'bar')", "foobar")).toBe(false);
  });

  test("ends_with", () => {
    expect(evaluate("ends_with(@, 'bar')", "foobar")).toBe(true);
    expect(evaluate("ends_with(@, 'foo')", "foobar")).toBe(false);
  });

  test("contains with string", () => {
    expect(evaluate("contains(@, 'ob')", "foobar")).toBe(true);
    expect(evaluate("contains(@, 'xyz')", "foobar")).toBe(false);
  });

  test("contains with array", () => {
    expect(evaluate("contains(@, `1`)", [1, 2, 3])).toBe(true);
    expect(evaluate("contains(@, `4`)", [1, 2, 3])).toBe(false);
  });

  test("contains with string subject and non-string search returns false", () => {
    expect(evaluate("contains(@, `42`)", "hello")).toBe(false);
  });

  test("join", () => {
    expect(evaluate("join(', ', @)", ["a", "b", "c"])).toBe("a, b, c");
  });

  test("split", () => {
    expect(evaluate("split(@, ',')", "a,b,c")).toStrictEqual(["a", "b", "c"]);
  });

  // JMESPath Community JEP-014: count is the maximum number of splits to
  // perform, not the maximum number of result elements.
  // See https://github.com/jmespath-community/jmespath.spec/blob/main/jep-014-string-functions.md#split
  test("split with count performs N splits (not N result elements)", () => {
    expect(evaluate("split(@, ',', `1`)", "a,b,c")).toStrictEqual(["a", "b,c"]);
    expect(evaluate("split(@, ',', `2`)", "a,b,c")).toStrictEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("split with count 0 returns entire string", () => {
    expect(evaluate("split(@, ',', `0`)", "a,b,c")).toStrictEqual(["a,b,c"]);
  });

  test("split with count exceeding occurrences", () => {
    expect(evaluate("split(@, ',', `10`)", "a,b,c")).toStrictEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("lower", () => {
    expect(evaluate("lower(@)", "HELLO")).toBe("hello");
  });

  test("upper", () => {
    expect(evaluate("upper(@)", "hello")).toBe("HELLO");
  });

  test("reverse handles unicode", () => {
    expect(evaluate("reverse(@)", "ab🎉cd")).toBe("dc🎉ba");
  });

  test("trim", () => {
    expect(evaluate("trim(@)", "  hello  ")).toBe("hello");
  });

  test("trim with chars", () => {
    expect(evaluate("trim(@, 'su ')", " subject string ")).toBe("bject string");
  });

  test("trim with empty chars defaults to whitespace", () => {
    expect(evaluate("trim(@, '')", " hello ")).toBe("hello");
  });

  test("trim_left", () => {
    expect(evaluate("trim_left(@)", "  hello  ")).toBe("hello  ");
  });

  test("trim_left with chars", () => {
    expect(evaluate("trim_left(@, 'su ')", " subject string ")).toBe(
      "bject string ",
    );
  });

  test("trim_right", () => {
    expect(evaluate("trim_right(@)", "  hello  ")).toBe("  hello");
  });

  test("trim_right with chars", () => {
    expect(evaluate("trim_right(@, 'gn ')", " subject string ")).toBe(
      " subject stri",
    );
  });

  test("replace all occurrences", () => {
    expect(evaluate("replace(@, 'o', '0')", "foobar")).toBe("f00bar");
  });

  test("replace with count", () => {
    expect(evaluate("replace(@, 'o', '0', `1`)", "foobar")).toBe("f0obar");
  });

  test("replace with count 0 returns unchanged", () => {
    expect(evaluate("replace(@, 'o', '0', `0`)", "foobar")).toBe("foobar");
  });

  test("replace with count exceeding occurrences", () => {
    expect(evaluate("replace(@, 'x', 'y', `5`)", "ab")).toBe("ab");
  });

  test("pad_left", () => {
    expect(evaluate("pad_left(@, `5`)", "hi")).toBe("   hi");
    expect(evaluate("pad_left(@, `5`, '0')", "hi")).toBe("000hi");
  });

  test("pad_right", () => {
    expect(evaluate("pad_right(@, `5`)", "hi")).toBe("hi   ");
    expect(evaluate("pad_right(@, `5`, '0')", "hi")).toBe("hi000");
  });

  test("find_first", () => {
    expect(evaluate("find_first(@, 'bar')", "foobar")).toBe(3);
    expect(evaluate("find_first(@, 'xyz')", "foobar")).toBeNull();
  });

  test("find_first with start and end", () => {
    expect(evaluate("find_first(@, 'o', `2`)", "foobar")).toBe(2);
    expect(evaluate("find_first(@, 'o', `0`, `1`)", "foobar")).toBeNull();
  });

  test("find_last", () => {
    expect(evaluate("find_last(@, 'o')", "foobar")).toBe(2);
    expect(evaluate("find_last(@, 'xyz')", "foobar")).toBeNull();
  });

  test("find_last with start and end", () => {
    expect(evaluate("find_last(@, 'o', `0`, `2`)", "foobar")).toBe(1);
  });

  test("find_first throws for non-integer start", () => {
    expect(() => evaluate("find_first(@, 'o', `1.5`)", "foobar")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("find_first throws for non-integer end", () => {
    expect(() => evaluate("find_first(@, 'o', `0`, `2.5`)", "foobar")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("find_last throws for non-integer start", () => {
    expect(() => evaluate("find_last(@, 'o', `1.5`)", "foobar")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("find_last throws for non-integer end", () => {
    expect(() => evaluate("find_last(@, 'o', `0`, `2.5`)", "foobar")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("pad_left throws for non-integer width", () => {
    expect(() => evaluate("pad_left(@, `2.5`)", "hi")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("pad_left throws for negative width", () => {
    expect(() => evaluate("pad_left(@, `-1`)", "hi")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("pad_left throws for pad string not length 1", () => {
    expect(() => evaluate("pad_left(@, `5`, 'ab')", "hi")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("pad_right throws for non-integer width", () => {
    expect(() => evaluate("pad_right(@, `2.5`)", "hi")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("pad_right throws for pad string not length 1", () => {
    expect(() => evaluate("pad_right(@, `5`, 'ab')", "hi")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("replace throws for non-integer count", () => {
    expect(() => evaluate("replace(@, 'o', '0', `1.5`)", "foo")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("replace throws for negative count", () => {
    expect(() => evaluate("replace(@, 'o', '0', `-1`)", "foo")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("split throws for non-integer count", () => {
    expect(() => evaluate("split(@, ',', `1.5`)", "a,b,c")).toThrow(
      InvalidArgumentValueError,
    );
  });

  test("split throws for negative count", () => {
    expect(() => evaluate("split(@, ',', `-1`)", "a,b,c")).toThrow(
      InvalidArgumentValueError,
    );
  });
});

describe("string handler defensive guards", () => {
  test("length returns 0 for non-string/array/object", () => {
    expect(callHandler("length", [42])).toBe(0);
  });

  test("reverse returns value for non-string/array", () => {
    expect(callHandler("reverse", [42])).toBe(42);
  });

  test("starts_with returns false for type mismatch", () => {
    expect(callHandler("starts_with", [42, "foo"])).toBe(false);
  });

  test("ends_with returns false for type mismatch", () => {
    expect(callHandler("ends_with", [42, "foo"])).toBe(false);
  });

  test("contains returns false for non-string/array subject", () => {
    expect(callHandler("contains", [42, "foo"])).toBe(false);
  });

  test("join returns empty string for type mismatch", () => {
    expect(callHandler("join", [42, ["a"]])).toBe("");
  });

  test("split returns empty array for type mismatch", () => {
    expect(callHandler("split", [42, ","])).toStrictEqual([]);
  });

  test("lower returns empty string for non-string", () => {
    expect(callHandler("lower", [42])).toBe("");
  });

  test("upper returns empty string for non-string", () => {
    expect(callHandler("upper", [42])).toBe("");
  });

  test("trim returns empty string for non-string", () => {
    expect(callHandler("trim", [42])).toBe("");
  });

  test("replace returns empty string for type mismatch", () => {
    expect(callHandler("replace", [42, "a", "b"])).toBe("");
  });

  test("pad_left returns empty string for type mismatch", () => {
    expect(callHandler("pad_left", [42, 5])).toBe("");
  });

  test("pad_right returns empty string for type mismatch", () => {
    expect(callHandler("pad_right", [42, 5])).toBe("");
  });

  test("trim_left returns empty string for non-string", () => {
    expect(callHandler("trim_left", [42])).toBe("");
  });

  test("trim_right returns empty string for non-string", () => {
    expect(callHandler("trim_right", [42])).toBe("");
  });

  test("find_first returns null for type mismatch", () => {
    expect(callHandler("find_first", [42, "a"])).toBeNull();
  });

  test("find_last returns null for type mismatch", () => {
    expect(callHandler("find_last", [42, "a"])).toBeNull();
  });
});
