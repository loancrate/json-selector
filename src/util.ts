import { JsonValue } from "type-fest";

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  return value == null ? [] : isArray(value) ? value : [value];
}

/** Tuple type that guarantees at least one element is present. */
export type NonEmptyArray<T> = [T, ...T[]];

/** Type guard that narrows an array to {@link NonEmptyArray}, confirming it has at least one element. */
export function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length > 0;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !isArray(value);
}

export function isFalseOrEmpty(value: unknown): boolean {
  return (
    value == null ||
    value === false ||
    value === "" ||
    (isArray(value) && value.length === 0) ||
    (isObject(value) && !hasOwnProperties(value))
  );
}

function hasOwnProperties(value: Record<string, unknown>): boolean {
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      return true;
    }
  }
  return false;
}

export function getField(obj: unknown, name: string): unknown {
  return isObject(obj) ? (obj[name] ?? null) : null;
}

export function getIndex(obj: unknown, index: number): unknown {
  return isArray(obj)
    ? (obj[index < 0 ? obj.length + index : index] ?? null)
    : null;
}

export function findId(obj: unknown, id: string | number): unknown {
  return isArray(obj)
    ? (obj.find((e) => isObject(e) && e.id === id) ?? null)
    : null;
}

export function findIdIndex(arr: unknown[], id: string | number): number {
  return arr.findIndex((e) => isObject(e) && e.id === id);
}

export function formatLiteral(value: JsonValue): string {
  return "`" + JSON.stringify(value).replace(/`/g, "\\`") + "`";
}

export function isValidIdentifier(s: string): boolean {
  return /^[a-z_][0-9a-z_]*$/i.test(s);
}

export function formatIdentifier(s: string): string {
  return isValidIdentifier(s) ? s : JSON.stringify(s);
}

export function formatRawString(s: string): string {
  // https://jmespath.org/specification.html#raw-string-literals
  // eslint-disable-next-line no-control-regex
  return `'${s.replace(/[\0-\x1F]/g, "").replace(/['\\]/g, (c) => `\\${c}`)}'`;
}
