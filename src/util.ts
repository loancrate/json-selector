export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
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
