import { parseJsonSelector } from "../src/parse";
import { setWithJsonSelector } from "../src/set";

test("setWithJsonSelector", () => {
  {
    const obj = {
      foo: {
        bar: [{ id: "id", value: 42 }],
      },
    };

    const oldValue = setWithJsonSelector(
      parseJsonSelector("foo.bar['id'].value"),
      obj,
      86,
    );
    expect(oldValue).toBe(42);
    expect(obj.foo.bar[0].value).toBe(86);
  }
  {
    const obj = {
      foo: [
        { bar: [{ baz: { kind: "other", name: "x" } }] },
        { bar: [{}, { baz: { kind: "primary", name: "y" } }] },
        { bar: [{ baz: { kind: "secondary", name: "z" } }] },
      ],
    };
    const expectedOldValue = obj.foo[1].bar[1].baz?.name;

    const newValue = "q";
    const oldValue = setWithJsonSelector(
      parseJsonSelector('foo[].bar[?baz.kind == `"primary"`][].baz | [0].name'),
      obj,
      newValue,
    );
    expect(oldValue).toStrictEqual(expectedOldValue);
    expect(obj.foo[1].bar[1].baz?.name).toBe(newValue);
  }
});
