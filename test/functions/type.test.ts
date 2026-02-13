import { evaluate } from "../helpers";

describe("type functions", () => {
  test("type of expref", () => {
    expect(evaluate("type(&foo)", { foo: 1 })).toBe("expref");
  });

  test("type of various values", () => {
    expect(evaluate("type(@)", null)).toBe("null");
    expect(evaluate("type(@)", true)).toBe("boolean");
    expect(evaluate("type(@)", 42)).toBe("number");
    expect(evaluate("type(@)", "hello")).toBe("string");
    expect(evaluate("type(@)", [1, 2])).toBe("array");
    expect(evaluate("type(@)", { a: 1 })).toBe("object");
  });

  test("type of undefined returns null", () => {
    expect(evaluate("type(@)", undefined)).toBe("null");
  });

  test("to_string", () => {
    expect(evaluate("to_string(@)", "hello")).toBe("hello");
    expect(evaluate("to_string(@)", 42)).toBe("42");
  });

  test("to_number", () => {
    expect(evaluate("to_number(@)", 42)).toBe(42);
    expect(evaluate("to_number(@)", "42")).toBe(42);
    expect(evaluate("to_number(@)", "abc")).toBeNull();
    expect(evaluate("to_number(@)", true)).toBeNull();
  });

  test("to_number returns null for empty and whitespace strings", () => {
    expect(evaluate("to_number(@)", "")).toBeNull();
    expect(evaluate("to_number(@)", "  ")).toBeNull();
    expect(evaluate("to_number(@)", "\t\n")).toBeNull();
  });

  test("to_array", () => {
    expect(evaluate("to_array(@)", [1, 2])).toStrictEqual([1, 2]);
    expect(evaluate("to_array(@)", 42)).toStrictEqual([42]);
  });
});
