import { JsonSelector } from "../../ast";
import { isArray, isNonEmptyArray, isObject, NonEmptyArray } from "../../util";
import {
  ANY_ARRAY_TYPE,
  ANY_TYPE,
  EXPREF_TYPE,
  getExpressionRef,
  NUMBER_ARRAY_TYPE,
  OBJECT_TYPE,
  STRING_ARRAY_TYPE,
  unionOf,
} from "../datatype";
import { FunctionDefinition } from "../types";
import {
  arg,
  InvalidArgumentTypeError,
  InvalidArgumentValueError,
  varArg,
} from "../validation";

/** Registers all JMESPath array/object manipulation functions. */
export function registerArrayFunctions(
  register: (def: FunctionDefinition) => void,
): void {
  // sort(array<number> | array<string>) -> array
  register({
    name: "sort",
    signatures: [
      [arg("list", unionOf([NUMBER_ARRAY_TYPE, STRING_ARRAY_TYPE]))],
    ],
    handler: ({ args }) => {
      if (isArray(args[0])) {
        // Signature ensures array is all numbers or all strings
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const arr = [...args[0]] as (number | string)[];
        arr.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
        return arr;
      }
      return [];
    },
  });

  // sort_by(array, expref) -> array
  register({
    name: "sort_by",
    signatures: [[arg("list", ANY_ARRAY_TYPE), arg("expref", EXPREF_TYPE)]],
    handler: ({ args, evaluate }) => {
      const expr = getExpressionRef(args[1]);
      if (isArray(args[0]) && expr) {
        const arr = args[0];
        if (!isNonEmptyArray(arr)) {
          return [];
        }

        // Validate and collect all keys
        const keys = evaluateExpressionKeys("sort_by", arr, expr, evaluate);

        // Schwartzian transform: evaluate keys once, sort by key
        const decorated = arr.map((v, i) => [v, keys[i]] as const);
        decorated.sort((a, b) => (a[1] > b[1] ? 1 : a[1] < b[1] ? -1 : 0));
        return decorated.map((d) => d[0]);
      }
      return [];
    },
  });

  // min_by(array, expref) -> any
  register({
    name: "min_by",
    signatures: [[arg("list", ANY_ARRAY_TYPE), arg("expref", EXPREF_TYPE)]],
    handler: ({ args, evaluate }) => {
      const expr = getExpressionRef(args[1]);
      if (isArray(args[0]) && expr) {
        const arr = args[0];
        if (!isNonEmptyArray(arr)) {
          return null;
        }

        // Validate and collect all keys
        const keys = evaluateExpressionKeys("min_by", arr, expr, evaluate);

        let minIdx = 0;
        let minKey = keys[0];
        for (let i = 1; i < arr.length; i++) {
          if (keys[i] < minKey) {
            minKey = keys[i];
            minIdx = i;
          }
        }
        return arr[minIdx];
      }
      return null;
    },
  });

  // max_by(array, expref) -> any
  register({
    name: "max_by",
    signatures: [[arg("list", ANY_ARRAY_TYPE), arg("expref", EXPREF_TYPE)]],
    handler: ({ args, evaluate }) => {
      const expr = getExpressionRef(args[1]);
      if (isArray(args[0]) && expr) {
        const arr = args[0];
        if (!isNonEmptyArray(arr)) {
          return null;
        }

        // Validate and collect all keys
        const keys = evaluateExpressionKeys("max_by", arr, expr, evaluate);

        let maxIdx = 0;
        let maxKey = keys[0];
        for (let i = 1; i < arr.length; i++) {
          if (keys[i] > maxKey) {
            maxKey = keys[i];
            maxIdx = i;
          }
        }
        return arr[maxIdx];
      }
      return null;
    },
  });

  // keys(object) -> array<string>
  register({
    name: "keys",
    signatures: [[arg("obj", OBJECT_TYPE)]],
    handler: ({ args }) => {
      const obj = args[0];
      if (isObject(obj)) {
        return Object.keys(obj);
      }
      return [];
    },
  });

  // values(object) -> array
  register({
    name: "values",
    signatures: [[arg("obj", OBJECT_TYPE)]],
    handler: ({ args }) => {
      const obj = args[0];
      if (isObject(obj)) {
        return Object.values(obj);
      }
      return [];
    },
  });

  // merge(...objects) -> object
  register({
    name: "merge",
    signatures: [[varArg("object", OBJECT_TYPE)]],
    handler: ({ args }) => {
      const result: Record<string, unknown> = {};
      for (const a of args) {
        if (isObject(a)) {
          Object.assign(result, a);
        }
      }
      return result;
    },
  });

  // not_null(...any) -> any
  register({
    name: "not_null",
    signatures: [[varArg("arg", ANY_TYPE)]],
    handler: ({ args }) => {
      for (const a of args) {
        if (a != null) {
          return a;
        }
      }
      return null;
    },
  });

  // group_by(array, expref) -> object
  register({
    name: "group_by",
    signatures: [[arg("list", ANY_ARRAY_TYPE), arg("expref", EXPREF_TYPE)]],
    handler: ({ args, evaluate }) => {
      const expr = getExpressionRef(args[1]);
      if (isArray(args[0]) && expr) {
        const arr = args[0];
        const groups: Record<string, unknown[]> = {};
        for (const item of arr) {
          const key = evaluate(expr, item);
          if (key == null) {
            // null keys are excluded per JMESPath spec
            continue;
          }
          if (typeof key !== "string") {
            throw new InvalidArgumentTypeError(
              "group_by",
              "expref",
              `expression must evaluate to string or null, got ${typeof key}`,
            );
          }
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(item);
        }
        return groups;
      }
      return {};
    },
  });

  // items(object) -> array
  register({
    name: "items",
    signatures: [[arg("obj", OBJECT_TYPE)]],
    handler: ({ args }) => {
      const obj = args[0];
      if (isObject(obj)) {
        return Object.entries(obj);
      }
      return [];
    },
  });

  // from_items(array) -> object
  register({
    name: "from_items",
    signatures: [[arg("list", ANY_ARRAY_TYPE)]],
    handler: ({ args }) => {
      if (isArray(args[0])) {
        assertKeyValuePairs(args[0]);
        return Object.fromEntries(args[0]);
      }
      return {};
    },
  });

  // zip(...arrays) -> array
  register({
    name: "zip",
    signatures: [[varArg("list", ANY_ARRAY_TYPE)]],
    handler: ({ args }) => {
      if (args.length === 0) {
        return [];
      }
      const arrays: unknown[][] = [];
      for (const a of args) {
        if (!isArray(a)) {
          return [];
        }
        arrays.push(a);
      }
      const minLen = Math.min(...arrays.map((a) => a.length));
      const result: unknown[][] = [];
      for (let i = 0; i < minLen; i++) {
        result.push(arrays.map((a) => a[i]));
      }
      return result;
    },
  });

  // map(expref, array) -> array
  register({
    name: "map",
    signatures: [[arg("expref", EXPREF_TYPE), arg("list", ANY_ARRAY_TYPE)]],
    handler: ({ args, evaluate }) => {
      const expr = getExpressionRef(args[0]);
      if (expr && isArray(args[1])) {
        return args[1].map((item) => evaluate(expr, item));
      }
      return [];
    },
  });
}

