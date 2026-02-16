import { evaluateJsonSelector, project } from "../src/evaluate";
import { getBuiltinFunctionProvider } from "../src/functions/builtins";
import { parseJsonSelector } from "../src/parse";

import { catchError } from "./helpers";

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

  test("multiSelectList evaluates against null context", () => {
    const selector = parseJsonSelector("[a, b]");
    expect(evaluateJsonSelector(selector, null)).toStrictEqual([null, null]);
  });

  test("multiSelectList returns null in legacy null-propagation mode", () => {
    const selector = parseJsonSelector("[a, b]");
    expect(
      evaluateJsonSelector(selector, null, { legacyNullPropagation: true }),
    ).toBeNull();
  });

  test("multiSelectHash evaluates against null context", () => {
    const selector = parseJsonSelector("{x: a, y: b}");
    expect(evaluateJsonSelector(selector, null)).toStrictEqual({
      x: null,
      y: null,
    });
  });

  test("multiSelectHash returns null in legacy null-propagation mode", () => {
    const selector = parseJsonSelector("{x: a, y: b}");
    expect(
      evaluateJsonSelector(selector, null, { legacyNullPropagation: true }),
    ).toBeNull();
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

  const stringSliceBoundaryCases: Array<{
    expression: string;
    context: { s: string };
    result: string;
  }> = [
    {
      expression: "s[:]",
      context: { s: "0123456789" },
      result: "0123456789",
    },
    {
      expression: "s[0:20]",
      context: { s: "0123456789" },
      result: "0123456789",
    },
    { expression: "s[10:-20]", context: { s: "0123456789" }, result: "" },
    { expression: "s[-4:-1]", context: { s: "0123456789" }, result: "678" },
    { expression: "s[:-5:-1]", context: { s: "0123456789" }, result: "9876" },
    {
      expression: "s[10:0:-1]",
      context: { s: "0123456789" },
      result: "987654321",
    },
    { expression: "s[8:2:-2]", context: { s: "0123456789" }, result: "864" },
    { expression: "s[3:3]", context: { s: "0123456789" }, result: "" },
    { expression: "s[::-1]", context: { s: "" }, result: "" },
  ];

  it.each(stringSliceBoundaryCases)(
    "slice supports string boundary and negative-index case: $expression",
    ({ expression, context, result }) => {
      const selector = parseJsonSelector(expression);
      expect(evaluateJsonSelector(selector, context)).toBe(result);
    },
  );

  test("slice throws for zero step on strings", () => {
    const selector = parseJsonSelector("s[8:2:0]");
    const error = catchError(() =>
      evaluateJsonSelector(selector, { s: "0123456789" }),
    );
    expect(error).toMatchObject({
      name: "InvalidArgumentValueError",
      message: "slice(): step cannot be 0",
    });
  });

  test("slice returns null for non-array/non-string values", () => {
    const selector = parseJsonSelector("s[1:3]");
    expect(evaluateJsonSelector(selector, { s: 123 })).toBeNull();
  });

  describe("let expressions", () => {
    test("resolves variableRef from explicit evaluation bindings", () => {
      const selector = parseJsonSelector("$x");
      expect(
        evaluateJsonSelector(
          selector,
          {},
          {
            rootContext: {},
            bindings: new Map([["x", 42]]),
          },
        ),
      ).toBe(42);
    });

    test("treats undefined binding value as unbound variable", () => {
      const selector = parseJsonSelector("$x");
      const error = catchError(() =>
        evaluateJsonSelector(
          selector,
          {},
          {
            rootContext: {},
            bindings: new Map<string, unknown>([["x", undefined]]),
          },
        ),
      );
      expect(error).toMatchObject({
        name: "UndefinedVariableError",
        variableName: "x",
        message: "Undefined variable: $x",
      });
    });

    test("evaluates basic binding and variable reference", () => {
      const selector = parseJsonSelector("let $x = foo in $x");
      expect(
        evaluateJsonSelector(selector, { foo: { bar: "baz" } }),
      ).toStrictEqual({
        bar: "baz",
      });
    });

    test("evaluates multiple bindings", () => {
      const selector = parseJsonSelector("let $x = a, $y = b in [$x, $y]");
      expect(evaluateJsonSelector(selector, { a: 1, b: 2 })).toStrictEqual([
        1, 2,
      ]);
    });

    test("supports nested let shadowing", () => {
      const selector = parseJsonSelector("let $x = a in let $x = b in $x");
      expect(evaluateJsonSelector(selector, { a: "outer", b: "inner" })).toBe(
        "inner",
      );
    });

    test("binding expressions evaluate against outer scope", () => {
      const selector = parseJsonSelector(
        "let $a = 'top-a' in let $a = 'in-a', $b = $a in $b",
      );
      expect(evaluateJsonSelector(selector, {})).toBe("top-a");
    });

    test("supports let inside filter context", () => {
      const selector = parseJsonSelector(
        "[*].[let $home_state = home_state in states[? name == $home_state].cities[]][]",
      );
      const data = [
        {
          home_state: "WA",
          states: [
            { name: "WA", cities: ["Seattle", "Bellevue", "Olympia"] },
            { name: "CA", cities: ["Los Angeles", "San Francisco"] },
            { name: "NY", cities: ["New York City", "Albany"] },
          ],
        },
        {
          home_state: "NY",
          states: [
            { name: "WA", cities: ["Seattle", "Bellevue", "Olympia"] },
            { name: "CA", cities: ["Los Angeles", "San Francisco"] },
            { name: "NY", cities: ["New York City", "Albany"] },
          ],
        },
      ];
      expect(evaluateJsonSelector(selector, data)).toStrictEqual([
        ["Seattle", "Bellevue", "Olympia"],
        ["New York City", "Albany"],
      ]);
    });

    test("projection is stopped when bound to variable", () => {
      const selector = parseJsonSelector("let $foo = foo[*] in $foo[0]");
      expect(
        evaluateJsonSelector(selector, {
          foo: [
            [0, 1],
            [2, 3],
            [4, 5],
          ],
        }),
      ).toStrictEqual([0, 1]);
    });

    test("throws undefined-variable for unbound variable reference", () => {
      const selector = parseJsonSelector("$noexist");
      const error = catchError(() => evaluateJsonSelector(selector, {}));
      expect(error).toMatchObject({
        name: "UndefinedVariableError",
        variableName: "noexist",
        message: "Undefined variable: $noexist",
      });
    });

    test("inner null binding does not fall through to outer binding", () => {
      const selector = parseJsonSelector(
        "let $foo = foo in let $foo = null in $foo",
      );
      expect(evaluateJsonSelector(selector, { foo: "outer" })).toBeNull();
    });
  });

  describe("arithmetic expressions", () => {
    const arithmeticContext = {
      a: 6,
      b: 3,
      c: 2,
      neg: -7,
      items: [
        { price: 25, quantity: 3 },
        { price: 25, quantity: 5 },
        { price: 11, quantity: 8 },
      ],
    };

    test.each<{
      expression: string;
      result: unknown;
    }>([
      { expression: "a + b", result: 9 },
      { expression: "a - b", result: 3 },
      { expression: "a * b", result: 18 },
      { expression: "a / b", result: 2 },
      { expression: "a % c", result: 0 },
      { expression: "a // c", result: 3 },
      { expression: "neg // c", result: -4 },
      { expression: "+a", result: 6 },
      { expression: "-b", result: -3 },
      { expression: "a + b * c", result: 12 },
      { expression: "(a + b) * c", result: 18 },
      {
        expression: "items[?price * quantity > `100`].price",
        result: [25],
      },
      { expression: "a × b", result: 18 },
      { expression: "a ÷ b", result: 2 },
      { expression: "a − b", result: 3 },
    ])("evaluates arithmetic case: $expression", ({ expression, result }) => {
      expect(
        evaluateJsonSelector(parseJsonSelector(expression), arithmeticContext),
      ).toStrictEqual(result);
    });

    const arithmeticErrorContext = {
      a: 1,
      b: 0,
      s: "x",
      n: null,
    };

    test.each<[string, unknown, Record<string, string | number>]>([
      [
        "a / b",
        arithmeticErrorContext,
        {
          name: "DivideByZeroError",
          operator: "/",
          operandRole: "right operand",
          actualType: "number",
          divisor: 0,
        },
      ],
      [
        "a // b",
        arithmeticErrorContext,
        {
          name: "DivideByZeroError",
          operator: "//",
          operandRole: "right operand",
          actualType: "number",
          divisor: 0,
        },
      ],
      [
        "a + s",
        arithmeticErrorContext,
        {
          name: "NotANumberError",
          operator: "+",
          operandRole: "right operand",
          actualType: "string",
        },
      ],
      [
        "+s",
        arithmeticErrorContext,
        {
          name: "NotANumberError",
          operator: "+",
          operandRole: "operand",
          actualType: "string",
        },
      ],
      [
        "-n",
        arithmeticErrorContext,
        {
          name: "NotANumberError",
          operator: "-",
          operandRole: "operand",
          actualType: "null",
        },
      ],
      [
        "a + b",
        { a: 1, b: [2, 3] },
        {
          name: "NotANumberError",
          operator: "+",
          operandRole: "right operand",
          actualType: "array",
        },
      ],
    ])(
      "throws structured not-a-number error: %s",
      (expression, context, expected) => {
        const error = catchError(() =>
          evaluateJsonSelector(parseJsonSelector(expression), context),
        );
        expect(error).toMatchObject(expected);
      },
    );

    test("modulo by zero produces NaN", () => {
      const result = evaluateJsonSelector(parseJsonSelector("`1` % `0`"), {});
      expect(result).toBeNaN();
    });

    test("supports arithmetic in pipes", () => {
      const selector = parseJsonSelector("a | @ + $.b");
      expect(evaluateJsonSelector(selector, { a: 2, b: 3 })).toBe(5);
    });
  });

  describe("ternary operator", () => {
    test.each<[string, unknown, unknown]>([
      ["null is falsy", null, "fallback"],
      ["false is falsy", false, "fallback"],
      ["empty string is falsy", "", "fallback"],
      ["empty array is falsy", [], "fallback"],
      ["empty object is falsy", {}, "fallback"],
      ["zero is truthy", 0, "selected"],
      ["non-empty string is truthy", "x", "selected"],
      ["non-empty array is truthy", [1], "selected"],
      ["non-empty object is truthy", { a: 1 }, "selected"],
    ])("%s", (_name, value, expected) => {
      const selector = parseJsonSelector("value ? selected : fallback");
      const context = { value, selected: "selected", fallback: "fallback" };
      expect(evaluateJsonSelector(selector, context)).toBe(expected);
    });

    test("nested ternary evaluates right-associative alternate branch", () => {
      const selector = parseJsonSelector("a ? b : c ? d : e");
      expect(
        evaluateJsonSelector(selector, {
          a: false,
          b: "b",
          c: true,
          d: "d",
          e: "e",
        }),
      ).toBe("d");
      expect(
        evaluateJsonSelector(selector, {
          a: false,
          b: "b",
          c: false,
          d: "d",
          e: "e",
        }),
      ).toBe("e");
    });
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
