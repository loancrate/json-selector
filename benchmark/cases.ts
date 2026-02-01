import type { BenchmarkCase } from "./types";

// Expression generators
export function generateFieldChain(depth: number): string {
  return Array.from({ length: depth }, (_, i) =>
    String.fromCharCode(97 + (i % 26)),
  ).join(".");
}

export function generatePipeChain(length: number): string {
  return Array.from({ length }, (_, i) =>
    String.fromCharCode(97 + (i % 26)),
  ).join(" | ");
}

export function generateIndexChain(length: number): string {
  return Array.from({ length }, (_, i) => `[${i}]`).join("");
}

export function generateProjectionChain(depth: number): string {
  return Array.from(
    { length: depth },
    (_, i) => String.fromCharCode(97 + (i % 26)) + "[*]",
  ).join(".");
}

export function generateAndChain(length: number): string {
  return Array.from({ length }, (_, i) =>
    String.fromCharCode(97 + (i % 26)),
  ).join(" && ");
}

export function generateOrChain(length: number): string {
  return Array.from({ length }, (_, i) =>
    String.fromCharCode(97 + (i % 26)),
  ).join(" || ");
}

// 1. Isolated Node Type Benchmarks
const isolatedCases: BenchmarkCase[] = [
  // Primitives
  { name: "primitive: current", expression: "@" },
  { name: "primitive: root", expression: "$" },
  { name: "primitive: literal true", expression: "`true`" },
  { name: "primitive: literal null", expression: "`null`" },
  { name: "primitive: literal number", expression: "`123`" },
  { name: "primitive: literal float", expression: "`3.14159`" },
  { name: "primitive: literal string", expression: '`"hello"`' },
  { name: "primitive: literal array", expression: "`[1, 2, 3]`" },
  { name: "primitive: literal object", expression: '`{"a": 1, "b": 2}`' },
  { name: "primitive: raw string", expression: "'raw string'" },
  { name: "primitive: identifier", expression: "foo" },
  { name: "primitive: quoted identifier", expression: '"quoted identifier"' },

  // Access patterns
  { name: "access: field", expression: "foo.bar" },
  { name: "access: index positive", expression: "foo[0]" },
  { name: "access: index negative", expression: "foo[-1]" },
  { name: "access: id", expression: "foo['id']" },

  // Collection operations
  { name: "collection: project", expression: "foo[*]" },
  { name: "collection: flatten", expression: "foo[]" },
  { name: "collection: filter", expression: "foo[?bar == `1`]" },
  { name: "collection: slice start:stop", expression: "foo[1:3]" },
  { name: "collection: slice step", expression: "foo[::2]" },

  // Logical
  { name: "logical: not", expression: "!foo" },
  { name: "logical: compare eq", expression: "foo == bar" },
  { name: "logical: compare ne", expression: "foo != bar" },
  { name: "logical: compare lt", expression: "foo < bar" },
  { name: "logical: compare le", expression: "foo <= bar" },
  { name: "logical: compare gt", expression: "foo > bar" },
  { name: "logical: compare ge", expression: "foo >= bar" },
  { name: "logical: and", expression: "foo && bar" },
  { name: "logical: or", expression: "foo || bar" },

  // Syntax features
  { name: "syntax: parentheses", expression: "(foo.bar)" },
  { name: "syntax: escaped quote", expression: '"foo\\"bar"' },
  { name: "syntax: raw escape", expression: "'it\\'s'" },
  { name: "syntax: unicode escape", expression: '"\\u0041"' },

  // Composition
  { name: "composition: pipe", expression: "foo | bar" },
];

