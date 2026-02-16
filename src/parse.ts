import { JsonSelector } from "./ast";
import { Parser, type ParserOptions } from "./parser";

/** Parses a selector expression string into an AST that can be evaluated, formatted, or compiled into an accessor. */
export function parseJsonSelector(
  selectorExpression: string,
  options?: ParserOptions,
): JsonSelector {
  const parser = new Parser(selectorExpression, options);
  return parser.parse();
}
