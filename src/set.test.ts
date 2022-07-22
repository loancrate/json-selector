import { setWithJsonSelector } from "./set";
import { parseJsonSelector } from "./parse";

const obj = {
  foo: {
    bar: [{ id: "id", value: 42 }],
  },
};

test("setWithJsonSelector", () => {
  const oldValue = setWithJsonSelector(
    parseJsonSelector("foo.bar['id'].value"),
    obj,
    86
  );
  expect(oldValue).toBe(42);
  expect(obj.foo.bar[0].value).toBe(86);
});
