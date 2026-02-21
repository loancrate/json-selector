import { JsonSelector } from "./ast";
import { evaluateJsonSelector, normalizeSlice } from "./evaluate";
import type { EvaluationContext } from "./evaluation-context";
import { isFalseOrEmpty } from "./util";

export function replaceArray(
  target: unknown[],
  source: readonly unknown[],
): unknown[] {
  target.length = 0;
  target.push(...source);
  return target;
}

export function invertedFilter(
  value: unknown[],
  condition: JsonSelector,
  evalCtx: EvaluationContext,
): unknown[] {
  return value.filter((e) =>
    isFalseOrEmpty(evaluateJsonSelector(condition, e, evalCtx)),
  );
}

/** Returns the complement of a slice: the elements that would NOT be selected by the given slice parameters. */
export function invertedSlice(
  value: unknown[],
  start: number | undefined,
  end?: number,
  step?: number,
): unknown[] {
  ({ start, end, step } = normalizeSlice(value.length, start, end, step));
  const collected: unknown[] = [];
  if (step > 0) {
    if (start >= end) {
      return value;
    }
    let skip = start;
    for (let i = 0; i < value.length; ++i) {
      if (i < skip || i >= end) {
        collected.push(value[i]);
      } else {
        skip += step;
      }
    }
  } else {
    if (start <= end) {
      return value;
    }
    let skip = start;
    for (let i = value.length - 1; i >= 0; --i) {
      if (i > skip || i <= end) {
        collected.push(value[i]);
      } else {
        skip += step;
      }
    }
  }
  return collected;
}
