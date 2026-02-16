import type { FunctionProvider } from "./functions/provider";

/**
 * Immutable runtime evaluation scope shared across expression evaluation.
 * This context is evaluation-only; parser/lexer compatibility options are
 * configured separately via parse options.
 */
export type EvaluationContext = {
  /** The root document (`$`). */
  rootContext: unknown;
  /** Function provider for built-in and custom functions. */
  functionProvider: FunctionProvider;
  /** Lexical-scope variable bindings (name without `$` -> value). */
  bindings?: ReadonlyMap<string, unknown>;
  /** Enables legacy null propagation for multi-select expressions. */
  legacyNullPropagation?: boolean;
};
