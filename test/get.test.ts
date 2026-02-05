import { getWithJsonSelector } from "../src/get";
import { parseJsonSelector } from "../src/parse";

test("getWithJsonSelector", () => {
  {
    const obj = {
      foo: {
        bar: [{ id: "id", value: 42 }],
      },
    };

    expect(getWithJsonSelector(parseJsonSelector("foo"), obj)).toBe(obj.foo);
    expect(getWithJsonSelector(parseJsonSelector("foo.bar"), obj)).toBe(
      obj.foo.bar,
    );
    expect(
      getWithJsonSelector(parseJsonSelector("foo.bar['id'].value"), obj),
    ).toBe(42);
  }
  {
    const obj = {
      foo: [
        { bar: [{ baz: { kind: "other", name: "x" } }] },
        { bar: [{ baz: { kind: "primary", name: "y" } }] },
        { bar: [{ baz: { kind: "secondary", name: "z" } }] },
      ],
    };
    expect(
      getWithJsonSelector(
        parseJsonSelector("foo[].bar[?baz.kind == `primary`][].baz | [0].name"),
        obj,
      ),
    ).toBe("y");
  }
});
