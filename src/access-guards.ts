import { JsonSelector } from "./ast";
import { type AccessorErrorCode, AccessorError } from "./errors";
import { formatJsonSelector } from "./format";
import { describeValueType, findIdIndex, isArray, isObject } from "./util";

type ReadOnlySelectorType =
  | "not"
  | "compare"
  | "arithmetic"
  | "unaryArithmetic"
  | "and"
  | "or"
  | "ternary"
  | "functionCall"
  | "expressionRef"
  | "variableRef"
  | "let"
  | "multiSelectList"
  | "multiSelectHash"
  | "literal"
  | "current"
  | "root";

export type ReadOnlySelector = Extract<
  JsonSelector,
  { type: ReadOnlySelectorType }
>;

const READ_ONLY_CONSTRUCTS: Record<ReadOnlySelectorType, string> = {
  not: "not expression",
  compare: "comparison",
  arithmetic: "arithmetic expression",
  unaryArithmetic: "unary arithmetic expression",
  and: "and expression",
  or: "or expression",
  ternary: "ternary expression",
  functionCall: "function call",
  expressionRef: "expression reference",
  variableRef: "variable reference",
  let: "let expression",
  multiSelectList: "multi-select list",
  multiSelectHash: "multi-select hash",
  literal: "literal",
  current: "current node reference",
  root: "root reference",
};

type AccessOperation = "get" | "set" | "delete";

const MISSING_PARENT_DETAIL = "parent does not exist";

function accessorError(
  code: AccessorErrorCode,
  selector: JsonSelector,
  operation: AccessOperation,
  detail: string,
): AccessorError {
  const path = formatJsonSelector(selector);
  return new AccessorError(
    code,
    path,
    operation,
    `Cannot ${operation} '${path}': ${detail}`,
  );
}

export function readOnlyError(
  selector: ReadOnlySelector,
  operation: "set" | "delete",
  construct = READ_ONLY_CONSTRUCTS[selector.type],
): AccessorError {
  return accessorError(
    "NOT_WRITABLE",
    selector,
    operation,
    `${construct} is read-only`,
  );
}

export function requireObjectContext(
  value: unknown,
  selector: JsonSelector,
  operation: AccessOperation,
): Record<string, unknown> {
  if (!isObject(value)) {
    throw accessorError(
      "TYPE_MISMATCH",
      selector,
      operation,
      `expected object, got ${describeValueType(value)}`,
    );
  }
  return value;
}

export function requireObjectParent(
  value: unknown,
  selector: JsonSelector,
  operation: AccessOperation,
): Record<string, unknown> {
  if (value == null) {
    throw accessorError(
      "MISSING_PARENT",
      selector,
      operation,
      MISSING_PARENT_DETAIL,
    );
  }
  return requireObjectContext(value, selector, operation);
}

export function requireArrayParent(
  value: unknown,
  selector: JsonSelector,
  operation: AccessOperation,
): unknown[] {
  if (value == null) {
    throw accessorError(
      "MISSING_PARENT",
      selector,
      operation,
      MISSING_PARENT_DETAIL,
    );
  }
  if (!isArray(value)) {
    throw accessorError(
      "TYPE_MISMATCH",
      selector,
      operation,
      `expected array, got ${describeValueType(value)}`,
    );
  }
  return value;
}

export function requireArrayOrStringParent(
  value: unknown,
  selector: JsonSelector,
  operation: AccessOperation,
): unknown[] | string {
  if (value == null) {
    throw accessorError(
      "MISSING_PARENT",
      selector,
      operation,
      MISSING_PARENT_DETAIL,
    );
  }
  if (!isArray(value) && typeof value !== "string") {
    throw accessorError(
      "TYPE_MISMATCH",
      selector,
      operation,
      `expected array or string, got ${describeValueType(value)}`,
    );
  }
  return value;
}

export function resolveInBoundsIndex(
  arr: unknown[],
  index: number,
  selector: JsonSelector,
  operation: AccessOperation,
): number {
  const resolvedIndex = index < 0 ? arr.length + index : index;
  if (resolvedIndex < 0 || resolvedIndex >= arr.length) {
    throw accessorError(
      "INDEX_OUT_OF_BOUNDS",
      selector,
      operation,
      `index ${resolvedIndex} is out of bounds`,
    );
  }
  return resolvedIndex;
}

export function requireIdIndex(
  arr: unknown[],
  id: string | number,
  selector: JsonSelector,
  operation: AccessOperation,
): number {
  const index = findIdIndex(arr, id);
  if (index < 0) {
    throw accessorError(
      "MISSING_ID",
      selector,
      operation,
      `id '${String(id)}' was not found`,
    );
  }
  return index;
}
