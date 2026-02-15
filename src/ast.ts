import { JsonValue } from "type-fest";

/** Discriminator string for each AST node variant, used for exhaustive pattern matching. */
export type JsonSelectorNodeType = JsonSelector["type"];

/** The current context value (`@`), implicit when no explicit token is written. */
export interface JsonSelectorCurrent {
  type: "current";
  /** When true, the `@` token was explicitly written (not an implicit placeholder). */
  explicit?: boolean;
}

/** Reference to the root document (`$`), enabling access to top-level data from nested contexts. */
export interface JsonSelectorRoot {
  type: "root";
}

/** A constant JSON value embedded directly in the expression (e.g. `'hello'`, `` `42` ``, `true`). */
export interface JsonSelectorLiteral {
  type: "literal";
  value: JsonValue;
  /** When true, this literal was written with backtick syntax (e.g., `` `true` `` instead of bare `true`). */
  backtickSyntax?: boolean;
}

/** A bare field name applied to the current context, e.g. `foo`. */
export interface JsonSelectorIdentifier {
  type: "identifier";
  id: string;
}

/** Dot-notation property access on a sub-expression, e.g. `expr.field`. */
export interface JsonSelectorFieldAccess {
  type: "fieldAccess";
  expression: JsonSelector;
  field: string;
}

/** Numeric array index access on a sub-expression, e.g. `expr[0]` or `expr[-1]`. */
export interface JsonSelectorIndexAccess {
  type: "indexAccess";
  expression: JsonSelector;
  index: number;
}

/** LoanCrate extension: selects an array element by its `id` property, e.g. `expr['my-id']`. */
export interface JsonSelectorIdAccess {
  type: "idAccess";
  expression: JsonSelector;
  id: string;
}

/** Array wildcard projection (`[*]`), applying an optional sub-expression to each element. */
export interface JsonSelectorProject {
  type: "project";
  expression: JsonSelector;
  projection?: JsonSelector;
}

/** Wildcard projection over object values (`.*`), optionally applying a sub-expression to each value. */
export interface JsonSelectorObjectProject {
  type: "objectProject";
  expression: JsonSelector;
  projection?: JsonSelector;
}

/** Array filter that retains only elements where the condition is truthy, e.g. `expr[?age > 18]`. */
export interface JsonSelectorFilter {
  type: "filter";
  expression: JsonSelector;
  condition: JsonSelector;
}

/** Python-style array slice with optional start, end, and step, e.g. `expr[0:5:2]`. */
export interface JsonSelectorSlice {
  type: "slice";
  expression: JsonSelector;
  start?: number;
  end?: number;
  step?: number;
}

/** Flattens one level of nested arrays, e.g. `expr[]`. */
export interface JsonSelectorFlatten {
  type: "flatten";
  expression: JsonSelector;
}

/** Logical negation: converts a truthy value to `false` and a falsy/empty value to `true`. */
export interface JsonSelectorNot {
  type: "not";
  expression: JsonSelector;
}

/** The set of relational and equality operators supported in comparisons. */
export type JsonSelectorCompareOperator = "<" | "<=" | "==" | ">=" | ">" | "!=";

/** Binary comparison using a relational or equality operator, e.g. `a == b` or `age >= 18`. */
export interface JsonSelectorCompare {
  type: "compare";
  operator: JsonSelectorCompareOperator;
  lhs: JsonSelector;
  rhs: JsonSelector;
}

/** The set of arithmetic operators supported in binary arithmetic expressions. */
export type JsonSelectorArithmeticOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "//";

/** Binary arithmetic operation, e.g. `a + b`, `price * quantity`, `x // 2`. */
export interface JsonSelectorArithmetic {
  type: "arithmetic";
  operator: JsonSelectorArithmeticOperator;
  lhs: JsonSelector;
  rhs: JsonSelector;
}

/** The set of arithmetic operators supported in unary arithmetic expressions. */
export type JsonSelectorUnaryArithmeticOperator = "+" | "-";

/** Unary arithmetic operation, e.g. `-a` or `+value`. */
export interface JsonSelectorUnaryArithmetic {
  type: "unaryArithmetic";
  operator: JsonSelectorUnaryArithmeticOperator;
  expression: JsonSelector;
}

/** Short-circuit logical AND: returns the left operand if falsy, otherwise the right operand. */
export interface JsonSelectorAnd {
  type: "and";
  lhs: JsonSelector;
  rhs: JsonSelector;
}

/** Short-circuit logical OR: returns the left operand if truthy, otherwise the right operand. */
export interface JsonSelectorOr {
  type: "or";
  lhs: JsonSelector;
  rhs: JsonSelector;
}

/** Conditional expression (`condition ? consequent : alternate`) using JMESPath truthiness rules. */
export interface JsonSelectorTernary {
  type: "ternary";
  condition: JsonSelector;
  consequent: JsonSelector;
  alternate: JsonSelector;
}

/** Pipe operator (`|`) that evaluates the right side against the result of the left side, resetting projections. */
export interface JsonSelectorPipe {
  type: "pipe";
  lhs: JsonSelector;
  rhs: JsonSelector;
  /** When true, this pipe originated from dot syntax (e.g., `foo.func()`, `foo.{...}`, `foo.[...]`). */
  dotSyntax?: boolean;
}

/** Named function invocation with zero or more argument expressions, e.g. `length(foo)`. */
export interface JsonSelectorFunctionCall {
  type: "functionCall";
  name: string;
  args: JsonSelector[];
}

/** Unevaluated expression reference (`&expr`) passed to higher-order functions like `sort_by` and `map`. */
export interface JsonSelectorExpressionRef {
  type: "expressionRef";
  expression: JsonSelector;
}

/** Evaluates multiple expressions in parallel and collects the results into an array, e.g. `[foo, bar]`. */
export interface JsonSelectorMultiSelectList {
  type: "multiSelectList";
  expressions: JsonSelector[];
}

/** Evaluates named expressions and collects the results into a new object, e.g. `{a: foo, b: bar}`. */
export interface JsonSelectorMultiSelectHash {
  type: "multiSelectHash";
  entries: Array<{ key: string; value: JsonSelector }>;
}

/** Discriminated union of all AST node types produced by the selector parser. */
export type JsonSelector =
  | JsonSelectorCurrent
  | JsonSelectorRoot
  | JsonSelectorLiteral
  | JsonSelectorIdentifier
  | JsonSelectorFieldAccess
  | JsonSelectorIndexAccess
  | JsonSelectorIdAccess
  | JsonSelectorProject
  | JsonSelectorObjectProject
  | JsonSelectorFilter
  | JsonSelectorSlice
  | JsonSelectorFlatten
  | JsonSelectorNot
  | JsonSelectorCompare
  | JsonSelectorArithmetic
  | JsonSelectorUnaryArithmetic
  | JsonSelectorAnd
  | JsonSelectorOr
  | JsonSelectorTernary
  | JsonSelectorPipe
  | JsonSelectorFunctionCall
  | JsonSelectorExpressionRef
  | JsonSelectorMultiSelectList
  | JsonSelectorMultiSelectHash;
