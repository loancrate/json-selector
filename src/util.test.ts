import { formatRawString } from "./util";

test("formatRawString", () => {
  expect(formatRawString("foo")).toBe("'foo'");
  expect(formatRawString("'")).toBe("'\\''");
});
