# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a TypeScript library implementing LoanCrate JSON Selectors, based on a subset of JMESPath with extensions for ID-based selection and root-node expressions. The library provides parsing, evaluation, formatting, and read/write/delete accessors for JSON selector expressions.

## Development Commands

### Build

```bash
npm run build
```

Cleans `dist/` and builds both UMD and ESM bundles using Rollup.

### Parser Generation

```bash
npm run generate-peggy
```

Generates the parser from `src/grammar.pegjs` into `src/__generated__/parser.js`. This is automatically run during `npm prepare`.

### Testing

```bash
npm test                # Run all tests with coverage
npm run test:ci         # Run tests in CI mode (sequential)
```

Tests are in the `test/` directory using Jest. To run a single test file:

```bash
npx jest test/parse.test.ts
```

### Linting

```bash
npm run lint            # Run ESLint
npm run lint:ci         # Run ESLint with JUnit output for CI
```

### Benchmarking

```bash
npm run benchmark                              # Run and display results
npm run benchmark -- --output results.json     # Save results to JSON file
npm run benchmark -- --json                    # Output JSON to stdout
npm run benchmark -- --compare a.json b.json   # Compare two result files
npm run benchmark -- --threshold 15            # Set regression threshold (default: 10%)
npm run benchmark -- --help                    # Show usage
```

Benchmarks test parsing performance across 77 test cases including:

- Isolated node types (primitives, access patterns, collection operations, logical operators)
- Complexity scaling (field depth, pipe chains, projections, logical chains)
- Real-world expressions (filters, projections, nested operations)
- Stress tests (deep nesting, long strings, complex combinations)

Results include average, standard deviation, min/max times, ops/sec, and percentile statistics (p50, p95, p99).

Benchmark implementation is modular:

- `benchmark/types.ts`: Type definitions for results and metadata
- `benchmark/cases.ts`: Test case definitions and generators
- `benchmark/run.ts`: Core benchmark execution and statistics
- `benchmark/format.ts`: Console output formatting
- `benchmark/compare.ts`: Result comparison and regression detection
- `benchmark/index.ts`: CLI entry point with argument parsing

## Architecture

### Core Components

**Parser (`src/grammar.pegjs` → `src/__generated__/parser.js`)**

- PEG.js/Peggy grammar implementing JMESPath subset with extensions
- Parses selector strings into AST nodes
- Handles operator precedence (pipe → or → and → compare → not → flatten → filter → star/slice → index/ID → member access)

**AST (`src/ast.ts`)**

- TypeScript type definitions for all selector node types
- 16 node types: current, root, literal, identifier, fieldAccess, indexAccess, idAccess, project, filter, slice, flatten, not, compare, and, or, pipe
- Discriminated union type `JsonSelector` for type-safe pattern matching

**Visitor Pattern (`src/visitor.ts`)**

- Generic visitor interface `Visitor<R, C>` for traversing AST nodes
- `visitJsonSelector()` function dispatches to appropriate visitor method based on node type
- Used throughout for implementing evaluation, formatting, and accessor creation

**Evaluation (`src/evaluate.ts`)**

- `evaluateJsonSelector()`: reads values from JSON data using a selector
- Helper functions: `project()`, `filter()`, `slice()`, `flatten()`, `compare()`
- Uses visitor pattern to process AST nodes recursively

**Accessors (`src/access.ts`)**

- `makeJsonSelectorAccessor()`: creates unbound accessor from selector
- `accessWithJsonSelector()`: creates bound accessor for specific context
- Accessors provide `get()`, `set()`, and `delete()` operations
- Read-only accessors for non-modifiable expressions (not, compare, and, or)
- Complex set/delete logic for projections, filters, and slices

**Formatting (`src/format.ts`)**

- `formatJsonSelector()`: converts AST back to selector string
- Uses visitor pattern to reconstruct expression syntax

**Public API (`src/index.ts`)**

- Exports all public functions and types
- Main entry points: `parseJsonSelector()`, `evaluateJsonSelector()`, `accessWithJsonSelector()`, `formatJsonSelector()`

### Key Extension: ID Access

The library extends JMESPath with ID-based array access: `x['y']` is equivalent to `x[?id == 'y'] | [0]` in standard JMESPath. This allows selecting objects from arrays by their `id` property using string literals instead of numeric indices.

### Accessor Architecture

Accessors are created using a two-phase approach:

1. **Unbound accessor**: Created from selector AST, contains logic for all operations
2. **Bound accessor**: Binds unbound accessor to specific context object

For write operations on projections/filters/slices, the library implements "inverted" operations that preserve non-matching elements while replacing matching ones.

## Build Output

- `dist/json-selector.umd.js`: UMD bundle with all dependencies included
- `dist/json-selector.esm.js`: ESM bundle with `fast-deep-equal` as external
- `dist/index.d.ts`: TypeScript type definitions

The UMD build includes the generated parser via `@rollup/plugin-commonjs`.
