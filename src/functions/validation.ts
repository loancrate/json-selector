import { NonEmptyArray } from "../util";
import {
  InvalidArgumentTypeError,
  InvalidArgumentValueError,
  InvalidArityError,
} from "../errors";
import { DataType, formatType, getDataType, matchesType } from "./datatype";
import { ArgumentSignature, FunctionArg } from "./types";

/**
 * Validate function arguments against a list of possible signatures.
 * Returns the index of the matching signature, or throws an error.
 */
export function validateArguments(
  name: string,
  args: FunctionArg[],
  signatures: NonEmptyArray<ArgumentSignature[]>,
): void {
  for (const signature of signatures) {
    if (matchesSignature(args, signature)) {
      return;
    }
  }

  // Find the closest matching signature for the best error message
  const bestSignature =
    signatures.length === 1
      ? signatures[0]
      : findClosestSignature(args, signatures);
  throwValidationError(name, args, bestSignature);
}

/** Returns the variadic parameter if the signature ends with one, or undefined. */
function getVariadicParam(
  signature: ArgumentSignature[],
): ArgumentSignature | undefined {
  const lastParam = signature.at(-1);
  return lastParam?.variadic ? lastParam : undefined;
}

/**
 * Check if arguments match a specific signature.
 */
function matchesSignature(
  args: FunctionArg[],
  signature: ArgumentSignature[],
): boolean {
  const variadicParam = getVariadicParam(signature);

  // Count required arguments
  let minArgs = 0;
  const maxArgs = variadicParam ? Infinity : signature.length;

  for (const param of signature) {
    if (!param.optional && !param.variadic) {
      ++minArgs;
    }
  }
  if (variadicParam && !variadicParam.optional) {
    ++minArgs;
  }

  // Check argument count
  if (args.length < minArgs || args.length > maxArgs) {
    return false;
  }

  // Check each argument type (extra args validate against variadic param)
  for (let i = 0; i < args.length; i++) {
    const param = i < signature.length ? signature[i] : variadicParam;
    if (!param || !matchesType(args[i], param.type)) {
      return false;
    }
  }

  return true;
}

/**
 * Find the signature that most closely matches the given arguments.
 * Scores by number of matching argument types.
 */
function findClosestSignature(
  args: FunctionArg[],
  signatures: NonEmptyArray<ArgumentSignature[]>,
): ArgumentSignature[] {
  let bestScore = -1;
  let bestSignature = signatures[0];

  for (const signature of signatures) {
    let score = 0;
    const variadicParam = getVariadicParam(signature);
    const maxCheck = variadicParam
      ? args.length
      : Math.min(args.length, signature.length);
    for (let i = 0; i < maxCheck; i++) {
      const param = i < signature.length ? signature[i] : variadicParam;
      if (param && matchesType(args[i], param.type)) {
        ++score;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSignature = signature;
    }
  }

  return bestSignature;
}

/**
 * Throw a validation error with a descriptive message.
 */
function throwValidationError(
  name: string,
  args: FunctionArg[],
  signature: ArgumentSignature[],
): void {
  const variadicParam = getVariadicParam(signature);

  // Count required arguments
  let minArgs = 0;
  for (const param of signature) {
    if (!param.optional && !param.variadic) {
      ++minArgs;
    }
  }
  if (variadicParam && !variadicParam.optional) {
    ++minArgs;
  }
  const maxArgs = variadicParam ? Infinity : signature.length;

  // Check argument count first
  if (args.length < minArgs) {
    throw new InvalidArityError(
      name,
      variadicParam
        ? `expected at least ${minArgs} argument${minArgs !== 1 ? "s" : ""}, got ${args.length}`
        : `expected ${minArgs} argument${minArgs !== 1 ? "s" : ""}, got ${args.length}`,
    );
  }

  if (args.length > maxArgs) {
    throw new InvalidArityError(
      name,
      `expected at most ${maxArgs} argument${maxArgs !== 1 ? "s" : ""}, got ${args.length}`,
    );
  }

  // Find the first type mismatch
  for (let i = 0; i < args.length; i++) {
    const param = signature[i] ?? variadicParam;
    if (param && !matchesType(args[i], param.type)) {
      const actualType = formatType(getDataType(args[i]));
      const expectedType = formatType(param.type);
      throw new InvalidArgumentTypeError(
        name,
        param.name,
        `argument ${param.name} at position ${i + 1}: expected ${expectedType}, got ${actualType}`,
      );
    }
  }

  // Unreachable: this function is only called when no signature matched, so
  // one of the above branches (arity or type mismatch) should always throw.
}

/**
 * Validate that a number is an integer.
 */
export function requireInteger(
  functionName: string,
  argumentName: string,
  value: number,
): number {
  if (!Number.isInteger(value)) {
    throw new InvalidArgumentValueError(
      functionName,
      argumentName,
      `${argumentName} must be an integer, got ${value}`,
    );
  }
  return value;
}

/**
 * Validate that a number is a non-negative integer.
 */
export function requireNonNegativeInteger(
  functionName: string,
  argumentName: string,
  value: number,
): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidArgumentValueError(
      functionName,
      argumentName,
      `${argumentName} must be a non-negative integer, got ${value}`,
    );
  }
  return value;
}

/**
 * Helper to create a required argument signature.
 */
export function arg(name: string, type: DataType): ArgumentSignature {
  return { name, type };
}

/**
 * Helper to create an optional argument signature.
 */
export function optArg(name: string, type: DataType): ArgumentSignature {
  return { name, type, optional: true };
}

/**
 * Helper to create a variadic argument signature.
 * Must be the last parameter in a signature. Accepts one or more arguments of the given type.
 */
export function varArg(name: string, type: DataType): ArgumentSignature {
  return { name, type, variadic: true };
}
