import { parseJsonSelector } from "./parse";

test("parseJsonSelector", () => {
  expect(parseJsonSelector("foo")).toStrictEqual({
    type: "identifier",
    id: "foo",
  });
  expect(parseJsonSelector("foo.bar")).toStrictEqual({
    type: "fieldAccess",
    expression: { type: "identifier", id: "foo" },
    field: "bar",
  });
  expect(parseJsonSelector("foo.bar['id'].value")).toStrictEqual({
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