/**
 * Evaluate an expression against each element and validate that all keys are
 * numbers or strings of the same type. Returns the collected keys.
 * Throws InvalidArgumentTypeError if not.
 */
function evaluateExpressionKeys(
  funcName: string,
  arr: NonEmptyArray<unknown>,
  expr: JsonSelector,
  evaluate: (selector: JsonSelector, ctx: unknown) => unknown,
): number[] | string[] {
  const firstKey = evaluate(expr, arr[0]);
  if (typeof firstKey === "number") {
    return collectKeys(funcName, arr, expr, evaluate, firstKey);
  }
  if (typeof firstKey === "string") {
    return collectKeys(funcName, arr, expr, evaluate, firstKey);
  }
  const keyType = firstKey === null ? "null" : typeof firstKey;
  throw new InvalidArgumentTypeError(
    funcName,
    "expref",
    `expression must evaluate to number or string, got ${keyType}`,
  );
}

/**
 * Collect keys of a known type from all elements, validating type consistency.
 */
function collectKeys<T extends number | string>(
  funcName: string,
  arr: NonEmptyArray<unknown>,
  expr: JsonSelector,
  evaluate: (selector: JsonSelector, ctx: unknown) => unknown,
  firstKey: T,
): T[] {
  const expectedType = typeof firstKey;
  const keys: T[] = [firstKey];
  for (let i = 1; i < arr.length; i++) {
    const key = evaluate(expr, arr[i]);
    if (typeof key !== expectedType) {
      const actualType = key === null ? "null" : typeof key;
      throw new InvalidArgumentTypeError(
        funcName,
        "expref",
        `expression must evaluate to consistent types (index ${i}: expected ${expectedType}, got ${actualType})`,
      );
    }
    // Safe: we've validated typeof key === expectedType === typeof T
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    keys.push(key as T);
  }
  return keys;
}

function assertKeyValuePairs(
  items: unknown[],
): asserts items is [string, unknown][] {
  for (const item of items) {
    if (!isArray(item) || item.length !== 2 || typeof item[0] !== "string") {
      throw new InvalidArgumentValueError(
        "from_items",
        "list",
        "each array element must be a [string, value] pair",
      );
    }
  }
}
