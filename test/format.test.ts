import { JsonSelector } from "../src/ast";
import { formatJsonSelector } from "../src/format";

describe("formatJsonSelector", () => {
  describe("simple nodes", () => {
    test.each<[string, JsonSelector, string]>([
      ["current", { type: "current" }, "@"],
      ["root", { type: "root" }, "$"],
      ["identifier", { type: "identifier", id: "foo" }, "foo"],
    ])("formats %s node", (_name, selector, expected) => {
      expect(formatJsonSelector(selector)).toBe(expected);
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
      ).toBe("a == `1` && (b == `2` || c == `3`)");
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
      ).toBe('foo[].bar[?baz.kind == `"primary"`][].baz | [0]');
    });
  });
});
