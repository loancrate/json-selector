import { accessWithJsonSelector } from "./access";
import { JsonSelector } from "./ast";

export function getWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
): unknown {
  return accessWithJsonSelector(selector, context).get();
}
