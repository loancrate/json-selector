import { formatRawString, isFalseOrEmpty } from "../src/util";

test("formatRawString", () => {
  expect(formatRawString("foo")).toBe("'foo'");
  expect(formatRawString("'")).toBe("'\\''");
});

test("isFalseOrEmpty with object having only inherited properties", () => {
  const proto = { inherited: 1 };
  const obj: unknown = Object.create(proto);
  // obj has no own properties, only inherited ones
  expect(isFalseOrEmpty(obj)).toBe(true);
});
