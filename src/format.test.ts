import { formatJsonSelector } from "./format";

test("formatJsonSelector", () => {
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
