import { type AccessorOptions } from "./access";
import { JsonSelector } from "./ast";
import { accessWithJsonSelector } from "./bind";

/** Writes a value at the location identified by a selector, returning the previous value at that path. */
export function setWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
  value: unknown,
  options?: Partial<AccessorOptions>,
): unknown {
  const accessor = accessWithJsonSelector(selector, context, context, options);
  const oldValue = accessor.get();
  accessor.set(value);
  return oldValue;
}
