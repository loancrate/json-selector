import { type AccessorOptions } from "./access";
import { JsonSelector } from "./ast";
import { accessWithJsonSelector } from "./bind";

/** Evaluates a selector against a context and returns the selected value (read-only convenience wrapper). */
export function getWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
  options?: Partial<AccessorOptions>,
): unknown {
  return accessWithJsonSelector(selector, context, context, options).get();
}
