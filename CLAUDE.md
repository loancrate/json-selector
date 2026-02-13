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

### Parser

The parser is implemented as a **hand-written Pratt parser** (precedence-climbing) with a **custom hand-written lexer**.

**Status**: Full JMESPath compliance achieved.

**Implementation**: The parser uses Pratt parsing with binding power to handle operator precedence efficiently. The lexer uses numeric token types (const enum) and lookup tables for optimal performance.

**Lexer Features**:

- Numeric const enum for token types (fast comparison)
- O(1) character classification using Uint8Array lookup tables
- Single-character token table for direct mapping
- Manual string scanning (raw strings: `\'` escape only, quoted strings: full JSON escapes plus backtick)
- No regex for token matching - pure character-code scanning

**Parser Key Components**:

- `expression(rbp)`: Core parsing loop with binding power control
- `nud()`: Null denotation - handles prefix operators and primary expressions
- `led()`: Left denotation - handles infix and postfix operators
- `parseProjectionRHS()`: Special handling for projection continuation (e.g., `foo[].bar[].baz`)

**Parser Features**:

- Array-based binding power lookup for fast precedence checks
- Smart bracket type detection: flatten (9), star (20), filter (21), index (55)
- Projection RHS correctly handles continuation vs termination

### Testing

```bash
npm test                # Run all tests with coverage
npm run test:ci         # Run tests in CI mode (sequential)
```

Tests are in the `test/` directory using Jest. To run a single test file:

```bash
npx jest test/parse.test.ts
```

**JMESPath Compliance**: All JMESPath compliance tests pass.

**Supported Features**:

- **Functions**: All JMESPath built-in functions with strict type validation
- **Multi-select lists**: `[foo, bar]` - selecting multiple fields into an array
- **Multi-select hashes**: `{a: foo, b: bar}` - creating new objects from selections
- **Object projections**: `.*` - wildcard over object keys (projects object values)
- **Expression references**: `&expr` - for sort_by, max_by, min_by, group_by, map

**Extensions** (LoanCrate-specific):

- **Root reference**: `$` - reference to root context
- **ID-based access**: `x['id']` - equivalent to `x[?id == 'id'] | [0]`

**Not Currently Supported**:

These JMESPath Community features are not yet supported:

- Arithmetic expressions (`+`, `-`, `*`, `/`, `%`, `//`)
- Let expressions (`let $var = expr in expression`)

### Linting

```bash
npm run lint            # Run ESLint
npm run lint:ci         # Run ESLint with JUnit output for CI
```

**CRITICAL RULE**: Avoid suppressing ESLint errors with `eslint-disable` comments unless absolutely necessary. When you must suppress an error (e.g., for safe type assertions the type system cannot verify), add a comment explaining why it's safe.

### Benchmarking

```bash
npm run benchmark                                       # Run and display results (json-selector)
npm run benchmark -- --library jmespath                 # Benchmark jmespath.js library
npm run benchmark -- --library typescript-jmespath      # Benchmark @jmespath-community/jmespath
npm run benchmark -- --output results.json              # Save results to JSON file
npm run benchmark -- --json                             # Output JSON to stdout
npm run benchmark -- --compare a.json b.json            # Compare two result files
npm run benchmark -- --threshold 15                     # Set regression threshold (default: 10%)
npm run benchmark -- --help                             # Show usage
```

**Comparative Library Benchmarking**

The benchmark tool supports comparing parsing performance across three JMESPath implementations:

1. **json-selector** (default) - Custom parser with json-selector extensions (81 test cases)
2. **jmespath** - Original jmespath.js library (78 test cases, excludes `$` root and `['id']` syntax)
3. **typescript-jmespath** - @jmespath-community/jmespath fork (79 test cases, excludes `['id']` syntax)

All libraries use their `compile()` function for parse-only benchmarking, ensuring fair comparison.

**Test Coverage**

Benchmarks test parsing performance across 81 test cases including:

- Isolated node types (primitives, access patterns, collection operations, logical operators)
- Complexity scaling (field depth, pipe chains, projections, logical chains)
- Real-world expressions (filters, projections, nested operations)
- Stress tests (deep nesting, long strings, complex combinations)

Results include average, standard deviation, min/max times, ops/sec, and percentile statistics (p50, p95, p99).

**Implementation**

Benchmark implementation is modular:

- `benchmark/types.ts`: Type definitions for results and metadata
- `benchmark/cases.ts`: Test case definitions, generators, and compatibility filtering
- `benchmark/parsers.ts`: Parser abstraction layer for multi-library support
- `benchmark/run.ts`: Core benchmark execution and statistics
- `benchmark/format.ts`: Console output formatting
- `benchmark/compare.ts`: Result comparison and regression detection
- `benchmark/index.ts`: CLI entry point with argument parsing

## Architecture

### Core Components

**Parser (`src/lexer.ts` + `src/parser.ts`)**

- Custom hand-written lexer for tokenization with keyword handling
- Hand-written Pratt parser for expression parsing
- Parses selector strings into AST nodes
- Handles operator precedence (pipe → or → and → compare → not → flatten → filter → star/slice → index/ID → member access)
- See `PRATT_ANALYSIS.md` for detailed grammar analysis

**AST (`src/ast.ts`)**

- TypeScript type definitions for all selector node types
- 21 node types: current, root, literal, identifier, fieldAccess, indexAccess, idAccess, project, filter, slice, flatten, not, compare, and, or, pipe, functionCall, expressionRef, multiSelectList, multiSelectHash, objectProject
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

**Functions (`src/functions/`)**

- `FunctionRegistry`: manages function registration and lookup
- Type system with `DataType` discriminated union (`PrimitiveType`, `ArrayType`, `UnionType`) for argument validation
- Strict type validation with error hierarchy: `FunctionError`, `InvalidArityError`, `InvalidArgumentTypeError`, `InvalidArgumentValueError`, `UnknownFunctionError`
- Built-in functions organized in modules:
  - `builtins/type.ts`: `type()`
  - `builtins/string.ts`: `length()`, `reverse()`, `to_string()`, `starts_with()`, `join()`, etc.
  - `builtins/math.ts`: `abs()`, `ceil()`, `floor()`, `sum()`, `avg()`, `min()`, `max()`
  - `builtins/array.ts`: `sort()`, `sort_by()`, `keys()`, `values()`, `map()`, etc.

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

- `dist/json-selector.umd.js`: UMD bundle with all dependencies (`fast-deep-equal`) included
- `dist/json-selector.esm.js`: ESM bundle with `fast-deep-equal` as external dependency
- `dist/index.d.ts`: TypeScript type definitions

The UMD build includes all dependencies via `@rollup/plugin-commonjs`. Note: The custom lexer eliminated the `moo` dependency.
