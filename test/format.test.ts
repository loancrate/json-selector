import { JsonSelector } from "../src/ast";
import { formatJsonSelector } from "../src/format";
import { parseJsonSelector } from "../src/parse";

describe("formatJsonSelector", () => {
  describe("simple nodes", () => {
    test.each<[string, JsonSelector, string]>([
      ["explicit current", { type: "current", explicit: true }, "@"],
      ["implicit current", { type: "current", explicit: false }, "@"],
      ["current without hint", { type: "current" }, "@"],
      ["root", { type: "root" }, "$"],
      ["identifier", { type: "identifier", id: "foo" }, "foo"],
    ])("formats %s node", (_name, selector, expected) => {
      expect(formatJsonSelector(selector)).toBe(expected);
    });
  });

  describe("validity", () => {
    test("fieldAccess with implicit current produces valid output", () => {
      expect(
        formatJsonSelector({
          type: "fieldAccess",
          expression: { type: "current", explicit: false },
          field: "foo",
        }),
      ).toBe("@.foo");
    });

    test("objectProject with implicit current produces valid output", () => {
      expect(
        formatJsonSelector({
          type: "objectProject",
          expression: { type: "current", explicit: false },
        }),
      ).toBe("@.*");
    });
  });

  describe("field access", () => {
    test("formats simple field access", () => {
      expect(
        formatJsonSelector({
          type: "fieldAccess",
          expression: { type: "identifier", id: "foo" },
          field: "bar",
        }),
      ).toBe("foo.bar");
    });

    test("quotes non-identifier field names", () => {
      expect(
        formatJsonSelector({
          type: "fieldAccess",
          expression: { type: "identifier", id: "foo" },
          field: "dashed-field",
        }),
      ).toBe('foo."dashed-field"');
    });
  });

  describe("index access", () => {
    test("formats index access", () => {
      expect(
        formatJsonSelector({
          type: "indexAccess",
          expression: { type: "identifier", id: "foo" },
          index: 42,
        }),
      ).toBe("foo[42]");
    });
  });

  describe("id access", () => {
    test("formats id access with escaping", () => {
      expect(
        formatJsonSelector({
          type: "fieldAccess",
          expression: {
            type: "idAccess",
            expression: {
              type: "fieldAccess",
              expression: { type: "identifier", id: "foo" },
              field: "bar",
            },
            id: "my\\'id",
          },
          field: "value",
        }),
      ).toBe("foo.bar['my\\\\\\'id'].value");
    });
  });

  describe("slice", () => {
    test.each<
      [
        string,
        number | undefined,
        number | undefined,
        number | undefined,
        string,
      ]
    >([
      ["start and end", 1, 3, undefined, "foo[1:3]"],
      ["end and step", undefined, 1, 3, "foo[:1:3]"],
      ["start and step", 1, undefined, 3, "foo[1::3]"],
    ])("formats slice with %s", (_name, start, end, step, expected) => {
      expect(
        formatJsonSelector({
          type: "slice",
          expression: { type: "identifier", id: "foo" },
          start,
          end,
          step,
        }),
      ).toBe(expected);
    });
  });

  describe("project", () => {
    test("formats project with projection", () => {
      expect(
        formatJsonSelector({
          type: "project",
          expression: { type: "identifier", id: "foo" },
          projection: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "bar",
          },
        }),
      ).toBe("foo[*].bar");
    });

    test("formats project without projection", () => {
      expect(
        formatJsonSelector({
          type: "project",
          expression: { type: "identifier", id: "arr" },
          projection: undefined,
        }),
      ).toBe("arr[*]");
    });
  });

  describe("not", () => {
    test("formats not expression", () => {
      expect(
        formatJsonSelector({
          type: "not",
          expression: {
            type: "fieldAccess",
            expression: {
              type: "fieldAccess",
              expression: { type: "identifier", id: "foo" },
              field: "bar",
            },
            field: "baz",
          },
        }),
      ).toBe("!foo.bar.baz");
    });
  });

  describe("logical operators", () => {
    test("formats and/or with correct precedence", () => {
      expect(
        formatJsonSelector({
          type: "and",
          lhs: {
            type: "compare",
            operator: "==",
            lhs: { type: "identifier", id: "a" },
            rhs: { type: "literal", value: 1 },
          },
          rhs: {
            type: "or",
            lhs: {
              type: "compare",
              operator: "==",
              lhs: { type: "identifier", id: "b" },
              rhs: { type: "literal", value: 2 },
            },
            rhs: {
              type: "compare",
              operator: "==",
              lhs: { type: "identifier", id: "c" },
              rhs: { type: "literal", value: 3 },
            },
          },
        }),
      ).toBe("a == 1 && (b == 2 || c == 3)");
    });
  });

  describe("arithmetic operators", () => {
    test.each<[string, JsonSelector, string]>([
      [
        "addition",
        {
          type: "arithmetic",
          operator: "+",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        "a + b",
      ],
      [
        "subtraction",
        {
          type: "arithmetic",
          operator: "-",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        "a - b",
      ],
      [
        "multiply",
        {
          type: "arithmetic",
          operator: "*",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        "a * b",
      ],
      [
        "divide",
        {
          type: "arithmetic",
          operator: "/",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        "a / b",
      ],
      [
        "modulo",
        {
          type: "arithmetic",
          operator: "%",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        "a % b",
      ],
      [
        "integer divide",
        {
          type: "arithmetic",
          operator: "//",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        "a // b",
      ],
    ])("formats %s", (_name, selector, expected) => {
      expect(formatJsonSelector(selector)).toBe(expected);
    });

    test("formats unary arithmetic", () => {
      expect(
        formatJsonSelector({
          type: "unaryArithmetic",
          operator: "-",
          expression: { type: "identifier", id: "a" },
        }),
      ).toBe("-a");
      expect(
        formatJsonSelector({
          type: "unaryArithmetic",
          operator: "+",
          expression: { type: "identifier", id: "a" },
        }),
      ).toBe("+a");
    });

    test("formats precedence with parentheses", () => {
      expect(
        formatJsonSelector({
          type: "arithmetic",
          operator: "*",
          lhs: {
            type: "arithmetic",
            operator: "+",
            lhs: { type: "identifier", id: "a" },
            rhs: { type: "identifier", id: "b" },
          },
          rhs: { type: "identifier", id: "c" },
        }),
      ).toBe("(a + b) * c");
    });

    test("omits unnecessary parentheses with precedence", () => {
      expect(
        formatJsonSelector({
          type: "arithmetic",
          operator: "+",
          lhs: { type: "identifier", id: "a" },
          rhs: {
            type: "arithmetic",
            operator: "*",
            lhs: { type: "identifier", id: "b" },
            rhs: { type: "identifier", id: "c" },
          },
        }),
      ).toBe("a + b * c");
    });

    test.each([
      "a + b",
      "a - b",
      "a * b",
      "a / b",
      "a % b",
      "a // b",
      "a + b * c",
      "(a + b) * c",
      "-a + b",
      "+a * b",
      "42",
      "`42`",
      "a × b",
      "a ÷ b",
      "a − b",
    ])("round-trips parse -> format -> parse: %s", (expression) => {
      const original = parseJsonSelector(expression);
      const formatted = formatJsonSelector(original);
      expect(parseJsonSelector(formatted)).toStrictEqual(original);
    });
  });

  describe("ternary operator", () => {
    test("formats simple ternary", () => {
      expect(
        formatJsonSelector({
          type: "ternary",
          condition: { type: "identifier", id: "a" },
          consequent: { type: "identifier", id: "b" },
          alternate: { type: "identifier", id: "c" },
        }),
      ).toBe("a ? b : c");
    });

    test("formats right-associative ternary chain without extra parens", () => {
      expect(
        formatJsonSelector({
          type: "ternary",
          condition: { type: "identifier", id: "a" },
          consequent: { type: "identifier", id: "b" },
          alternate: {
            type: "ternary",
            condition: { type: "identifier", id: "c" },
            consequent: { type: "identifier", id: "d" },
            alternate: { type: "identifier", id: "e" },
          },
        }),
      ).toBe("a ? b : c ? d : e");
    });

    test("parenthesizes ternary condition when needed", () => {
      expect(
        formatJsonSelector({
          type: "ternary",
          condition: {
            type: "ternary",
            condition: { type: "identifier", id: "a" },
            consequent: { type: "identifier", id: "b" },
            alternate: { type: "identifier", id: "c" },
          },
          consequent: { type: "identifier", id: "d" },
          alternate: { type: "identifier", id: "e" },
        }),
      ).toBe("(a ? b : c) ? d : e");
    });

    test("parenthesizes ternary in higher-precedence context", () => {
      expect(
        formatJsonSelector({
          type: "and",
          lhs: { type: "identifier", id: "a" },
          rhs: {
            type: "ternary",
            condition: { type: "identifier", id: "b" },
            consequent: { type: "identifier", id: "c" },
            alternate: { type: "identifier", id: "d" },
          },
        }),
      ).toBe("a && (b ? c : d)");
    });

    test.each([
      "a ? b : c",
      "a ? b : c ? d : e",
      "(a ? b : c) ? d : e",
      "a || b ? c : d | e",
    ])("round-trips parse -> format -> parse: %s", (expression) => {
      const original = parseJsonSelector(expression);
      const formatted = formatJsonSelector(original);
      expect(parseJsonSelector(formatted)).toStrictEqual(original);
    });
  });

  describe("literal syntax hints", () => {
    test("formats bare true without backtickSyntax", () => {
      expect(formatJsonSelector({ type: "literal", value: true })).toBe("true");
    });

    test("formats bare false without backtickSyntax", () => {
      expect(formatJsonSelector({ type: "literal", value: false })).toBe(
        "false",
      );
    });

    test("formats bare null without backtickSyntax", () => {
      expect(formatJsonSelector({ type: "literal", value: null })).toBe("null");
    });

    test("formats bare number without backtickSyntax", () => {
      expect(formatJsonSelector({ type: "literal", value: 42 })).toBe("42");
    });

    test("formats bare negative zero without backtickSyntax", () => {
      expect(formatJsonSelector({ type: "literal", value: -0 })).toBe("-0");
    });

    test("falls back to backtick syntax for non-primitive bare literal", () => {
      expect(formatJsonSelector({ type: "literal", value: [1, 2] })).toBe(
        "`[1,2]`",
      );
    });

    test("formats backtick number with backtickSyntax", () => {
      expect(
        formatJsonSelector({
          type: "literal",
          value: 42,
          backtickSyntax: true,
        }),
      ).toBe("`42`");
    });

    test("formats backtick true with backtickSyntax", () => {
      expect(
        formatJsonSelector({
          type: "literal",
          value: true,
          backtickSyntax: true,
        }),
      ).toBe("`true`");
    });

    test("formats backtick false with backtickSyntax", () => {
      expect(
        formatJsonSelector({
          type: "literal",
          value: false,
          backtickSyntax: true,
        }),
      ).toBe("`false`");
    });

    test("formats backtick null with backtickSyntax", () => {
      expect(
        formatJsonSelector({
          type: "literal",
          value: null,
          backtickSyntax: true,
        }),
      ).toBe("`null`");
    });

    test("formats raw string without backtickSyntax", () => {
      expect(formatJsonSelector({ type: "literal", value: "hello" })).toBe(
        "'hello'",
      );
    });

    test("formats backtick string with backtickSyntax", () => {
      expect(
        formatJsonSelector({
          type: "literal",
          value: "hello",
          backtickSyntax: true,
        }),
      ).toBe('`"hello"`');
    });
  });

  describe("functionCall", () => {
    test("formats function call with no args", () => {
      expect(
        formatJsonSelector({
          type: "functionCall",
          name: "length",
          args: [{ type: "current", explicit: true }],
        }),
      ).toBe("length(@)");
    });

    test("formats function call with multiple args", () => {
      expect(
        formatJsonSelector({
          type: "functionCall",
          name: "contains",
          args: [
            { type: "identifier", id: "foo" },
            { type: "literal", value: "bar" },
          ],
        }),
      ).toBe("contains(foo, 'bar')");
    });
  });

  describe("expressionRef", () => {
    test("formats expression reference", () => {
      expect(
        formatJsonSelector({
          type: "expressionRef",
          expression: { type: "identifier", id: "name" },
        }),
      ).toBe("&name");
    });

    // Expression references containing pipe or other low-precedence operators
    // must be parenthesized so the formatted output re-parses correctly.
    test("formats expression reference with pipe using parens", () => {
      expect(
        formatJsonSelector({
          type: "expressionRef",
          expression: {
            type: "pipe",
            lhs: { type: "identifier", id: "a" },
            rhs: { type: "identifier", id: "b" },
          },
        }),
      ).toBe("&(a | b)");
    });

    test("formats expression reference with or using parens", () => {
      expect(
        formatJsonSelector({
          type: "expressionRef",
          expression: {
            type: "or",
            lhs: { type: "identifier", id: "a" },
            rhs: { type: "identifier", id: "b" },
          },
        }),
      ).toBe("&(a || b)");
    });
  });

  describe("multiSelectList", () => {
    test("formats multi-select list", () => {
      expect(
        formatJsonSelector({
          type: "multiSelectList",
          expressions: [
            { type: "identifier", id: "a" },
            { type: "identifier", id: "b" },
            { type: "identifier", id: "c" },
          ],
        }),
      ).toBe("[a, b, c]");
    });
  });

  describe("multiSelectHash", () => {
    test("formats multi-select hash", () => {
      expect(
        formatJsonSelector({
          type: "multiSelectHash",
          entries: [
            { key: "x", value: { type: "identifier", id: "a" } },
            { key: "y", value: { type: "identifier", id: "b" } },
          ],
        }),
      ).toBe("{x: a, y: b}");
    });
  });

  describe("objectProject", () => {
    test("formats object projection", () => {
      expect(
        formatJsonSelector({
          type: "objectProject",
          expression: { type: "identifier", id: "foo" },
        }),
      ).toBe("foo.*");
    });

    test("formats object projection with projection", () => {
      expect(
        formatJsonSelector({
          type: "objectProject",
          expression: { type: "identifier", id: "foo" },
          projection: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "bar",
          },
        }),
      ).toBe("foo.*.bar");
    });

    test("formats object projection with current projection (omits)", () => {
      expect(
        formatJsonSelector({
          type: "objectProject",
          expression: { type: "identifier", id: "foo" },
          projection: { type: "current" },
        }),
      ).toBe("foo.*");
    });

    test("omits .* when expression is already a projection type", () => {
      expect(
        formatJsonSelector({
          type: "objectProject",
          expression: {
            type: "project",
            expression: { type: "identifier", id: "foo" },
            projection: { type: "current" },
          },
          projection: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "bar",
          },
        }),
      ).toBe("foo[*].bar");
    });
  });

  describe("pipe with dot syntax", () => {
    test("formats dot syntax function call", () => {
      expect(
        formatJsonSelector({
          type: "pipe",
          lhs: { type: "identifier", id: "foo" },
          rhs: {
            type: "functionCall",
            name: "length",
            args: [{ type: "current", explicit: true }],
          },
          dotSyntax: true,
        }),
      ).toBe("foo.length(@)");
    });

    test("formats dot syntax multi-select hash", () => {
      expect(
        formatJsonSelector({
          type: "pipe",
          lhs: { type: "identifier", id: "foo" },
          rhs: {
            type: "multiSelectHash",
            entries: [{ key: "a", value: { type: "identifier", id: "x" } }],
          },
          dotSyntax: true,
        }),
      ).toBe("foo.{a: x}");
    });

    test("formats dot syntax multi-select list", () => {
      expect(
        formatJsonSelector({
          type: "pipe",
          lhs: { type: "identifier", id: "foo" },
          rhs: {
            type: "multiSelectList",
            expressions: [
              { type: "identifier", id: "a" },
              { type: "identifier", id: "b" },
            ],
          },
          dotSyntax: true,
        }),
      ).toBe("foo.[a, b]");
    });
  });

  describe("complex expressions", () => {
    test("formats pipe with nested projections, filters, and flatten", () => {
      expect(
        formatJsonSelector({
          type: "pipe",
          lhs: {
            type: "project",
            expression: {
              type: "flatten",
              expression: {
                type: "project",
                expression: {
                  type: "flatten",
                  expression: {
                    type: "identifier",
                    id: "foo",
                  },
                },
                projection: {
                  type: "filter",
                  expression: {
                    type: "fieldAccess",
                    expression: {
                      type: "current",
                    },
                    field: "bar",
                  },
                  condition: {
                    type: "compare",
                    operator: "==",
                    lhs: {
                      type: "fieldAccess",
                      expression: {
                        type: "identifier",
                        id: "baz",
                      },
                      field: "kind",
                    },
                    rhs: {
                      type: "literal",
                      value: "primary",
                    },
                  },
                },
              },
            },
            projection: {
              type: "fieldAccess",
              expression: {
                type: "current",
              },
              field: "baz",
            },
          },
          rhs: {
            type: "indexAccess",
            expression: {
              type: "current",
            },
            index: 0,
          },
        }),
      ).toBe("foo[].bar[?baz.kind == 'primary'][].baz | [0]");
    });
  });
});
