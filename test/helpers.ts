import { evaluateJsonSelector } from "../src/evaluate";
import { parseJsonSelector } from "../src/parse";

/** Parses a selector expression string and evaluates it against the given data in one step. */
export function evaluate(expr: string, data: unknown): unknown {
  return evaluateJsonSelector(parseJsonSelector(expr), data);
}

export function catchError(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected function to throw");
}
