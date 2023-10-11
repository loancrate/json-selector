import deepEqual from "fast-deep-equal";
import { JsonSelector, JsonSelectorCompareOperator } from "./ast";
import { findId, getField, getIndex, isArray, isFalseOrEmpty } from "./util";
import { visitJsonSelector } from "./visitor";

export function evaluateJsonSelector(
  selector: JsonSelector,
  context: unknown,
  rootContext = context
): unknown {
  return visitJsonSelector<unknown, unknown>(
    selector,
    {
      current() {
        return context;
      },
      root() {
        return rootContext;
      },
      literal({ value }) {
        return value;
      },
      identifier({ id }) {
        return getField(context, id);
      },
      fieldAccess({ expression, field }) {
        return getField(
          evaluateJsonSelector(expression, context, rootContext),
          field
        );
      },
      indexAccess({ expression, index }) {
        return getIndex(
          evaluateJsonSelector(expression, context, rootContext),
          index
        );
      },
      idAccess({ expression, id }) {
        return findId(
          evaluateJsonSelector(expression, context, rootContext),
          id
        );
      },
      project({ expression, projection }) {
        return project(
          evaluateJsonSelector(expression, context, rootContext),
          projection,
          rootContext
        );
      },
      filter({ expression, condition }) {
        return filter(
          evaluateJsonSelector(expression, context, rootContext),
          condition,
          rootContext
        );
      },
      slice({ expression, start, end, step }) {
        return slice(
          evaluateJsonSelector(expression, context, rootContext),
          start,
          end,
          step
        );
      },
      flatten({ expression }) {
        return flatten(evaluateJsonSelector(expression, context, rootContext));
      },
      not({ expression }) {
        return isFalseOrEmpty(
          evaluateJsonSelector(expression, context, rootContext)
        );
      },
      compare({ lhs, rhs, operator }) {
        const lv = evaluateJsonSelector(lhs, context, rootContext);
        const rv = evaluateJsonSelector(rhs, context, rootContext);
        return compare(lv, rv, operator);
      },
      and({ lhs, rhs }) {
        const lv = evaluateJsonSelector(lhs, context, rootContext);
        return isFalseOrEmpty(lv)
          ? lv
          : evaluateJsonSelector(rhs, context, rootContext);
      },
      or({ lhs, rhs }) {
        const lv = evaluateJsonSelector(lhs, context, rootContext);
        return !isFalseOrEmpty(lv)
          ? lv
          : evaluateJsonSelector(rhs, context, rootContext);
      },
      pipe({ lhs, rhs }) {
        return evaluateJsonSelector(
          rhs,
          evaluateJsonSelector(lhs, context, rootContext),
          rootContext
        );
      },
    },
    context
  );
}

export function project(
  value: unknown[],
  projection: JsonSelector | undefined,
  rootContext: unknown
): unknown[];
export function project(
  value: unknown,
  projection: JsonSelector | undefined,
  rootContext: unknown
): unknown[] | null;
export function project(
  value: unknown,
  projection: JsonSelector | undefined,
  rootContext: unknown
): unknown[] | null {
  if (!isArray(value)) {
    return null;
  }
  if (!projection) {
    return value;
  }
  const result = value
    .map((e) => evaluateJsonSelector(projection, e, rootContext))
    .filter((e) => e != null);
  return result;
}

export function filter(
  value: unknown[],
  condition: JsonSelector,
  rootContext: unknown
): unknown[];
export function filter(
  value: unknown,
  condition: JsonSelector,
  rootContext: unknown
): unknown[] | null;
export function filter(
  value: unknown,
  condition: JsonSelector,
  rootContext: unknown
): unknown[] | null {
  if (!isArray(value)) {
    return null;
  }
  const result = value.filter(
    (e) => !isFalseOrEmpty(evaluateJsonSelector(condition, e, rootContext))
  );
  return result;
}

export function slice(
  value: unknown[],
  start: number | undefined,
  end?: number,
  step?: number
): unknown[];
export function slice(
  value: unknown,
  start: number | undefined,
  end?: number,
  step?: number
): unknown[] | null;
export function slice(
  value: unknown,
  start: number | undefined,
  end?: number,
  step?: number
): unknown[] | null {
  if (!isArray(value)) {
    return null;
  }
  ({ start, end, step } = normalizeSlice(value.length, start, end, step));
  const collected: unknown[] = [];
  if (step > 0) {
    for (let i = start; i < end; i += step) {
      collected.push(value[i]);
    }
  } else {
    for (let i = start; i > end; i += step) {
      collected.push(value[i]);
    }
  }
  return collected;
}

export function normalizeSlice(
  length: number,
  start?: number,
  end?: number,
  step?: number
): { start: number; end: number; step: number } {
  if (step == null) {
    step = 1;
  } else if (step === 0) {
    throw new Error("Invalid slice: step cannot be 0");
  }
  if (start == null) {
    start = step < 0 ? length - 1 : 0;
  } else {
    start = limitSlice(start, step, length);
  }
  if (end == null) {
    end = step < 0 ? -1 : length;
  } else {
    end = limitSlice(end, step, length);
  }
  return { start, end, step };
}

function limitSlice(value: number, step: number, length: number): number {
  if (value < 0) {
    value += length;
    if (value < 0) {
      value = step < 0 ? -1 : 0;
    }
  } else if (value >= length) {
    value = step < 0 ? length - 1 : length;
  }
  return value;
}

export function flatten(value: unknown[]): unknown[];
export function flatten(value: unknown): unknown[] | null;
export function flatten(value: unknown): unknown[] | null {
  return isArray(value) ? value.flat() : null;
}

export function compare(
  lv: number,
  rv: number,
  operator: JsonSelectorCompareOperator
): boolean;
export function compare(
  lv: unknown,
  rv: unknown,
  operator: JsonSelectorCompareOperator
): boolean | null;
export function compare(
  lv: unknown,
  rv: unknown,
  operator: JsonSelectorCompareOperator
): boolean | null {
  switch (operator) {
    case "==":
      return deepEqual(lv, rv);
    case "!=":
      return !deepEqual(lv, rv);
    case "<":
    case "<=":
    case ">":
    case ">=":
      if (typeof lv === "number" && typeof rv === "number") {
        switch (operator) {
          case "<":
            return lv < rv;
          case "<=":
            return lv <= rv;
          case ">":
            return lv > rv;
          case ">=":
            return lv >= rv;
        }
      }
  }
  return null;
}
