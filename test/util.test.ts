import { formatRawString } from "../src/util";

test("formatRawString", () => {
  expect(formatRawString("foo")).toBe("'foo'");
  expect(formatRawString("'")).toBe("'\\''");
});
