import { JsonSelector } from "./ast";
import { Parser } from "./parser";

/** Parses a selector expression string into an AST that can be evaluated, formatted, or compiled into an accessor. */
export function parseJsonSelector(selectorExpression: string): JsonSelector {
  const parser = new Parser(selectorExpression);
  return parser.parse();
}
