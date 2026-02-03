import { JsonSelector } from "../src/ast";
import { parseJsonSelector } from "../src/parse";

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
            },
          },
        },
      );
    });

    test("complex filter with projection", () => {
      expect(
        parseJsonSelector("foo[].bar[?baz.kind == `primary`][].baz | [0]"),
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
      });
    });

    test("current with field access", () => {
      expect(parseJsonSelector("@.foo")).toStrictEqual<JsonSelector>({
        type: "fieldAccess",
        expression: { type: "current" },
        field: "foo",
      });
    });

    test("current with index access", () => {
      expect(parseJsonSelector("@[0]")).toStrictEqual<JsonSelector>({
        type: "indexAccess",
        expression: { type: "current" },
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
      });
    });

    test("backtick string literal", () => {
      expect(parseJsonSelector('`"hello"`')).toStrictEqual<JsonSelector>({
        type: "literal",
        value: "hello",
      });
    });

    test("backtick null literal", () => {
      expect(parseJsonSelector("`null`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: null,
      });
    });

    test("backtick true literal", () => {
      expect(parseJsonSelector("`true`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: true,
      });
    });

    test("backtick false literal", () => {
      expect(parseJsonSelector("`false`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: false,
      });
    });

    test("backtick object literal", () => {
      expect(parseJsonSelector('`{"a":1}`')).toStrictEqual<JsonSelector>({
        type: "literal",
        value: { a: 1 },
      });
    });

    test("backtick array literal", () => {
      expect(parseJsonSelector("`[1, 2, 3]`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: [1, 2, 3],
      });
    });

    test("backtick invalid JSON falls back to string", () => {
      expect(parseJsonSelector("`invalid`")).toStrictEqual<JsonSelector>({
        type: "literal",
        value: "invalid",
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
    test("empty string throws", () => {
      expect(() => parseJsonSelector("")).toThrow("Unexpected end of input");
    });

    test("trailing dot throws", () => {
      expect(() => parseJsonSelector("foo.")).toThrow(
        "Expected identifier at position",
      );
    });

    test("unclosed bracket throws", () => {
      expect(() => parseJsonSelector("foo[")).toThrow(/Unexpected/);
    });

    test("unclosed filter throws", () => {
      expect(() => parseJsonSelector("foo[?x")).toThrow(/Expected.*]/);
    });

    test("! in infix position throws (hits line 306)", () => {
      // This hits the default case in led() because ! is a prefix-only operator
      expect(() => parseJsonSelector("foo !bar")).toThrow(
        "Unexpected token at position",
      );
    });

    test("unexpected character throws", () => {
      expect(() => parseJsonSelector("#")).toThrow("Unexpected character");
    });

    test("unclosed paren throws", () => {
      expect(() => parseJsonSelector("(foo")).toThrow(/Expected.*\)/);
    });

    test("unexpected token after [ throws", () => {
      // [foo] where foo is an identifier - not a valid bracket expression
      expect(() => parseJsonSelector("[foo]")).toThrow(
        "Unexpected token after '['",
      );
    });

    test("trailing tokens throws", () => {
      expect(() => parseJsonSelector("foo bar")).toThrow(
        "Unexpected token at position",
      );
    });

    test("unexpected ) at start throws (hits nud default case)", () => {
      // ) in nud position - lexer produces RPAREN, parser doesn't handle it in nud()
      expect(() => parseJsonSelector(")")).toThrow(
        "Unexpected token at position",
      );
    });

    test("unexpected ] at start throws", () => {
      expect(() => parseJsonSelector("]")).toThrow(
        "Unexpected token at position",
      );
    });

    test("! after projection throws (hits line 484)", () => {
      // After foo[*], the ! token has bp=45 >= 10, but it's not a continuation token
      // This hits line 484 (return projectionNode) then line 306 (led default)
      expect(() => parseJsonSelector("foo[*] !bar")).toThrow(
        "Unexpected token at position",
      );
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
});
