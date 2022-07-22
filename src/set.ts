import { accessWithJsonSelector } from "./access";
import { JsonSelector } from "./types";

export function setWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
  value: unknown
): unknown {
  const accessor = accessWithJsonSelector(selector, context);
  const oldValue = accessor.get();
  accessor.set(value);
  return oldValue;
}
