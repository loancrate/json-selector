import { ArgumentSignature } from "../../src";
import {
  ANY_TYPE,
  NUMBER_TYPE,
  STRING_TYPE,
} from "../../src/functions/datatype";
import {
  arg,
  InvalidArgumentTypeError,
  InvalidArityError,
  validateArguments,
  varArg,
} from "../../src/functions/validation";

describe("validation", () => {
  test("empty signature accepts zero arguments", () => {
    expect(() => validateArguments("test_fn", [], [[]])).not.toThrow();
  });

  test("empty signature rejects any arguments", () => {
    expect(() => validateArguments("test_fn", [1], [[]])).toThrow(
      InvalidArityError,
    );
  });

  test("throws InvalidArityError for too few arguments", () => {
    expect(() =>
      validateArguments("test_fn", [], [[arg("value", NUMBER_TYPE)]]),
    ).toThrow(InvalidArityError);
  });

  test("throws InvalidArityError for too many arguments", () => {
    expect(() =>
      validateArguments("test_fn", [1, 2, 3], [[arg("value", NUMBER_TYPE)]]),
    ).toThrow(InvalidArityError);
  });

  test("throws InvalidArityError with plural for too few arguments", () => {
    expect(() =>
      validateArguments(
        "test_fn",
        [],
        [[arg("a", NUMBER_TYPE), arg("b", NUMBER_TYPE)]],
      ),
    ).toThrow("expected 2 arguments, got 0");
  });

  test("throws InvalidArityError with plural for too many arguments", () => {
    expect(() =>
      validateArguments(
        "test_fn",
        [1, 2, 3],
        [[arg("a", NUMBER_TYPE), arg("b", NUMBER_TYPE)]],
      ),
    ).toThrow("expected at most 2 arguments, got 3");
  });

  test("throws InvalidArgumentTypeError for type mismatch", () => {
    expect(() =>
      validateArguments("test_fn", ["string"], [[arg("value", NUMBER_TYPE)]]),
    ).toThrow(InvalidArgumentTypeError);
  });

  test("varArg creates a variadic argument signature", () => {
    const sig = varArg("arg", ANY_TYPE);
    expect(sig.name).toBe("arg");
    expect(sig.type).toBe(ANY_TYPE);
    expect(sig.variadic).toBe(true);
    expect(sig.optional).toBeUndefined();
  });

  test("variadic signature accepts one argument", () => {
    expect(() =>
      validateArguments("test_fn", [1], [[varArg("value", NUMBER_TYPE)]]),
    ).not.toThrow();
  });

  test("variadic signature accepts many arguments", () => {
    expect(() =>
      validateArguments(
        "test_fn",
        [1, 2, 3, 4, 5],
        [[varArg("value", NUMBER_TYPE)]],
      ),
    ).not.toThrow();
  });

  test("variadic signature rejects zero arguments when required", () => {
    try {
      validateArguments("test_fn", [], [[varArg("value", NUMBER_TYPE)]]);
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidArityError);
      expect(e).toHaveProperty(
        "message",
        expect.stringContaining("expected at least 1 argument, got 0"),
      );
    }
  });

  test("variadic signature type-checks all arguments", () => {
    expect(() =>
      validateArguments(
        "test_fn",
        [1, "string", 3],
        [[varArg("value", NUMBER_TYPE)]],
      ),
    ).toThrow(InvalidArgumentTypeError);
  });

  test("variadic with preceding required args", () => {
    expect(() =>
      validateArguments(
        "test_fn",
        ["hello", 1, 2, 3],
        [[arg("name", STRING_TYPE), varArg("value", NUMBER_TYPE)]],
      ),
    ).not.toThrow();
  });

  test("variadic with preceding required args rejects too few", () => {
    try {
      validateArguments(
        "test_fn",
        ["hello"],
        [[arg("name", STRING_TYPE), varArg("value", NUMBER_TYPE)]],
      );
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidArityError);
      expect(e).toHaveProperty(
        "message",
        expect.stringContaining("expected at least 2 arguments, got 1"),
      );
    }
  });

  test("findClosestSignature picks best matching overload", () => {
    // Overloaded function: (number, number) | (string, number)
    // Passing ("hello", "world") scores 0 for first sig, 1 for second
    // (first arg matches string), so error reports against second sig.
    const signatures: [ArgumentSignature[], ArgumentSignature[]] = [
      [arg("a", NUMBER_TYPE), arg("b", NUMBER_TYPE)],
      [arg("a", STRING_TYPE), arg("b", NUMBER_TYPE)],
    ];
    expect(() =>
      validateArguments("overloaded", ["hello", "world"], signatures),
    ).toThrow(/argument b at position 2: expected number, got string/);
  });

  test("findClosestSignature falls back to first when scores tie", () => {
    const signatures: [ArgumentSignature[], ArgumentSignature[]] = [
      [arg("a", NUMBER_TYPE)],
      [arg("a", STRING_TYPE)],
    ];
    // Pass a boolean which matches neither - both score 0, first wins
    expect(() => validateArguments("overloaded", [true], signatures)).toThrow(
      /argument a at position 1: expected number, got boolean/,
    );
  });

  test("findClosestSignature picks variadic overload when it scores best", () => {
    // Overloaded function: (number, number) | (string...)
    // Passing ("a", "b") scores 0 for first sig, 2 for second
    const signatures: [ArgumentSignature[], ArgumentSignature[]] = [
      [arg("a", NUMBER_TYPE), arg("b", NUMBER_TYPE)],
      [varArg("value", STRING_TYPE)],
    ];
    // Pass ("a", 42) — variadic scores 1 (first arg matches string),
    // first sig scores 1 (second arg matches number). Tie → first wins.
    // But ("a", "b", 42) — variadic scores 2, first sig scores 0.
    expect(() =>
      validateArguments("overloaded", ["a", "b", 42], signatures),
    ).toThrow(/argument value at position 3: expected string, got number/);
  });
});
