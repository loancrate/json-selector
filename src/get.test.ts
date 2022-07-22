import { getWithJsonSelector } from "./get";
import { parseJsonSelector } from "./parse";

const obj = {
  foo: {
    bar: [{ id: "id", value: 42 }],
  },
};

test("getWithJsonSelector", () => {
  expect(getWithJsonSelector(parseJsonSelector("foo"), obj)).toBe(obj.foo);
  expect(getWithJsonSelector(parseJsonSelector("foo.bar"), obj)).toBe(
    obj.foo.bar
  );
  expect(
    getWithJsonSelector(parseJsonSelector("foo.bar['id'].value"), obj)
  ).toBe(42);
});