// 2. Complexity Scaling Benchmarks
const scalingCases: BenchmarkCase[] = [
  // Field access depth
  { name: "scale: field depth 1", expression: generateFieldChain(1) },
  { name: "scale: field depth 5", expression: generateFieldChain(5) },
  { name: "scale: field depth 10", expression: generateFieldChain(10) },
  { name: "scale: field depth 25", expression: generateFieldChain(25) },
  { name: "scale: field depth 50", expression: generateFieldChain(50) },

  // Pipe chain length
  { name: "scale: pipe length 1", expression: generatePipeChain(1) },
  { name: "scale: pipe length 5", expression: generatePipeChain(5) },
  { name: "scale: pipe length 10", expression: generatePipeChain(10) },
  { name: "scale: pipe length 25", expression: generatePipeChain(25) },
  { name: "scale: pipe length 50", expression: generatePipeChain(50) },

  // Index chain length
  { name: "scale: index length 1", expression: "a" + generateIndexChain(1) },
  { name: "scale: index length 5", expression: "a" + generateIndexChain(5) },
  { name: "scale: index length 10", expression: "a" + generateIndexChain(10) },
  { name: "scale: index length 25", expression: "a" + generateIndexChain(25) },
  { name: "scale: index length 50", expression: "a" + generateIndexChain(50) },

  // Projection depth
  { name: "scale: projection depth 1", expression: generateProjectionChain(1) },
  { name: "scale: projection depth 5", expression: generateProjectionChain(5) },
  {
    name: "scale: projection depth 10",
    expression: generateProjectionChain(10),
  },
  {
    name: "scale: projection depth 25",
    expression: generateProjectionChain(25),
  },

  // AND chain length
  { name: "scale: AND length 2", expression: generateAndChain(2) },
  { name: "scale: AND length 5", expression: generateAndChain(5) },
  { name: "scale: AND length 10", expression: generateAndChain(10) },
  { name: "scale: AND length 26", expression: generateAndChain(26) },

  // OR chain length
  { name: "scale: OR length 2", expression: generateOrChain(2) },
  { name: "scale: OR length 5", expression: generateOrChain(5) },
  { name: "scale: OR length 10", expression: generateOrChain(10) },
  { name: "scale: OR length 26", expression: generateOrChain(26) },
];

// 3. Real-World Expression Benchmarks
const realWorldCases: BenchmarkCase[] = [
  // Simple access
  { name: "real: simple field access", expression: "foo.bar.baz" },

  // Array operations
  { name: "real: project field", expression: "items[*].name" },
  { name: "real: index field", expression: "items[0].value" },
  { name: "real: id access field", expression: "items['primary'].data" },

  // Filtering
  {
    name: "real: filter equals",
    expression: "users[?active == `true`]",
  },
  { name: "real: filter greater", expression: "orders[?total > `100`]" },

  // Complex queries
  {
    name: "real: nested project filter",
    expression: "reservations[*].instances[?status == 'running']",
  },
  {
    name: "real: flatten filter flatten pipe",
    expression: "data[].items[?type == 'primary'][].value | [0]",
  },
];

// 4. Stress Test Benchmarks
const stressCases: BenchmarkCase[] = [
  // Deep nesting (50 levels)
  {
    name: "stress: deep nesting 50",
    expression: generateFieldChain(50),
  },

  // Long strings
  {
    name: "stress: long string literal",
    expression: `\`"${"a".repeat(208)}"\``,
  },
  {
    name: "stress: long raw string",
    expression: `'${"a".repeat(208)}'`,
  },

  // Deep projections (26 levels = 104 characters)
  {
    name: "stress: projection chain 26",
    expression: generateProjectionChain(26),
  },

  // Complex filters
  {
    name: "stress: multiple filters",
    expression: "foo[?bar > baz][?qux > baz]",
  },

  // Combined complexity
  {
    name: "stress: deep field + filter",
    expression:
      "a.b.c.d.e.f.g.h.i.j.k.l.m.n.o[*].items[?status == 'active'][0].value",
  },
  {
    name: "stress: pipe + project + filter",
    expression:
      "users | [*].orders[?total > `100`] | [].items[?inStock == `true`]",
  },
];

export function getAllCases(): {
  isolated: BenchmarkCase[];
  scaling: BenchmarkCase[];
  realWorld: BenchmarkCase[];
  stress: BenchmarkCase[];
} {
  return {
    isolated: isolatedCases,
    scaling: scalingCases,
    realWorld: realWorldCases,
    stress: stressCases,
  };
}
