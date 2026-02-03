import { JsonSelector } from "./ast";
import { Parser } from "./parser";

export function parseJsonSelector(selectorExpression: string): JsonSelector {
  const parser = new Parser(selectorExpression);
  return parser.parse();
}
