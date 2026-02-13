import deepEqual from "fast-deep-equal";
import {
  JsonSelector,
  JsonSelectorCompareOperator,
  JsonSelectorCurrent,
} from "./ast";
import { type EvaluationContext } from "./functions";
import { getBuiltinFunctionProvider } from "./functions/builtins";
import { callFunction } from "./functions/provider";
import { InvalidArgumentValueError } from "./functions/validation";
import {
  findId,
  getField,
  getIndex,
  isArray,
  isFalseOrEmpty,
  isObject,
} from "./util";
import { visitJsonSelector } from "./visitor";

function isPartialEvaluationContext(
  value: unknown,
): value is Partial<EvaluationContext> {
  return (
    isObject(value) && ("functionProvider" in value || "rootContext" in value)
  );
}

/** Evaluates a parsed selector AST against a JSON context value, returning the selected result. */
export function evaluateJsonSelector(
  selector: JsonSelector,
  context: unknown,
  evalCtx?: Partial<EvaluationContext>,
): unknown;
/** @deprecated Use the form with `Partial<EvaluationContext>` instead. */
export function evaluateJsonSelector(
  selector: JsonSelector,
  context: unknown,
  rootContext?: unknown,
  options?: Omit<EvaluationContext, "rootContext">,
): unknown;
export function evaluateJsonSelector(
  selector: JsonSelector,
  context: unknown,
  evalCtxOrRoot?: unknown,
  options?: Omit<EvaluationContext, "rootContext">,
): unknown {
  let evalCtx: EvaluationContext;
  if (isPartialEvaluationContext(evalCtxOrRoot)) {
    evalCtx = {
      rootContext: evalCtxOrRoot.rootContext ?? context,
      functionProvider:
        evalCtxOrRoot.functionProvider ?? getBuiltinFunctionProvider(),
    };
  } else {
    evalCtx = {
      rootContext: evalCtxOrRoot ?? context,
      functionProvider:
        options?.functionProvider ?? getBuiltinFunctionProvider(),
    };
  }
  return evaluate(selector, context, evalCtx);
}

function evaluate(
  selector: JsonSelector,
  context: unknown,
  evalCtx: EvaluationContext,
): unknown {
  return visitJsonSelector<unknown, unknown>(
    selector,
    {
      current() {
        return context;
      },
      root() {
        return evalCtx.rootContext;
      },
      literal({ value }) {
        return value;
      },
      identifier({ id }) {
        return getField(context, id);
      },
      fieldAccess({ expression, field }) {
        return getField(evaluate(expression, context, evalCtx), field);
      },
      indexAccess({ expression, index }) {
        return getIndex(evaluate(expression, context, evalCtx), index);
      },
      idAccess({ expression, id }) {
        return findId(evaluate(expression, context, evalCtx), id);
      },
      project({ expression, projection }) {
        return project(
          evaluate(expression, context, evalCtx),
          projection,
          evalCtx,
        );
      },
      objectProject({ expression, projection }) {
        return objectProject(
          evaluate(expression, context, evalCtx),
          projection,
          evalCtx,
        );
      },
      filter({ expression, condition }) {
        return filter(
          evaluate(expression, context, evalCtx),
          condition,
          evalCtx,
        );
      },
      slice({ expression, start, end, step }) {
        return slice(evaluate(expression, context, evalCtx), start, end, step);
      },
      flatten({ expression }) {
        return flatten(evaluate(expression, context, evalCtx));
      },
      not({ expression }) {
        return isFalseOrEmpty(evaluate(expression, context, evalCtx));
      },
      compare({ lhs, rhs, operator }) {
        const lv = evaluate(lhs, context, evalCtx);
        const rv = evaluate(rhs, context, evalCtx);
        return compare(lv, rv, operator);
      },
      and({ lhs, rhs }) {
        const lv = evaluate(lhs, context, evalCtx);
        return isFalseOrEmpty(lv) ? lv : evaluate(rhs, context, evalCtx);
      },
      or({ lhs, rhs }) {
        const lv = evaluate(lhs, context, evalCtx);
        return !isFalseOrEmpty(lv) ? lv : evaluate(rhs, context, evalCtx);
      },
      ternary({ condition, consequent, alternate }) {
        const cv = evaluate(condition, context, evalCtx);
        return isFalseOrEmpty(cv)
          ? evaluate(alternate, context, evalCtx)
          : evaluate(consequent, context, evalCtx);
      },
      pipe({ lhs, rhs }) {
        return evaluate(rhs, evaluate(lhs, context, evalCtx), evalCtx);
      },
      functionCall({ name, args }) {
        return callFunction(evalCtx.functionProvider, name, {
          ...evalCtx,
          context,
          evaluate: (selector, ctx) => evaluate(selector, ctx, evalCtx),
          args,
        });
      },
      expressionRef() {
        // Expression references are only meaningful as function arguments.
        // When evaluated directly, return null.
        return null;
      },
      multiSelectList({ expressions }) {
        if (context == null) {
          return null;
        }
        return expressions.map((expr) => evaluate(expr, context, evalCtx));
      },
      multiSelectHash({ entries }) {
        if (context == null) {
          return null;
        }
        const result: Record<string, unknown> = {};
        for (const { key, value } of entries) {
          result[key] = evaluate(value, context, evalCtx);
        }
        return result;
      },
    },
    context,
  );
}

