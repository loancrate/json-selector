import { accessWithJsonSelector } from "./access";
import { JsonSelector } from "./types";

export function getWithJsonSelector(
  selector: JsonSelector,
  context: unknown
): unknown {
  return accessWithJsonSelector(selector, context).get();
}
