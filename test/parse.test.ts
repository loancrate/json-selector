import assert from "node:assert/strict";
import { JsonSelector } from "../src/ast";
import { parseJsonSelector } from "../src/parse";
import { catchError } from "./helpers";

describe("parseJsonSelector", () => {
  describe("basic expressions", () => {
    test("identifier", () => {
      expect(parseJsonSelector("foo")).toStrictEqual<JsonSelector>({
        type: "identifier",
        id: "foo",
      });
    });

    test("field access", () => {
      expect(parseJsonSelector("foo.bar")).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: { type: "identifier", id: "foo" },
        field: "bar",
      });
    });

    test("chained field access", () => {
      expect(parseJsonSelector("foo.bar.baz")).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: {
          type: "fieldAccess",
          expression: { type: "identifier", id: "foo" },
          field: "bar",
        },
        field: "baz",
      });
    });

    test("projection", () => {
      expect(parseJsonSelector("foo[*]")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "identifier", id: "foo" },
        projection: { type: "current" },
      });
    });

    test("projection with field access", () => {
      expect(parseJsonSelector("foo[*].bar")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "identifier", id: "foo" },
        projection: {
          type: "fieldAccess",
          expression: { type: "current" },
          field: "bar",
        },
      });
    });

    test("projection with chained field access", () => {
      expect(parseJsonSelector("foo[*].bar.baz")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "identifier", id: "foo" },
        projection: {
          type: "fieldAccess",
          expression: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "bar",
          },
          field: "baz",
        },
      });
    });

    test("field access then projection", () => {
      expect(parseJsonSelector("foo.bar[*]")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: {
          type: "fieldAccess",
          expression: { type: "identifier", id: "foo" },
          field: "bar",
        },
        projection: { type: "current" },
      });
    });

    test("chained projections", () => {
      expect(parseJsonSelector("foo[*].bar[*]")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "identifier", id: "foo" },
        projection: {
          type: "project",
          expression: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "bar",
          },
          projection: { type: "current" },
        },
      });
    });

    test("chained projections with field", () => {
      expect(
        parseJsonSelector("foo[*].bar[*].baz"),
      ).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "identifier", id: "foo" },
        projection: {
          type: "project",
          expression: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "bar",
          },
          projection: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "baz",
          },
        },
      });
    });
  });

  describe("NOT operator", () => {
    test("NOT has high precedence with field access", () => {
      // !foo.bar.baz → ((!foo).bar).baz
      expect(parseJsonSelector("!foo.bar.baz")).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: {
          type: "fieldAccess",
          expression: {
            type: "not",
            expression: { type: "identifier", id: "foo" },
          },
          field: "bar",
        },
        field: "baz",
      });
    });

    test("NOT with index access", () => {
      // !foo[0] → not(foo[0])
      expect(parseJsonSelector("!foo[0]")).toStrictEqual<JsonSelector>({
        type: "not",
        expression: {
          type: "indexAccess",
          expression: { type: "identifier", id: "foo" },
          index: 0,
        },
      });
    });

    test("NOT with projection", () => {
      // !foo[*] → !(foo[*])
      expect(parseJsonSelector("!foo[*]")).toStrictEqual<JsonSelector>({
        type: "not",
        expression: {
          type: "project",
          expression: { type: "identifier", id: "foo" },
          projection: { type: "current" },
        },
      });
    });
  });

  describe("ID access", () => {
    test("id access after field access", () => {
      expect(
        parseJsonSelector("foo.bar['id'].value"),
      ).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: {
          type: "idAccess",
          expression: {
            type: "fieldAccess",
            expression: { type: "identifier", id: "foo" },
            field: "bar",
          },
          id: "id",
        },
        field: "value",
      });
    });

    test("id access in projection", () => {
      expect(
        parseJsonSelector("foo[*].bar['id'].value"),
      ).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "identifier", id: "foo" },
        projection: {
          type: "fieldAccess",
          expression: {
            type: "idAccess",
            expression: {
              type: "fieldAccess",
              expression: { type: "current" },
              field: "bar",
            },
            id: "id",
          },
          field: "value",
        },
      });
    });
  });

  describe("flatten", () => {
    test("simple flatten", () => {
      expect(parseJsonSelector("foo[]")).toStrictEqual<JsonSelector>({
        type: "flatten",
        expression: { type: "identifier", id: "foo" },
      });
    });

    test("flatten with field access", () => {
      expect(parseJsonSelector("foo[].bar")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: {
          type: "flatten",
          expression: { type: "identifier", id: "foo" },
        },
        projection: {
          type: "fieldAccess",
          expression: { type: "current" },
          field: "bar",
        },
      });
    });

    test("flatten with chained field access", () => {
      expect(parseJsonSelector("foo[].bar.baz")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: {
          type: "flatten",
          expression: { type: "identifier", id: "foo" },
        },
        projection: {
          type: "fieldAccess",
          expression: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "bar",
          },
          field: "baz",
        },
      });
    });

    test("field access then flatten", () => {
      expect(parseJsonSelector("foo.bar[]")).toStrictEqual<JsonSelector>({
        type: "flatten",
        expression: {
          type: "fieldAccess",
          expression: { type: "identifier", id: "foo" },
          field: "bar",
        },
      });
    });

    test("chained flattens", () => {
      expect(parseJsonSelector("foo[].bar[]")).toStrictEqual<JsonSelector>({
        type: "flatten",
        expression: {
          type: "project",
          expression: {
            type: "flatten",
            expression: { type: "identifier", id: "foo" },
          },
          projection: {
            type: "fieldAccess",
            expression: { type: "current" },
            field: "bar",
          },
        },
      });
    });

    test("chained flattens with field", () => {
      expect(parseJsonSelector("foo[].bar[].baz")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: {
          type: "flatten",
          expression: {
            type: "project",
            expression: {
              type: "flatten",
              expression: { type: "identifier", id: "foo" },
            },
            projection: {
              type: "fieldAccess",
              expression: { type: "current" },
              field: "bar",
            },
          },
        },
        projection: {
          type: "fieldAccess",
          expression: { type: "current" },
          field: "baz",
        },
      });
    });
  });

  describe("filter", () => {
    test("simple filter", () => {
      expect(parseJsonSelector("foo[?bar == `1`]")).toStrictEqual<JsonSelector>(
        {
          type: "filter",
          expression: {
            type: "identifier",
            id: "foo",
          },
          condition: {
            type: "compare",
            operator: "==",
            lhs: {
              type: "identifier",
              id: "bar",
            },
            rhs: {
              type: "literal",
              value: 1,
              backtickSyntax: true,
            },
          },
        },
      );
    });

    test("complex filter with projection", () => {
      expect(
        parseJsonSelector('foo[].bar[?baz.kind == `"primary"`][].baz | [0]'),
      ).toStrictEqual<JsonSelector>({
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
                    backtickSyntax: true,
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
      });
    });
  });

  describe("parenthesized expressions", () => {
    test("parenthesized identifier", () => {
      expect(parseJsonSelector("(foo)")).toStrictEqual<JsonSelector>({
        type: "identifier",
        id: "foo",
      });
    });

    test("parenthesized field access", () => {
      expect(parseJsonSelector("(foo.bar)")).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: { type: "identifier", id: "foo" },
        field: "bar",
      });
    });

    test("parenthesized expression with pipe", () => {
      expect(parseJsonSelector("(foo) | bar")).toStrictEqual<JsonSelector>({
        type: "pipe",
        lhs: { type: "identifier", id: "foo" },
        rhs: { type: "identifier", id: "bar" },
      });
    });

    test("parentheses to change precedence", () => {
      // Without parens: a || b && c → a || (b && c)
      // With parens: (a || b) && c
      expect(parseJsonSelector("(a || b) && c")).toStrictEqual<JsonSelector>({
        type: "and",
        lhs: {
          type: "or",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });
  });

  describe("root reference ($)", () => {
    test("root alone", () => {
      expect(parseJsonSelector("$")).toStrictEqual<JsonSelector>({
        type: "root",
      });
    });

    test("root with field access", () => {
      expect(parseJsonSelector("$.foo")).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: { type: "root" },
        field: "foo",
      });
    });

    test("root with index access", () => {
      expect(parseJsonSelector("$[0]")).toStrictEqual<JsonSelector>({
        type: "indexAccess",
        expression: { type: "root" },
        index: 0,
      });
    });

    test("root with projection", () => {
      expect(parseJsonSelector("$[*].foo")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "root" },
        projection: {
          type: "fieldAccess",
          expression: { type: "current" },
          field: "foo",
        },
      });
    });
  });

  describe("current reference (@)", () => {
    test("current alone", () => {
      expect(parseJsonSelector("@")).toStrictEqual<JsonSelector>({
        type: "current",
        explicit: true,
      });
    });

    test("current with field access", () => {
      expect(parseJsonSelector("@.foo")).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: { type: "current", explicit: true },
        field: "foo",
      });
    });

    test("current with index access", () => {
      expect(parseJsonSelector("@[0]")).toStrictEqual<JsonSelector>({
        type: "indexAccess",
        expression: { type: "current", explicit: true },
        index: 0,
      });
    });
  });

  describe("leading brackets (coverage for lines 145-154)", () => {
    test("leading [] applies to @", () => {
      expect(parseJsonSelector("[]")).toStrictEqual<JsonSelector>({
        type: "flatten",
        expression: { type: "current" },
      });
    });

    test("leading [] with field access", () => {
      expect(parseJsonSelector("[].foo")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: {
          type: "flatten",
          expression: { type: "current" },
        },
        projection: {
          type: "fieldAccess",
          expression: { type: "current" },
          field: "foo",
        },
      });
    });

    test("leading [] with pipe", () => {
      expect(parseJsonSelector("[] | bar")).toStrictEqual<JsonSelector>({
        type: "pipe",
        lhs: {
          type: "flatten",
          expression: { type: "current" },
        },
        rhs: { type: "identifier", id: "bar" },
      });
    });

    test("leading [0] applies to @", () => {
      expect(parseJsonSelector("[0]")).toStrictEqual<JsonSelector>({
        type: "indexAccess",
        expression: { type: "current" },
        index: 0,
      });
    });

    test("leading [*] applies to @", () => {
      expect(parseJsonSelector("[*]")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "current" },
        projection: { type: "current" },
      });
    });

    test("leading [*] with field access", () => {
      expect(parseJsonSelector("[*].foo")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: { type: "current" },
        projection: {
          type: "fieldAccess",
          expression: { type: "current" },
          field: "foo",
        },
      });
    });

    test("leading [:2] applies to @", () => {
      expect(parseJsonSelector("[:2]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "current" },
        start: undefined,
        end: 2,
        step: undefined,
      });
    });

    test("leading [?x] applies to @", () => {
      expect(parseJsonSelector("[?x]")).toStrictEqual<JsonSelector>({
        type: "filter",
        expression: { type: "current" },
        condition: { type: "identifier", id: "x" },
      });
    });
  });

  describe("literal values", () => {
    test("raw string literal", () => {
      expect(parseJsonSelector("'hello'")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: "hello",
      });
    });

    test("backtick number literal", () => {
      expect(parseJsonSelector("`123`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: 123,
        backtickSyntax: true,
      });
    });

    test("backtick string literal", () => {
      expect(parseJsonSelector('`"hello"`')).toStrictEqual<JsonSelector>({
        type: "literal",
        value: "hello",
        backtickSyntax: true,
      });
    });

    test("backtick null literal", () => {
      expect(parseJsonSelector("`null`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: null,
        backtickSyntax: true,
      });
    });

    test("backtick true literal", () => {
      expect(parseJsonSelector("`true`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: true,
        backtickSyntax: true,
      });
    });

    test("backtick false literal", () => {
      expect(parseJsonSelector("`false`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: false,
        backtickSyntax: true,
      });
    });

    test("backtick object literal", () => {
      expect(parseJsonSelector('`{"a":1}`')).toStrictEqual<JsonSelector>({
        type: "literal",
        value: { a: 1 },
        backtickSyntax: true,
      });
    });

    test("backtick array literal", () => {
      expect(parseJsonSelector("`[1, 2, 3]`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: [1, 2, 3],
        backtickSyntax: true,
      });
    });

    test("backtick invalid JSON throws syntax by default", () => {
      const error = catchError(() => parseJsonSelector("`invalid`"));
      expect(error).toMatchObject({
        name: "InvalidTokenError",
        expression: "`invalid`",
        tokenKind: "JSON literal",
      });
    });

    test("backtick invalid JSON falls back to string in legacy mode", () => {
      expect(
        parseJsonSelector("`invalid`", { legacyLiterals: true }),
      ).toStrictEqual<JsonSelector>({
        type: "literal",
        value: "invalid",
        backtickSyntax: true,
      });
    });
  });

  describe("comparison operators", () => {
    test("== operator", () => {
      expect(parseJsonSelector("a == b")).toStrictEqual<JsonSelector>({
        type: "compare",
        operator: "==",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });

    test("!= operator", () => {
      expect(parseJsonSelector("a != b")).toStrictEqual<JsonSelector>({
        type: "compare",
        operator: "!=",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });

    test("< operator", () => {
      expect(parseJsonSelector("a < b")).toStrictEqual<JsonSelector>({
        type: "compare",
        operator: "<",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });

    test("<= operator", () => {
      expect(parseJsonSelector("a <= b")).toStrictEqual<JsonSelector>({
        type: "compare",
        operator: "<=",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });

    test("> operator", () => {
      expect(parseJsonSelector("a > b")).toStrictEqual<JsonSelector>({
        type: "compare",
        operator: ">",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });

    test(">= operator", () => {
      expect(parseJsonSelector("a >= b")).toStrictEqual<JsonSelector>({
        type: "compare",
        operator: ">=",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });
  });

  describe("arithmetic operators", () => {
    test.each<[string, string, JsonSelector]>([
      [
        "addition",
        "a + b",
        {
          type: "arithmetic",
          operator: "+",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
      ],
      [
        "subtraction",
        "a - b",
        {
          type: "arithmetic",
          operator: "-",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
      ],
      [
        "multiply",
        "a * b",
        {
          type: "arithmetic",
          operator: "*",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
      ],
      [
        "divide",
        "a / b",
        {
          type: "arithmetic",
          operator: "/",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
      ],
      [
        "modulo",
        "a % b",
        {
          type: "arithmetic",
          operator: "%",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
      ],
      [
        "integer division",
        "a // b",
        {
          type: "arithmetic",
          operator: "//",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
      ],
    ])("parses %s", (_name, expression, expected) => {
      expect(parseJsonSelector(expression)).toStrictEqual<JsonSelector>(
        expected,
      );
    });

    test("parses unary + and -", () => {
      expect(parseJsonSelector("+a")).toStrictEqual<JsonSelector>({
        type: "unaryArithmetic",
        operator: "+",
        expression: { type: "identifier", id: "a" },
      });

      expect(parseJsonSelector("-a")).toStrictEqual<JsonSelector>({
        type: "unaryArithmetic",
        operator: "-",
        expression: { type: "identifier", id: "a" },
      });
    });

    test("constant-folds unary sign over numeric literals", () => {
      expect(parseJsonSelector("+42")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: 42,
      });
      expect(parseJsonSelector("-42")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: -42,
      });
      expect(parseJsonSelector("--1")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: 1,
      });
      expect(parseJsonSelector("-`1`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: -1,
        backtickSyntax: true,
      });
    });

    test("multiplication binds tighter than addition", () => {
      expect(parseJsonSelector("a + b * c")).toStrictEqual<JsonSelector>({
        type: "arithmetic",
        operator: "+",
        lhs: { type: "identifier", id: "a" },
        rhs: {
          type: "arithmetic",
          operator: "*",
          lhs: { type: "identifier", id: "b" },
          rhs: { type: "identifier", id: "c" },
        },
      });
    });

    test("addition occurs after multiplicative lhs", () => {
      expect(parseJsonSelector("a * b + c")).toStrictEqual<JsonSelector>({
        type: "arithmetic",
        operator: "+",
        lhs: {
          type: "arithmetic",
          operator: "*",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });

    test("additive operators are left-associative", () => {
      expect(parseJsonSelector("a + b + c")).toStrictEqual<JsonSelector>({
        type: "arithmetic",
        operator: "+",
        lhs: {
          type: "arithmetic",
          operator: "+",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });

    test("arithmetic binds tighter than compare", () => {
      expect(parseJsonSelector("a + b == c")).toStrictEqual<JsonSelector>({
        type: "compare",
        operator: "==",
        lhs: {
          type: "arithmetic",
          operator: "+",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });

    test("star is wildcard in nud and multiply in led", () => {
      const wildcard = parseJsonSelector("*");
      expect(wildcard).toStrictEqual<JsonSelector>({
        type: "objectProject",
        expression: { type: "current" },
        projection: { type: "current" },
      });

      expect(parseJsonSelector("a * b")).toStrictEqual<JsonSelector>({
        type: "arithmetic",
        operator: "*",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });

    test("parentheses override arithmetic precedence", () => {
      expect(parseJsonSelector("(a + b) * c")).toStrictEqual<JsonSelector>({
        type: "arithmetic",
        operator: "*",
        lhs: {
          type: "arithmetic",
          operator: "+",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });

    test("bare number is parsed as a literal expression", () => {
      expect(parseJsonSelector("42")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: 42,
      });
    });

    test("parses unicode arithmetic operators", () => {
      expect(parseJsonSelector("a × b")).toStrictEqual<JsonSelector>({
        type: "arithmetic",
        operator: "*",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
      expect(parseJsonSelector("a ÷ b")).toStrictEqual<JsonSelector>({
        type: "arithmetic",
        operator: "/",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
      expect(parseJsonSelector("a − b")).toStrictEqual<JsonSelector>({
        type: "arithmetic",
        operator: "-",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });
  });

  describe("logical operators", () => {
    test("&& operator", () => {
      expect(parseJsonSelector("a && b")).toStrictEqual<JsonSelector>({
        type: "and",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });

    test("|| operator", () => {
      expect(parseJsonSelector("a || b")).toStrictEqual<JsonSelector>({
        type: "or",
        lhs: { type: "identifier", id: "a" },
        rhs: { type: "identifier", id: "b" },
      });
    });

    test("&& binds tighter than ||", () => {
      // a && b || c → (a && b) || c
      expect(parseJsonSelector("a && b || c")).toStrictEqual<JsonSelector>({
        type: "or",
        lhs: {
          type: "and",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });

    test("|| with && precedence", () => {
      // a || b && c → a || (b && c)
      expect(parseJsonSelector("a || b && c")).toStrictEqual<JsonSelector>({
        type: "or",
        lhs: { type: "identifier", id: "a" },
        rhs: {
          type: "and",
          lhs: { type: "identifier", id: "b" },
          rhs: { type: "identifier", id: "c" },
        },
      });
    });

    test("chained && is left-associative", () => {
      // a && b && c → (a && b) && c
      expect(parseJsonSelector("a && b && c")).toStrictEqual<JsonSelector>({
        type: "and",
        lhs: {
          type: "and",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });

    test("chained || is left-associative", () => {
      // a || b || c → (a || b) || c
      expect(parseJsonSelector("a || b || c")).toStrictEqual<JsonSelector>({
        type: "or",
        lhs: {
          type: "or",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });
  });

  describe("ternary operator", () => {
    test("simple ternary", () => {
      expect(parseJsonSelector("a ? b : c")).toStrictEqual<JsonSelector>({
        type: "ternary",
        condition: { type: "identifier", id: "a" },
        consequent: { type: "identifier", id: "b" },
        alternate: { type: "identifier", id: "c" },
      });
    });

    test("ternary is right-associative", () => {
      expect(
        parseJsonSelector("a ? b : c ? d : e"),
      ).toStrictEqual<JsonSelector>({
        type: "ternary",
        condition: { type: "identifier", id: "a" },
        consequent: { type: "identifier", id: "b" },
        alternate: {
          type: "ternary",
          condition: { type: "identifier", id: "c" },
          consequent: { type: "identifier", id: "d" },
          alternate: { type: "identifier", id: "e" },
        },
      });
    });

    test("|| binds tighter than ternary", () => {
      // a || b ? c : d → (a || b) ? c : d
      expect(parseJsonSelector("a || b ? c : d")).toStrictEqual<JsonSelector>({
        type: "ternary",
        condition: {
          type: "or",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        consequent: { type: "identifier", id: "c" },
        alternate: { type: "identifier", id: "d" },
      });
    });

    test("ternary binds tighter than pipe", () => {
      // a ? b : c | d → (a ? b : c) | d
      expect(parseJsonSelector("a ? b : c | d")).toStrictEqual<JsonSelector>({
        type: "pipe",
        lhs: {
          type: "ternary",
          condition: { type: "identifier", id: "a" },
          consequent: { type: "identifier", id: "b" },
          alternate: { type: "identifier", id: "c" },
        },
        rhs: { type: "identifier", id: "d" },
      });
    });
  });

  describe("slice expressions", () => {
    test("slice with start and end", () => {
      expect(parseJsonSelector("foo[1:3]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: 1,
        end: 3,
        step: undefined,
      });
    });

    test("slice with no bounds [:]", () => {
      expect(parseJsonSelector("foo[:]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: undefined,
        end: undefined,
        step: undefined,
      });
    });

    test("slice with end only [:3]", () => {
      expect(parseJsonSelector("foo[:3]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: undefined,
        end: 3,
        step: undefined,
      });
    });

    test("slice with start only [1:]", () => {
      expect(parseJsonSelector("foo[1:]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: 1,
        end: undefined,
        step: undefined,
      });
    });

    test("slice with step only [::2]", () => {
      expect(parseJsonSelector("foo[::2]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: undefined,
        end: undefined,
        step: 2,
      });
    });

    test("slice with start and step [1::2]", () => {
      expect(parseJsonSelector("foo[1::2]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: 1,
        end: undefined,
        step: 2,
      });
    });

    test("slice with end and step [:3:2]", () => {
      expect(parseJsonSelector("foo[:3:2]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: undefined,
        end: 3,
        step: 2,
      });
    });

    test("slice with all [1:3:2]", () => {
      expect(parseJsonSelector("foo[1:3:2]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: 1,
        end: 3,
        step: 2,
      });
    });

    test("slice with second colon but no step [::]", () => {
      expect(parseJsonSelector("foo[::]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: undefined,
        end: undefined,
        step: undefined,
      });
    });

    test("slice creates projection for field access", () => {
      expect(parseJsonSelector("foo[1:3].bar")).toStrictEqual<JsonSelector>({
        type: "project",
        expression: {
          type: "slice",
          expression: { type: "identifier", id: "foo" },
          start: 1,
          end: 3,
          step: undefined,
        },
        projection: {
          type: "fieldAccess",
          expression: { type: "current" },
          field: "bar",
        },
      });
    });
  });

  describe("pipe expressions", () => {
    test("simple pipe", () => {
      expect(parseJsonSelector("foo | bar")).toStrictEqual<JsonSelector>({
        type: "pipe",
        lhs: { type: "identifier", id: "foo" },
        rhs: { type: "identifier", id: "bar" },
      });
    });

    test("pipe is left-associative", () => {
      // a | b | c → (a | b) | c
      expect(parseJsonSelector("a | b | c")).toStrictEqual<JsonSelector>({
        type: "pipe",
        lhs: {
          type: "pipe",
          lhs: { type: "identifier", id: "a" },
          rhs: { type: "identifier", id: "b" },
        },
        rhs: { type: "identifier", id: "c" },
      });
    });
  });

  describe("quoted identifiers", () => {
    test("quoted identifier as field name", () => {
      expect(parseJsonSelector('"foo bar"')).toStrictEqual<JsonSelector>({
        type: "identifier",
        id: "foo bar",
      });
    });

    test("quoted field access", () => {
      expect(parseJsonSelector('foo."bar baz"')).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: { type: "identifier", id: "foo" },
        field: "bar baz",
      });
    });
  });

  describe("error handling", () => {
    test.each<[string, Record<string, string | number | undefined>]>([
      ["", { name: "UnexpectedEndOfInputError", offset: 0 }],
      [
        "foo.",
        {
          name: "UnexpectedTokenError",
          offset: 4,
          token: "end of input",
          expected: "identifier",
        },
      ],
      [
        "foo[",
        {
          name: "UnexpectedTokenError",
          offset: 4,
          token: "end of input",
          expected: "number, ':', '*', or string",
          context: "after '['",
        },
      ],
      [
        "foo[?x",
        {
          name: "UnexpectedTokenError",
          offset: 6,
          token: "end of input",
          expected: "']'",
        },
      ],
      ["foo !bar", { name: "UnexpectedTokenError", offset: 4, token: "!" }],
      [
        "#",
        {
          name: "UnexpectedCharacterError",
          offset: 0,
          character: "#",
        },
      ],
      [
        "(foo",
        {
          name: "UnexpectedTokenError",
          offset: 4,
          token: "end of input",
          expected: "')'",
        },
      ],
      [
        "foo[bar]",
        {
          name: "UnexpectedTokenError",
          offset: 4,
          token: "bar",
          expected: "number, ':', '*', or string",
          context: "after '['",
        },
      ],
      [
        "foo bar",
        {
          name: "UnexpectedTokenError",
          offset: 4,
          token: "bar",
          expected: "end of input",
        },
      ],
      [
        ")",
        {
          name: "UnexpectedTokenError",
          offset: 0,
          token: ")",
          expected: "expression",
        },
      ],
      [
        "]",
        {
          name: "UnexpectedTokenError",
          offset: 0,
          token: "]",
          expected: "expression",
        },
      ],
      [
        "foo[*] !bar",
        {
          name: "UnexpectedTokenError",
          offset: 7,
          token: "!",
        },
      ],
      [
        "* !foo",
        {
          name: "UnexpectedTokenError",
          offset: 2,
          token: "!",
        },
      ],
      [
        "foo[-bar]",
        {
          name: "UnexpectedTokenError",
          offset: 5,
          token: "bar",
          expected: "number",
          context: "after '[-'",
        },
      ],
      [
        "foo[:+]",
        {
          name: "UnexpectedTokenError",
          offset: 6,
          token: "]",
          expected: "number",
        },
      ],
    ])("error for %s", (input, expected) => {
      const error = catchError(() => parseJsonSelector(input));
      expect(error).toMatchObject({ ...expected, expression: input });
    });
  });

  describe("negative indices", () => {
    test("negative index access", () => {
      expect(parseJsonSelector("foo[-1]")).toStrictEqual<JsonSelector>({
        type: "indexAccess",
        expression: { type: "identifier", id: "foo" },
        index: -1,
      });
    });

    test("negative slice start", () => {
      expect(parseJsonSelector("foo[-2:]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: -2,
        end: undefined,
        step: undefined,
      });
    });

    test("negative slice end", () => {
      expect(parseJsonSelector("foo[:-1]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: undefined,
        end: -1,
        step: undefined,
      });
    });

    test("negative slice step", () => {
      expect(parseJsonSelector("foo[::-1]")).toStrictEqual<JsonSelector>({
        type: "slice",
        expression: { type: "identifier", id: "foo" },
        start: undefined,
        end: undefined,
        step: -1,
      });
    });
  });

  describe("keyword literals", () => {
    test("true keyword", () => {
      expect(parseJsonSelector("true")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: true,
      });
    });

    test("false keyword", () => {
      expect(parseJsonSelector("false")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: false,
      });
    });

    test("null keyword", () => {
      expect(parseJsonSelector("null")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: null,
      });
    });
  });

  describe("multi-select list", () => {
    test("multi-select list with 3+ items", () => {
      const result = parseJsonSelector("[a, b, c]");
      assert(result.type === "multiSelectList");
      expect(result.expressions).toHaveLength(3);
      expect(result.expressions[0]).toStrictEqual({
        type: "identifier",
        id: "a",
      });
      expect(result.expressions[1]).toStrictEqual({
        type: "identifier",
        id: "b",
      });
      expect(result.expressions[2]).toStrictEqual({
        type: "identifier",
        id: "c",
      });
    });

    test("multi-select list starting with unary minus", () => {
      const result = parseJsonSelector("[-a, b]");
      assert(result.type === "multiSelectList");
      expect(result.expressions).toHaveLength(2);
      expect(result.expressions[0]).toStrictEqual({
        type: "unaryArithmetic",
        operator: "-",
        expression: { type: "identifier", id: "a" },
      });
      expect(result.expressions[1]).toStrictEqual({
        type: "identifier",
        id: "b",
      });
    });

    test("multi-select list starting with star", () => {
      const result = parseJsonSelector("[*, foo]");
      assert(result.type === "multiSelectList");
      expect(result.expressions).toHaveLength(2);
      expect(result.expressions[0].type).toBe("objectProject");
      expect(result.expressions[1]).toStrictEqual({
        type: "identifier",
        id: "foo",
      });
    });
  });

  describe("object projection RHS", () => {
    test("object projection with field access RHS", () => {
      const result = parseJsonSelector("foo.*.bar");
      expect(result).toStrictEqual<JsonSelector>({
        type: "objectProject",
        expression: { type: "identifier", id: "foo" },
        projection: {
          type: "fieldAccess",
          expression: { type: "current" },
          field: "bar",
        },
      });
    });

    test("chained object projection has objectProject as projection", () => {
      // foo.*.* - the first .* creates objectProject(foo), the second .* is the projection
      const result = parseJsonSelector("foo.*.*");
      assert(result.type === "objectProject");
      expect(result.projection?.type).toBe("objectProject");
    });
  });

  describe("let expressions", () => {
    test("parses basic let binding and variable reference", () => {
      expect(
        parseJsonSelector("let $x = foo in $x"),
      ).toStrictEqual<JsonSelector>({
        type: "let",
        bindings: [{ name: "x", value: { type: "identifier", id: "foo" } }],
        expression: { type: "variableRef", name: "x" },
      });
    });

    test("parses multiple bindings", () => {
      expect(
        parseJsonSelector("let $x = a, $y = b in [$x, $y]"),
      ).toStrictEqual<JsonSelector>({
        type: "let",
        bindings: [
          { name: "x", value: { type: "identifier", id: "a" } },
          { name: "y", value: { type: "identifier", id: "b" } },
        ],
        expression: {
          type: "multiSelectList",
          expressions: [
            { type: "variableRef", name: "x" },
            { type: "variableRef", name: "y" },
          ],
        },
      });
    });

    test("parses nested let", () => {
      expect(
        parseJsonSelector("let $x = a in let $y = b in [$x, $y]"),
      ).toStrictEqual<JsonSelector>({
        type: "let",
        bindings: [{ name: "x", value: { type: "identifier", id: "a" } }],
        expression: {
          type: "let",
          bindings: [{ name: "y", value: { type: "identifier", id: "b" } }],
          expression: {
            type: "multiSelectList",
            expressions: [
              { type: "variableRef", name: "x" },
              { type: "variableRef", name: "y" },
            ],
          },
        },
      });
    });

    test("treats let and in as normal identifiers when not in let syntax", () => {
      expect(parseJsonSelector("let")).toStrictEqual<JsonSelector>({
        type: "identifier",
        id: "let",
      });
      expect(parseJsonSelector("in")).toStrictEqual<JsonSelector>({
        type: "identifier",
        id: "in",
      });
      expect(parseJsonSelector("foo.let")).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: { type: "identifier", id: "foo" },
        field: "let",
      });
    });

    test("parses standalone variable reference", () => {
      expect(parseJsonSelector("$foo")).toStrictEqual<JsonSelector>({
        type: "variableRef",
        name: "foo",
      });
    });

    test("parses standalone root token", () => {
      expect(parseJsonSelector("$")).toStrictEqual<JsonSelector>({
        type: "root",
      });
    });

    test("rejects variable refs in subexpression rhs", () => {
      const error = catchError(() => parseJsonSelector("foo.$bar"));
      expect(error).toMatchObject({
        name: "UnexpectedTokenError",
        expression: "foo.$bar",
      });
    });

    test("requires contextual in keyword after bindings", () => {
      const error = catchError(() => parseJsonSelector("let $x = foo $x"));
      expect(error).toMatchObject({
        name: "UnexpectedTokenError",
        expression: "let $x = foo $x",
        expected: "'in'",
        context: "after let bindings",
      });
    });
  });
});
