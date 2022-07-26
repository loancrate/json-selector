import { JsonSelector } from "./ast";
import { parseJsonSelector } from "./parse";

test("parseJsonSelector", () => {
  expect(parseJsonSelector("foo")).toStrictEqual<JsonSelector>({
    type: "identifier",
    id: "foo",
  });
  expect(parseJsonSelector("foo.bar")).toStrictEqual<JsonSelector>({
    type: "fieldAccess",
    expression: { type: "identifier", id: "foo" },
    field: "bar",
  });
  expect(parseJsonSelector("foo.bar.baz")).toStrictEqual<JsonSelector>({
    type: "fieldAccess",
    expression: {
      type: "fieldAccess",
      expression: { type: "identifier", id: "foo" },
      field: "bar",
    },
    field: "baz",
  });
  expect(parseJsonSelector("foo.bar['id'].value")).toStrictEqual<JsonSelector>({
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
  expect(parseJsonSelector("foo[]")).toStrictEqual<JsonSelector>({
    type: "flatten",
    expression: {
      type: "identifier",
      id: "foo",
    },
  });
  expect(parseJsonSelector("foo[?bar == `1`]")).toStrictEqual<JsonSelector>({
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
  });
  expect(
    parseJsonSelector("foo[].bar[?baz.kind == `primary`][].baz | [0]")
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
