import { formatJsonSelector } from "../src/format";

test("formatJsonSelector", () => {
  expect(
    formatJsonSelector({
      type: "current",
    })
  ).toBe("@");
  expect(
    formatJsonSelector({
      type: "root",
    })
  ).toBe("$");
  expect(
    formatJsonSelector({
      type: "identifier",
      id: "foo",
    })
  ).toBe("foo");
  expect(
    formatJsonSelector({
      type: "fieldAccess",
      expression: { type: "identifier", id: "foo" },
      field: "bar",
    })
  ).toBe("foo.bar");
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
    })
  ).toBe("!foo.bar.baz");
  expect(
    formatJsonSelector({
      type: "slice",
      expression: { type: "identifier", id: "foo" },
      start: 1,
      end: 3,
      step: undefined,
    })
  ).toBe("foo[1:3]");
  expect(
    formatJsonSelector({
      type: "slice",
      expression: { type: "identifier", id: "foo" },
      start: undefined,
      end: 1,
      step: 3,
    })
  ).toBe("foo[:1:3]");
  expect(
    formatJsonSelector({
      type: "slice",
      expression: { type: "identifier", id: "foo" },
      start: 1,
      end: undefined,
      step: 3,
    })
  ).toBe("foo[1::3]");
  expect(
    formatJsonSelector({
      type: "project",
      expression: { type: "identifier", id: "foo" },
      projection: {
        type: "fieldAccess",
        expression: { type: "current" },
        field: "bar",
      },
    })
  ).toBe("foo[*].bar");
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
    })
  ).toBe("a == `1` && (b == `2` || c == `3`)");
  expect(
    formatJsonSelector({
      type: "fieldAccess",
      expression: { type: "identifier", id: "foo" },
      field: "dashed-field",
    })
  ).toBe('foo."dashed-field"');
  expect(
    formatJsonSelector({
      type: "indexAccess",
      expression: { type: "identifier", id: "foo" },
      index: 42,
    })
  ).toBe("foo[42]");
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
    })
  ).toBe("foo.bar['my\\\\\\'id'].value");
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
    })
  ).toBe('foo[].bar[?baz.kind == `"primary"`][].baz | [0]');
});