/** Checks whether a projection is trivial (absent or `@`), meaning array elements pass through unchanged. */
export function isIdentityProjection(
  selector: JsonSelector | undefined,
): selector is JsonSelectorCurrent | undefined {
  return !selector || selector.type === "current";
}

/** Applies a wildcard array projection (`[*]`), evaluating the optional sub-expression against each element. */
export function project(
  value: unknown[],
  projection: JsonSelector | undefined,
  evalCtx: EvaluationContext,
): unknown[];
export function project(
  value: unknown,
  projection: JsonSelector | undefined,
  evalCtx: EvaluationContext,
): unknown[] | null;
export function project(
  value: unknown,
  projection: JsonSelector | undefined,
  evalCtx: EvaluationContext,
): unknown[] | null {
  if (!isArray(value)) {
    return null;
  }

  // JMESPath spec: "If the result of the expression applied to any individual
  // element is null, it is not included in the collected set of results."
  // See https://jmespath.org/specification.html#wildcard-expressions
  if (isIdentityProjection(projection)) {
    return value.filter((e) => e != null);
  }

  const result = value
    .map((e) => evaluate(projection, e, evalCtx))
    .filter((e) => e != null);
  return result;
}

/** Projects over an object's values (`.*`), optionally applying a sub-expression to each value and filtering out nulls. */
export function objectProject(
  value: unknown,
  projection: JsonSelector | undefined,
  evalCtx: EvaluationContext,
): unknown[] | null {
  if (!isObject(value)) {
    return null;
  }

  const values = Object.values(value);

  // JMESPath spec: null values are filtered from projection results.
  // See https://jmespath.org/specification.html#wildcard-expressions
  if (isIdentityProjection(projection)) {
    return values.filter((v) => v != null);
  }

  const result = values
    .map((v) => evaluate(projection, v, evalCtx))
    .filter((v) => v != null);
  return result;
}

/** Filters array elements, keeping only those where the condition evaluates to a truthy value. */
export function filter(
  value: unknown[],
  condition: JsonSelector,
  evalCtx: EvaluationContext,
): unknown[];
export function filter(
  value: unknown,
  condition: JsonSelector,
  evalCtx: EvaluationContext,
): unknown[] | null;
export function filter(
  value: unknown,
  condition: JsonSelector,
  evalCtx: EvaluationContext,
): unknown[] | null {
  if (!isArray(value)) {
    return null;
  }
  const result = value.filter(
    (e) => !isFalseOrEmpty(evaluate(condition, e, evalCtx)),
  );
  return result;
}

/** Extracts a sub-sequence from an array or string using Python-style slice semantics. */
export function slice(
  value: unknown[],
  start: number | undefined,
  end?: number,
  step?: number,
): unknown[];
export function slice(
  value: string,
  start: number | undefined,
  end?: number,
  step?: number,
): string;
export function slice(
  value: unknown,
  start: number | undefined,
  end?: number,
  step?: number,
): unknown[] | string | null;
export function slice(
  value: unknown,
  start: number | undefined,
  end?: number,
  step?: number,
): unknown[] | string | null {
  if (isArray(value)) {
    return collectSlice(value, start, end, step);
  }
  if (typeof value === "string") {
    return collectSlice(Array.from(value), start, end, step).join("");
  }
  return null;
}

function collectSlice<T>(
  value: readonly T[],
  start: number | undefined,
  end?: number,
  step?: number,
): T[] {
  ({ start, end, step } = normalizeSlice(value.length, start, end, step));
  const collected: T[] = [];
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

/** Resolves optional slice parameters against an array length, clamping negative indices and applying defaults. */
export function normalizeSlice(
  length: number,
  start?: number,
  end?: number,
  step?: number,
): { start: number; end: number; step: number } {
  if (step == null) {
    step = 1;
  } else if (step === 0) {
    throw new InvalidArgumentValueError("slice", "step", "step cannot be 0");
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

/** Flattens one level of nested arrays; returns `null` for non-array input. */
export function flatten(value: unknown[]): unknown[];
export function flatten(value: unknown): unknown[] | null;
export function flatten(value: unknown): unknown[] | null {
  return isArray(value) ? value.flat() : null;
}

/** Applies a comparison operator to two values; ordering operators require both operands to be numbers. */
export function compare(
  lv: number,
  rv: number,
  operator: JsonSelectorCompareOperator,
): boolean;
export function compare(
  lv: unknown,
  rv: unknown,
  operator: JsonSelectorCompareOperator,
): boolean | null;
export function compare(
  lv: unknown,
  rv: unknown,
  operator: JsonSelectorCompareOperator,
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
