import {
  evaluateJsonSelector,
  parseJsonSelector,
  FunctionError,
  DivideByZeroError,
  JsonSelectorError,
  JsonSelectorRuntimeError,
  JsonSelectorSyntaxError,
  JsonSelectorTypeError,
  NotANumberError,
  AccessorError,
  UnexpectedCharacterError,
  UnexpectedTokenError,
  UnknownFunctionError,
} from "../src";

import { catchError } from "./helpers";

describe("error hierarchy", () => {
  test("syntax errors inherit from syntax and base classes", () => {
    const error = catchError(() => parseJsonSelector("#"));
    expect(error).toBeInstanceOf(UnexpectedCharacterError);
    expect(error).toBeInstanceOf(JsonSelectorSyntaxError);
    expect(error).toBeInstanceOf(JsonSelectorError);
    expect(error).toBeInstanceOf(Error);
  });

  test("type errors inherit from runtime and base classes", () => {
    const error = catchError(() =>
      evaluateJsonSelector(parseJsonSelector("a + s"), { a: 1, s: "x" }),
    );
    expect(error).toBeInstanceOf(NotANumberError);
    expect(error).toBeInstanceOf(JsonSelectorTypeError);
    expect(error).toBeInstanceOf(JsonSelectorRuntimeError);
    expect(error).toBeInstanceOf(JsonSelectorError);
    expect(error).toBeInstanceOf(Error);
  });

  test("divide-by-zero errors remain not-a-number subtype", () => {
    const error = catchError(() =>
      evaluateJsonSelector(parseJsonSelector("a / b"), { a: 1, b: 0 }),
    );
    expect(error).toBeInstanceOf(DivideByZeroError);
    expect(error).toBeInstanceOf(NotANumberError);
    expect(error).toBeInstanceOf(JsonSelectorTypeError);
    expect(error).toBeInstanceOf(JsonSelectorRuntimeError);
    expect(error).toBeInstanceOf(JsonSelectorError);
    expect(error).toBeInstanceOf(Error);
  });

  test("function errors inherit from runtime and base classes", () => {
    const error = catchError(() =>
      evaluateJsonSelector(parseJsonSelector("unknown_fn()"), {}),
    );
    expect(error).toBeInstanceOf(UnknownFunctionError);
    expect(error).toBeInstanceOf(FunctionError);
    expect(error).toBeInstanceOf(JsonSelectorRuntimeError);
    expect(error).toBeInstanceOf(JsonSelectorError);
    expect(error).toBeInstanceOf(Error);
  });

  test("accessor errors inherit from runtime and base classes", () => {
    const error = new AccessorError(
      "TYPE_MISMATCH",
      "foo",
      "set",
      "test message",
    );
    expect(error).toBeInstanceOf(AccessorError);
    expect(error).toBeInstanceOf(JsonSelectorRuntimeError);
    expect(error).toBeInstanceOf(JsonSelectorError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("UnexpectedTokenError message", () => {
  test.each<{ expected?: string; context?: string; expectedMessage: string }>([
    {
      expectedMessage: "Unexpected token at position 3: ]",
    },
    {
      expected: "identifier",
      expectedMessage: "Unexpected token at position 3: ]; expected identifier",
    },
    {
      context: "after '['",
      expectedMessage: "Unexpected token at position 3: ] (after '[')",
    },
    {
      expected: "identifier",
      context: "after '['",
      expectedMessage:
        "Unexpected token at position 3: ]; expected identifier (after '[')",
    },
  ])(
    "formats expected=$expected context=$context",
    ({ expected, context, expectedMessage }) => {
      const error = new UnexpectedTokenError("foo]", 3, "]", expected, context);
      expect(error).toMatchObject({
        name: "UnexpectedTokenError",
        expression: "foo]",
        offset: 3,
        token: "]",
        expected,
        context,
        message: expectedMessage,
      });
    },
  );
});
