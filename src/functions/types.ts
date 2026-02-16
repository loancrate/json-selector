import { JsonSelector } from "../ast";
import type { EvaluationContext } from "../evaluation-context";
import { NonEmptyArray } from "../util";

import { DataType } from "./datatype";

/**
 * Common evaluation context shared by function call and handler bindings.
 */
export interface EvaluationBindings extends EvaluationContext {
  /** The current evaluation context (`@`). */
  context: unknown;
  /** Callback to evaluate a {@link JsonSelector} against a given context. */
  evaluate: (selector: JsonSelector, ctx: unknown) => unknown;
}

/**
 * Bindings passed to `callFunction` to invoke a function.
 */
export interface FunctionCallArgs extends EvaluationBindings {
  /** Unevaluated expression arguments from the AST. */
  args: JsonSelector[];
}

/**
 * A resolved function argument: any JSON value or an {@link ExpressionRef}.
 */
export type FunctionArg = unknown;

/**
 * Bindings passed to a {@link FunctionHandler} when it is called.
 */
export interface FunctionCallBindings extends EvaluationBindings {
  /** Validated arguments (already checked against the matching signature). */
  args: FunctionArg[];
}

/**
 * Describes a single function parameter: which types it accepts and whether it is optional.
 */
export interface ArgumentSignature {
  /** Name of this parameter for error messages. */
  name: string;
  /** Type accepted at this parameter position. */
  type: DataType;
  /** If true, the caller may omit this argument. Optional parameters must be trailing. */
  optional?: boolean;
  /**
   * If true, this parameter accepts any number of additional arguments of the same type.
   * Must only appear on the last parameter in a signature.
   * When combined with `optional`, zero variadic arguments are accepted;
   * otherwise at least one argument at this position is required.
   */
  variadic?: boolean;
}

/**
 * Implementation of a built-in or custom function.
 */
export type FunctionHandler = (bindings: FunctionCallBindings) => unknown;

/**
 * A registered function: its name, accepted signatures (overloads), and implementation.
 */
export interface FunctionDefinition {
  /** Function name as it appears in expressions (e.g. `"length"`). */
  name: string;
  /**
   * One or more overloaded signatures. Each inner array is a complete parameter list;
   * validation succeeds if the arguments match any one of them.
   */
  signatures: NonEmptyArray<ArgumentSignature[]>;
  /** Implementation called after argument validation succeeds. */
  handler: FunctionHandler;
}
