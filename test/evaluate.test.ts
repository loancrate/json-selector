import { evaluateJsonSelector, project } from "../src/evaluate";
import { getBuiltinFunctionProvider } from "../src/functions/builtins";
import { parseJsonSelector } from "../src/parse";

describe("evaluate", () => {
  test("projection with nested filter", () => {
    const obj = {
      reservations: [
        {
          instances: [
            { foo: 1, bar: 2 },
            { foo: 1, bar: 3 },
            { foo: 1, bar: 2 },
            { foo: 2, bar: 1 },
          ],
        },
      ],
    };

    const selector = parseJsonSelector("reservations[*].instances[?bar==`1`]");
    expect(evaluateJsonSelector(selector, obj)).toStrictEqual([
      [{ foo: 2, bar: 1 }],
    ]);

    const selector2 = parseJsonSelector("reservations[*]");
    expect(evaluateJsonSelector(selector2, obj)).toStrictEqual(
      obj.reservations,
    );
  });

  test("idAccess", () => {
    const data = {
      items: [
        { id: "first", value: 1 },
        { id: "second", value: 2 },
        { id: "third", value: 3 },
      ],
    };
    const selector = parseJsonSelector("items['second']");
    expect(evaluateJsonSelector(selector, data)).toStrictEqual({
      id: "second",
      value: 2,
    });
  });

  test("project without projection", () => {
    const data = { arr: [1, 2, 3] };
    const selector = parseJsonSelector("arr[*]");
    expect(evaluateJsonSelector(selector, data)).toStrictEqual([1, 2, 3]);
  });

  // JMESPath spec: "If the result of the expression applied to any individual
  // element is null, it is not included in the collected set of results."
  // See https://jmespath.org/specification.html#wildcard-expressions
  test("projection filters null elements from array", () => {
    const data = { arr: [1, null, 2, null, 3] };
    const selector = parseJsonSelector("arr[*]");
    expect(evaluateJsonSelector(selector, data)).toStrictEqual([1, 2, 3]);
  });

  test("objectProject filters null values", () => {
    const selector = parseJsonSelector("@.*");
    const data = { a: 1, b: null, c: 3 };
    expect(evaluateJsonSelector(selector, data)).toStrictEqual([1, 3]);
  });

  test("expressionRef returns null when evaluated directly", () => {
    const selector = parseJsonSelector("&foo");
    expect(evaluateJsonSelector(selector, { foo: "bar" })).toBeNull();
  });

  test("multiSelectList returns null for null context", () => {
    const selector = parseJsonSelector("[a, b]");
    expect(evaluateJsonSelector(selector, null)).toBeNull();
  });

  test("multiSelectHash returns null for null context", () => {
    const selector = parseJsonSelector("{x: a, y: b}");
    expect(evaluateJsonSelector(selector, null)).toBeNull();
  });

  test("objectProject on non-object returns null", () => {
    const selector = parseJsonSelector("@.*");
    expect(evaluateJsonSelector(selector, "not-an-object")).toBeNull();
    expect(evaluateJsonSelector(selector, [1, 2, 3])).toBeNull();
  });

  test("objectProject returns values", () => {
    const selector = parseJsonSelector("@.*");
    expect(evaluateJsonSelector(selector, { a: 1, b: 2 })).toStrictEqual([
      1, 2,
    ]);
  });

  test("objectProject with projection", () => {
    const selector = parseJsonSelector("@.*.name");
    const data = { x: { name: "alice" }, y: { name: "bob" } };
    expect(evaluateJsonSelector(selector, data)).toStrictEqual([
      "alice",
      "bob",
    ]);
  });

  test("slice supports strings", () => {
    const selector = parseJsonSelector("s[1:3]");
    expect(evaluateJsonSelector(selector, { s: "foobar" })).toBe("oo");
  });

  test("slice supports reverse strings", () => {
    const selector = parseJsonSelector("s[::-1]");
    expect(evaluateJsonSelector(selector, { s: "foobar" })).toBe("raboof");
  });

  test("slice supports string step", () => {
    const selector = parseJsonSelector("s[::2]");
    expect(evaluateJsonSelector(selector, { s: "abcdef" })).toBe("ace");
  });

  test("slice on string uses Unicode code points", () => {
    const selector = parseJsonSelector("s[1:3]");
    expect(
      evaluateJsonSelector(selector, {
        s: "\ud83d\ude00\ud83d\ude03\ud83d\ude04\ud83d\ude01",
      }),
    ).toBe("\ud83d\ude03\ud83d\ude04");
  });

  test("slice reverses Unicode strings by code point", () => {
    const selector = parseJsonSelector("s[::-1]");
    expect(
      evaluateJsonSelector(selector, {
        s: "\ud83d\ude00\ud83d\ude03\ud83d\ude04\ud83d\ude01",
      }),
    ).toBe("\ud83d\ude01\ud83d\ude04\ud83d\ude03\ud83d\ude00");
  });

  test("slice returns null for non-array/non-string values", () => {
    const selector = parseJsonSelector("s[1:3]");
    expect(evaluateJsonSelector(selector, { s: 123 })).toBeNull();
  });
});

describe("project", () => {
  test("returns array as-is when projection is undefined", () => {
    expect(
      project([1, 2, 3], undefined, {
        rootContext: null,
        functionProvider: getBuiltinFunctionProvider(),
      }),
    ).toStrictEqual([1, 2, 3]);
  });
});
