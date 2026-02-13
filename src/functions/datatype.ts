import { JsonSelector } from "../ast";
import { isArray, isObject } from "../util";

// Primitives

/** Describes a single scalar type in the function argument type system. */
export interface PrimitiveType {
  kind: "any" | "boolean" | "number" | "string" | "object" | "null" | "expref";
}

/** String literal union of all primitive type kind discriminators. */
export type PrimitiveTypeKind = PrimitiveType["kind"];

/** Matches any value regardless of type. */
export const ANY_TYPE = Object.freeze({
  kind: "any",
} as const satisfies PrimitiveType);

/** Matches only `true` or `false` values. */
export const BOOLEAN_TYPE = Object.freeze({
  kind: "boolean",
} as const satisfies PrimitiveType);

/** Matches only numeric values (integers and floats). */
export const NUMBER_TYPE = Object.freeze({
  kind: "number",
} as const satisfies PrimitiveType);

/** Matches only string values. */
export const STRING_TYPE = Object.freeze({
  kind: "string",
} as const satisfies PrimitiveType);

/** Matches only plain objects (not arrays or null). */
export const OBJECT_TYPE = Object.freeze({
  kind: "object",
} as const satisfies PrimitiveType);

/** Matches only `null` (or `undefined`, which is treated as null). */
export const NULL_TYPE = Object.freeze({
  kind: "null",
} as const satisfies PrimitiveType);

/** Matches only expression references created with `&expr` syntax. */
export const EXPREF_TYPE = Object.freeze({
  kind: "expref",
} as const satisfies PrimitiveType);

// Arrays

/** Describes an array type whose elements must all conform to a given {@link DataType}. */
export interface ArrayType {
  kind: "array";
  elementType: DataType;
}

/** Creates an {@link ArrayType} requiring all elements to match the given type. */
export function arrayOf(elementType: ConcreteType): ArrayType {
  return { kind: "array", elementType };
}

/** Array type accepting elements of any type. */
export const ANY_ARRAY_TYPE = Object.freeze(arrayOf(ANY_TYPE));

/** Array type accepting only numeric elements. */
export const NUMBER_ARRAY_TYPE = Object.freeze(arrayOf(NUMBER_TYPE));

/** Array type accepting only string elements. */
export const STRING_ARRAY_TYPE = Object.freeze(arrayOf(STRING_TYPE));

/** A non-union type: either a primitive or an array with typed elements. */
export type ConcreteType = PrimitiveType | ArrayType;

/** String literal union of all non-union type kind discriminators. */
export type ConcreteTypeKind = ConcreteType["kind"];

// Unions

/** A type that accepts values matching any one of its constituent concrete types. */
export interface UnionType {
  kind: "union";
  types: ConcreteType[];
}

/** Creates a {@link UnionType} that matches values conforming to any of the given types. */
export function unionOf(
  types: [ConcreteType, ConcreteType, ...ConcreteType[]],
): UnionType {
  return { kind: "union", types };
}

/** The complete function type system: a concrete type, an array type, or a union of types. */
export type DataType = ConcreteType | UnionType;

/** String literal union of all type kind discriminators including `"union"`. */
export type DataTypeKind = DataType["kind"];

// Expression references

const EXPREF_SYMBOL = Symbol("expref");

/**
 * An unevaluated expression passed to a function via `&expr` syntax.
 * Higher-order functions like `sort_by` and `map` receive these and
 * evaluate them against each element using the provided `evaluate` callback.
 */
interface ExpressionRef {
  [EXPREF_SYMBOL]: JsonSelector;
}

/** Wraps a selector AST node as an opaque reference for deferred evaluation by higher-order functions. */
export function makeExpressionRef(expression: JsonSelector): ExpressionRef {
  return { [EXPREF_SYMBOL]: expression };
}

function isExpressionRef(arg: unknown): arg is ExpressionRef {
  return isObject(arg) && EXPREF_SYMBOL in arg;
}

/** Extracts the wrapped {@link JsonSelector} from an expression reference, or returns `null` if the value is not one. */
export function getExpressionRef(arg: unknown): JsonSelector | null {
  return isExpressionRef(arg) ? arg[EXPREF_SYMBOL] : null;
}

// Type utilities

/**
 * Determine the {@link DataTypeKind} of a runtime value.
 */
export function getDataTypeKind(value: unknown): ConcreteTypeKind {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "undefined":
    case "object":
      if (value == null) {
        return "null";
      }
      if (isArray(value)) {
        return "array";
      }
      if (isExpressionRef(value)) {
        return "expref";
      }
      return "object";
  }
  return "any";
}

/**
 * Determine the {@link DataType} of a runtime value.
 */
export function getDataType(value: unknown): ConcreteType {
  switch (typeof value) {
    case "boolean":
      return BOOLEAN_TYPE;
    case "number":
      return NUMBER_TYPE;
    case "string":
      return STRING_TYPE;
    case "undefined":
    case "object":
      if (value == null) {
        return NULL_TYPE;
      }
      if (isArray(value)) {
        return getArrayType(value);
      }
      if (isExpressionRef(value)) {
        return EXPREF_TYPE;
      }
      return OBJECT_TYPE;
  }
  return ANY_TYPE;
}

const CONCRETE_KIND_TO_TYPE: Record<ConcreteTypeKind, ConcreteType> = {
  any: ANY_TYPE,
  boolean: BOOLEAN_TYPE,
  number: NUMBER_TYPE,
  string: STRING_TYPE,
  object: OBJECT_TYPE,
  null: NULL_TYPE,
  expref: EXPREF_TYPE,
  array: ANY_ARRAY_TYPE,
};

function getArrayType(array: unknown[]): ArrayType {
  if (array.length === 0) {
    return ANY_ARRAY_TYPE;
  }
  const kinds = [...new Set(array.map(getDataTypeKind))];
  const types = kinds.map((k) => CONCRETE_KIND_TO_TYPE[k]);
  const elementType: DataType =
    types.length === 1 ? types[0] : { kind: "union", types };
  return { kind: "array", elementType };
}

/** Tests whether a runtime value conforms to the given {@link DataType}, including recursive element checks for arrays. */
export function matchesType(value: unknown, type: DataType): boolean {
  if (type.kind === "any") {
    return true;
  }

  if (type.kind === "union") {
    return type.types.some((t) => matchesType(value, t));
  }

  if (isArray(value)) {
    return (
      type.kind === "array" &&
      value.every((element) => matchesType(element, type.elementType))
    );
  }

  return getDataTypeKind(value) === type.kind;
}

/** Renders a {@link DataType} as a human-readable string for use in error messages and diagnostics. */
export function formatType(type: DataType): string {
  const { kind } = type;
  switch (kind) {
    case "array": {
      const elem = formatType(type.elementType);
      return type.elementType.kind === "union" ? `(${elem})[]` : `${elem}[]`;
    }
    case "union":
      return type.types.map(formatType).join(" | ");
    default:
      return kind;
  }
}
