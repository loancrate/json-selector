/**
 * Base class for all json-selector library errors.
 */
export class JsonSelectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Base class for parse-time errors.
 */
export class JsonSelectorSyntaxError extends JsonSelectorError {
  constructor(
    message: string,
    public readonly expression: string,
    public readonly offset: number,
  ) {
    super(message);
  }
}

/**
 * Lexer error for unknown/invalid characters.
 */
export class UnexpectedCharacterError extends JsonSelectorSyntaxError {
  constructor(
    expression: string,
    offset: number,
    public readonly character: string,
  ) {
    super(
      `Unexpected character at position ${offset}: ${character}`,
      expression,
      offset,
    );
  }
}

/**
 * Lexer error for missing closing delimiters.
 */
export class UnterminatedTokenError extends JsonSelectorSyntaxError {
  constructor(
    expression: string,
    offset: number,
    public readonly tokenKind: string,
    public readonly expectedDelimiter: string,
  ) {
    super(
      `Unterminated ${tokenKind} at position ${offset}: expected closing ${expectedDelimiter}`,
      expression,
      offset,
    );
  }
}

/**
 * Lexer error for malformed token internals.
 */
export class InvalidTokenError extends JsonSelectorSyntaxError {
  constructor(
    expression: string,
    offset: number,
    public readonly tokenKind: string,
    public readonly detail: string,
  ) {
    super(
      `Invalid ${tokenKind} at position ${offset}: ${detail}`,
      expression,
      offset,
    );
  }
}

/**
 * Parser/lexer error for an unexpected token.
 */
export class UnexpectedTokenError extends JsonSelectorSyntaxError {
  constructor(
    expression: string,
    offset: number,
    public readonly token: string,
    public readonly expected?: string,
    public readonly context?: string,
  ) {
    const expectedPart = expected ? `; expected ${expected}` : "";
    const contextPart = context ? ` (${context})` : "";
    super(
      `Unexpected token at position ${offset}: ${token}${expectedPart}${contextPart}`,
      expression,
      offset,
    );
  }
}

/**
 * Parser error for unexpected EOF.
 */
export class UnexpectedEndOfInputError extends JsonSelectorSyntaxError {
  constructor(
    expression: string,
    public readonly expected?: string,
  ) {
    super("Unexpected end of input", expression, expression.length);
  }
}

/**
 * Base class for evaluation/runtime errors.
 */
export class JsonSelectorRuntimeError extends JsonSelectorError {}

/**
 * Base class for runtime type errors.
 */
export class JsonSelectorTypeError extends JsonSelectorRuntimeError {}

export type AccessorErrorCode =
  | "NOT_WRITABLE"
  | "MISSING_PARENT"
  | "TYPE_MISMATCH"
  | "INDEX_OUT_OF_BOUNDS"
  | "MISSING_ID";

/**
 * Error thrown when an accessor operation cannot be applied to the given context.
 */
export class AccessorError extends JsonSelectorRuntimeError {
  constructor(
    public readonly code: AccessorErrorCode,
    public readonly path: string,
    public readonly operation: "get" | "set" | "delete",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Error thrown when reading an unbound lexical-scope variable.
 */
export class UndefinedVariableError extends JsonSelectorRuntimeError {
  constructor(public readonly variableName: string) {
    super(`Undefined variable: $${variableName}`);
  }
}

/**
 * Error thrown when arithmetic requires a number but receives another type.
 */
export class NotANumberError extends JsonSelectorTypeError {
  constructor(
    public readonly operator: string,
    public readonly operandRole: string,
    public readonly actualType: string,
    message?: string,
  ) {
    super(
      message ??
        `Expected number for ${operandRole} of '${operator}', got ${actualType}`,
    );
  }
}

/**
 * Error thrown when division or integer division has a zero divisor.
 */
export class DivideByZeroError extends NotANumberError {
  constructor(
    operator: "/" | "//",
    public readonly divisor: number,
  ) {
    super(
      operator,
      "right operand",
      "number",
      `Division by zero for '${operator}' (right operand: ${String(divisor)})`,
    );
  }
}

/**
 * Base error class for all function-related errors.
 */
export class FunctionError extends JsonSelectorRuntimeError {
  constructor(
    public readonly functionName: string,
    message: string,
  ) {
    super(`${functionName}(): ${message}`);
  }
}

/**
 * Error thrown when an unknown function is called.
 */
export class UnknownFunctionError extends FunctionError {
  constructor(functionName: string) {
    super(functionName, "unknown function");
  }
}

/**
 * Error thrown when a function is called with the wrong number of arguments.
 */
export class InvalidArityError extends FunctionError {
  constructor(functionName: string, message: string) {
    super(functionName, message);
  }
}

/** Base error for argument-level validation failures, carrying both the function and argument names. */
export class InvalidArgumentError extends FunctionError {
  constructor(
    functionName: string,
    public readonly argumentName: string,
    message: string,
  ) {
    super(functionName, message);
  }
}

/**
 * Error thrown when a function argument has the wrong type.
 */
export class InvalidArgumentTypeError extends InvalidArgumentError {
  constructor(functionName: string, argumentName: string, message: string) {
    super(functionName, argumentName, message);
  }
}

/**
 * Error thrown when a function argument has a valid type but an invalid value
 * (e.g. negative integer where non-negative is required, non-integer float, pad string length != 1).
 */
export class InvalidArgumentValueError extends InvalidArgumentError {
  constructor(functionName: string, argumentName: string, message: string) {
    super(functionName, argumentName, message);
  }
}
