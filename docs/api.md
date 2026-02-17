# API Reference

TypeScript API for `@loancrate/json-selector`.

## Summary

### Core Functions

| Export                                          | Description                                 |
| ----------------------------------------------- | ------------------------------------------- |
| [`parseJsonSelector`](#parsejsonselector)       | Parse an expression string into an AST      |
| [`evaluateJsonSelector`](#evaluatejsonselector) | Evaluate a parsed selector against data     |
| [`formatJsonSelector`](#formatjsonselector)     | Convert an AST back to an expression string |

### Accessor Functions

| Export                                                  | Description                                         |
| ------------------------------------------------------- | --------------------------------------------------- |
| [`accessWithJsonSelector`](#accesswithjsonselector)     | Parse, compile, and bind a selector in one step     |
| [`makeJsonSelectorAccessor`](#makejsonselectoraccessor) | Compile a selector into a reusable unbound accessor |
| [`bindJsonSelectorAccessor`](#bindjsonselectoraccessor) | Bind an unbound accessor to a context               |
| [`getWithJsonSelector`](#getwithjsonselector)           | Read-only convenience wrapper                       |
| [`setWithJsonSelector`](#setwithjsonselector)           | Write convenience wrapper                           |

### Visitor

| Export                                    | Description                                     |
| ----------------------------------------- | ----------------------------------------------- |
| [`visitJsonSelector`](#visitjsonselector) | Dispatch to a visitor method based on node type |
| [`Visitor<R, C>`](#visitor-interface)     | Interface for AST traversal                     |

### Function System

| Export                                                      | Description                                               |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| [`FunctionRegistry`](#functionregistry)                     | Register and manage custom functions                      |
| [`getBuiltinFunctionProvider`](#getbuiltinfunctionprovider) | Access the built-in function table                        |
| [Type constants](#type-constants)                           | `ANY_TYPE`, `NUMBER_TYPE`, `STRING_TYPE`, etc.            |
| [Signature helpers](#signature-helpers)                     | `arg()`, `optArg()`, `varArg()`                           |
| [Type utilities](#type-utilities)                           | `matchesType()`, `formatType()`, `arrayOf()`, `unionOf()` |

### Errors

| Export                                        | Description                           |
| --------------------------------------------- | ------------------------------------- |
| [`JsonSelectorError`](#error-hierarchy)       | Base class for all library errors     |
| [`JsonSelectorSyntaxError`](#syntax-errors)   | Base class for parse-time errors      |
| [`JsonSelectorRuntimeError`](#runtime-errors) | Base class for evaluation-time errors |

### AST

| Export                                   | Description                                      |
| ---------------------------------------- | ------------------------------------------------ |
| [`JsonSelector`](#ast-reference)         | Discriminated union of all AST node types        |
| [`JsonSelectorNodeType`](#ast-reference) | String literal union of node type discriminators |

---

## Core Functions

### `parseJsonSelector`

```ts
function parseJsonSelector(
  selectorExpression: string,
  options?: ParserOptions,
): JsonSelector;
```

Parses an expression string into an AST. Throws a `JsonSelectorSyntaxError` subclass on invalid input.

**`ParserOptions`**

| Field                      | Type      | Default | Description                                                                        |
| -------------------------- | --------- | ------- | ---------------------------------------------------------------------------------- |
| `strictJsonLiterals`       | `boolean` | `false` | Require valid JSON in backtick literals; throw instead of falling back to a string |
| `rawStringBackslashEscape` | `boolean` | `true`  | Enable backslash escape in raw strings (both `\'` and `\\` are unescaped)          |

### `evaluateJsonSelector`

```ts
function evaluateJsonSelector(
  selector: JsonSelector,
  context: unknown,
  evalCtx?: Partial<EvaluationContext>,
): unknown;
```

Evaluates a parsed selector against `context` and returns the result. The optional `evalCtx` provides runtime configuration.

**`EvaluationContext`**

| Field                     | Type                           | Default            | Description                                                                     |
| ------------------------- | ------------------------------ | ------------------ | ------------------------------------------------------------------------------- |
| `rootContext`             | `unknown`                      | `context`          | The root document, accessible via `$`                                           |
| `functionProvider`        | `FunctionProvider`             | Built-in functions | Function lookup table                                                           |
| `bindings`                | `ReadonlyMap<string, unknown>` | —                  | Pre-bound lexical variables                                                     |
| `evaluateNullMultiSelect` | `boolean`                      | `true`             | Evaluate multi-select expressions on `null` context instead of short-circuiting |

A deprecated overload accepting `(selector, context, rootContext, options)` still exists for backward compatibility.

### `formatJsonSelector`

```ts
function formatJsonSelector(selector: JsonSelector): string;
```

Converts an AST back into an expression string. Preserves syntax hints: backtick literals remain backtick-delimited, bare numeric literals stay bare. The output is always valid syntax that can be re-parsed to an equivalent AST.

---

## Accessor Functions

Accessors provide `get()`, `set()`, and `delete()` operations on JSON data identified by a selector. The system uses a two-phase approach:

1. **Compile** (`makeJsonSelectorAccessor`) — produces an `UnboundAccessor` from a selector AST. This can be done once and reused.
2. **Bind** (`bindJsonSelectorAccessor`) — binds the accessor to a specific context object, producing an `Accessor<T>`.

For one-shot use, `accessWithJsonSelector` combines both steps.

### `accessWithJsonSelector`

```ts
function accessWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
  rootContext?: unknown, // defaults to context
  options?: Partial<AccessorOptions>,
): Accessor<unknown>;
```

Compiles and binds a selector in one step. Returns a bound `Accessor`.

**`AccessorOptions`**

| Field                     | Type                           | Default            | Description                                                                     |
| ------------------------- | ------------------------------ | ------------------ | ------------------------------------------------------------------------------- |
| `functionProvider`        | `FunctionProvider`             | Built-in functions | Function lookup table for evaluation                                            |
| `bindings`                | `ReadonlyMap<string, unknown>` | —                  | Lexical-scope variable bindings (name without `$` → value)                      |
| `evaluateNullMultiSelect` | `boolean`                      | `true`             | Evaluate multi-select expressions on `null` context instead of short-circuiting |

### `makeJsonSelectorAccessor`

```ts
function makeJsonSelectorAccessor(
  selector: JsonSelector,
  options?: Partial<AccessorOptions>,
): UnboundAccessor;
```

Compiles a selector AST into a reusable `UnboundAccessor`.

**`UnboundAccessor`**

```ts
interface UnboundAccessor {
  readonly selector: JsonSelector;
  isValidContext(context: unknown, rootContext?: unknown): boolean;
  get(context: unknown, rootContext?: unknown): unknown;
  set(value: unknown, context: unknown, rootContext?: unknown): void;
  delete(context: unknown, rootContext?: unknown): void;
}
```

- `isValidContext` — returns `true` if the selector can meaningfully operate on the given context (e.g., field access requires an object).
- `set` and `delete` are no-ops for read-only expressions (comparisons, logical operators, `!`).
- For projections, filters, and slices, `set` applies the value to each matching element, and `delete` removes matching elements while preserving non-matching ones.

### `bindJsonSelectorAccessor`

```ts
function bindJsonSelectorAccessor(
  unbound: UnboundAccessor,
  context: unknown,
  rootContext?: unknown, // defaults to context
): Accessor<unknown>;
```

Binds an unbound accessor to a specific context.

**`Accessor<T>`**

```ts
interface Accessor<T> {
  readonly selector: JsonSelector;
  readonly valid: boolean; // result of isValidContext
  readonly path: string; // formatted selector string
  get(): T;
  set(value: T): void;
  delete(): void;
}
```

### `getWithJsonSelector`

```ts
function getWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
  options?: Partial<AccessorOptions>,
): unknown;
```

Read-only convenience wrapper. Equivalent to `accessWithJsonSelector(selector, context, context, options).get()`.

### `setWithJsonSelector`

```ts
function setWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
  value: unknown,
  options?: Partial<AccessorOptions>,
): unknown;
```

Sets the value at the selector path and returns the previous value.

---

## Visitor

### `visitJsonSelector`

```ts
function visitJsonSelector<R, C>(
  selector: JsonSelector,
  visitor: Visitor<R, C>,
  context: C,
): R;
```

Dispatches to the appropriate method on `visitor` based on the node's `type` discriminator. This is the recommended way to traverse the AST rather than writing manual `switch` statements.

### Visitor Interface

```ts
interface Visitor<R, C> {
  current(node: JsonSelectorCurrent, context: C): R;
  root(node: JsonSelectorRoot, context: C): R;
  literal(node: JsonSelectorLiteral, context: C): R;
  identifier(node: JsonSelectorIdentifier, context: C): R;
  fieldAccess(node: JsonSelectorFieldAccess, context: C): R;
  indexAccess(node: JsonSelectorIndexAccess, context: C): R;
  idAccess(node: JsonSelectorIdAccess, context: C): R;
  project(node: JsonSelectorProject, context: C): R;
  filter(node: JsonSelectorFilter, context: C): R;
  slice(node: JsonSelectorSlice, context: C): R;
  flatten(node: JsonSelectorFlatten, context: C): R;
  not(node: JsonSelectorNot, context: C): R;
  compare(node: JsonSelectorCompare, context: C): R;
  arithmetic(node: JsonSelectorArithmetic, context: C): R;
  unaryArithmetic(node: JsonSelectorUnaryArithmetic, context: C): R;
  and(node: JsonSelectorAnd, context: C): R;
  or(node: JsonSelectorOr, context: C): R;
  ternary(node: JsonSelectorTernary, context: C): R;
  pipe(node: JsonSelectorPipe, context: C): R;
  functionCall(node: JsonSelectorFunctionCall, context: C): R;
  expressionRef(node: JsonSelectorExpressionRef, context: C): R;
  variableRef(node: JsonSelectorVariableRef, context: C): R;
  let(node: JsonSelectorLet, context: C): R;
  multiSelectList(node: JsonSelectorMultiSelectList, context: C): R;
  multiSelectHash(node: JsonSelectorMultiSelectHash, context: C): R;
  objectProject(node: JsonSelectorObjectProject, context: C): R;
}
```

`R` is the return type of each visitor method. `C` is a context value threaded through all calls.

---

## Function System

### `FunctionRegistry`

```ts
class FunctionRegistry implements FunctionProvider {
  constructor(baseProvider?: FunctionProvider | null);
  register(def: FunctionDefinition): void;
  unregister(name: string): boolean;
}
```

A mutable registry that layers custom functions on top of a base provider. By default, the base provider is the built-in function set. Pass `null` to start with no built-in functions.

Custom functions override built-in functions of the same name. `unregister` only removes custom functions, not base functions.

Pass a `FunctionRegistry` as the `functionProvider` in `EvaluationContext` or `AccessorOptions`.

**Example: registering a custom function**

```ts
import {
  parseJsonSelector,
  evaluateJsonSelector,
  FunctionRegistry,
  arg,
  NUMBER_TYPE,
} from "@loancrate/json-selector";

const registry = new FunctionRegistry();
registry.register({
  name: "double",
  signatures: [[arg("value", NUMBER_TYPE)]],
  handler: ({ args }) => (args[0] as number) * 2,
});

const selector = parseJsonSelector("double(age)");
const result = evaluateJsonSelector(
  selector,
  { age: 21 },
  {
    functionProvider: registry,
  },
);
// result === 42
```

### `getBuiltinFunctionProvider`

```ts
function getBuiltinFunctionProvider(): FunctionProvider;
```

Returns a singleton `FunctionProvider` (a `ReadonlyMap<string, FunctionDefinition>`) containing all built-in functions. Used as the default when no custom function provider is specified.

### `FunctionDefinition`

```ts
interface FunctionDefinition {
  name: string;
  signatures: NonEmptyArray<ArgumentSignature[]>;
  handler: FunctionHandler;
}
```

- `signatures` — one or more overloaded parameter lists. Arguments are validated against each signature in order until one matches.
- `handler` — receives `FunctionCallBindings` with pre-validated `args`, `context`, `evaluate`, and evaluation context fields.

### Type Constants

Pre-defined type descriptors for function signatures:

| Constant            | Matches                         |
| ------------------- | ------------------------------- |
| `ANY_TYPE`          | Any value                       |
| `BOOLEAN_TYPE`      | `true` or `false`               |
| `NUMBER_TYPE`       | Numbers                         |
| `STRING_TYPE`       | Strings                         |
| `OBJECT_TYPE`       | Plain objects                   |
| `NULL_TYPE`         | `null`                          |
| `EXPREF_TYPE`       | Expression references (`&expr`) |
| `ANY_ARRAY_TYPE`    | Arrays of any element type      |
| `NUMBER_ARRAY_TYPE` | Arrays of numbers               |
| `STRING_ARRAY_TYPE` | Arrays of strings               |

### Type Utilities

```ts
function arrayOf(elementType: ConcreteType): ArrayType;
function unionOf(
  types: [ConcreteType, ConcreteType, ...ConcreteType[]],
): UnionType;
function matchesType(value: unknown, type: DataType): boolean;
function getDataType(value: unknown): ConcreteType;
function getDataTypeKind(value: unknown): ConcreteTypeKind;
function formatType(type: DataType): string;
```

- `arrayOf` — creates an array type with a specific element type.
- `unionOf` — creates a union type from two or more concrete types.
- `matchesType` — tests if a runtime value conforms to a type descriptor.
- `getDataType` / `getDataTypeKind` — introspect the type of a runtime value.
- `formatType` — formats a type descriptor as a human-readable string for error messages.

### Signature Helpers

```ts
function arg(name: string, type: DataType): ArgumentSignature;
function optArg(name: string, type: DataType): ArgumentSignature;
function varArg(name: string, type: DataType): ArgumentSignature;
```

- `arg` — required parameter.
- `optArg` — optional parameter (must appear after all required parameters).
- `varArg` — variadic parameter accepting one or more values (must be last).

---

## Error Hierarchy

All errors thrown by the library extend `JsonSelectorError`. Parse-time and runtime errors form two separate branches.

```
JsonSelectorError
├── JsonSelectorSyntaxError
│   ├── UnexpectedCharacterError
│   ├── UnterminatedTokenError
│   ├── InvalidTokenError
│   ├── UnexpectedTokenError
│   └── UnexpectedEndOfInputError
└── JsonSelectorRuntimeError
    ├── JsonSelectorTypeError
    │   ├── NotANumberError
    │   └── DivideByZeroError
    ├── UndefinedVariableError
    └── FunctionError
        ├── UnknownFunctionError
        ├── InvalidArityError
        └── InvalidArgumentError
            ├── InvalidArgumentTypeError
            └── InvalidArgumentValueError
```

### Syntax Errors

All syntax errors extend `JsonSelectorSyntaxError` and include:

| Field        | Type     | Description                                 |
| ------------ | -------- | ------------------------------------------- |
| `expression` | `string` | The expression being parsed                 |
| `offset`     | `number` | Character position where the error occurred |

**Subclasses and their additional fields:**

| Error                       | Additional Fields                                        |
| --------------------------- | -------------------------------------------------------- |
| `UnexpectedCharacterError`  | `character: string`                                      |
| `UnterminatedTokenError`    | `tokenKind: string`, `expectedDelimiter: string`         |
| `InvalidTokenError`         | `tokenKind: string`, `detail: string`                    |
| `UnexpectedTokenError`      | `token: string`, `expected?: string`, `context?: string` |
| `UnexpectedEndOfInputError` | `expected?: string`                                      |

### Runtime Errors

All runtime errors extend `JsonSelectorRuntimeError`.

| Error                       | Fields                                  | Thrown When                                                                         |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| `NotANumberError`           | `operator`, `operandRole`, `actualType` | Arithmetic on non-numeric operand                                                   |
| `DivideByZeroError`         | `operator`, `divisor`                   | Division or integer division by zero                                                |
| `UndefinedVariableError`    | `variableName`                          | Referencing an unbound `$variable`                                                  |
| `UnknownFunctionError`      | `functionName`                          | Calling a function that doesn't exist                                               |
| `InvalidArityError`         | `functionName`                          | Wrong number of arguments                                                           |
| `InvalidArgumentTypeError`  | `functionName`, `argumentName`          | Argument has wrong type                                                             |
| `InvalidArgumentValueError` | `functionName`, `argumentName`          | Argument type is valid but value is not (e.g., negative integer, non-integer float) |

---

## AST Reference

`JsonSelector` is a discriminated union of 26 node types. Use `node.type` for pattern matching, or [`visitJsonSelector`](#visitjsonselector) for type-safe traversal.

`JsonSelectorNodeType` is the string literal union of all `type` discriminators.

| `type`              | Interface                     | Key Fields                                     |
| ------------------- | ----------------------------- | ---------------------------------------------- |
| `"current"`         | `JsonSelectorCurrent`         | `explicit?: boolean`                           |
| `"root"`            | `JsonSelectorRoot`            | —                                              |
| `"literal"`         | `JsonSelectorLiteral`         | `value: JsonValue`, `backtickSyntax?: boolean` |
| `"identifier"`      | `JsonSelectorIdentifier`      | `id: string`                                   |
| `"fieldAccess"`     | `JsonSelectorFieldAccess`     | `expression`, `field: string`                  |
| `"indexAccess"`     | `JsonSelectorIndexAccess`     | `expression`, `index: number`                  |
| `"idAccess"`        | `JsonSelectorIdAccess`        | `expression`, `id: string`                     |
| `"project"`         | `JsonSelectorProject`         | `expression`, `projection?: JsonSelector`      |
| `"objectProject"`   | `JsonSelectorObjectProject`   | `expression`, `projection?: JsonSelector`      |
| `"filter"`          | `JsonSelectorFilter`          | `expression`, `condition: JsonSelector`        |
| `"slice"`           | `JsonSelectorSlice`           | `expression`, `start?`, `end?`, `step?`        |
| `"flatten"`         | `JsonSelectorFlatten`         | `expression`                                   |
| `"not"`             | `JsonSelectorNot`             | `expression`                                   |
| `"compare"`         | `JsonSelectorCompare`         | `operator`, `lhs`, `rhs`                       |
| `"arithmetic"`      | `JsonSelectorArithmetic`      | `operator`, `lhs`, `rhs`                       |
| `"unaryArithmetic"` | `JsonSelectorUnaryArithmetic` | `operator`, `expression`                       |
| `"and"`             | `JsonSelectorAnd`             | `lhs`, `rhs`                                   |
| `"or"`              | `JsonSelectorOr`              | `lhs`, `rhs`                                   |
| `"ternary"`         | `JsonSelectorTernary`         | `condition`, `consequent`, `alternate`         |
| `"pipe"`            | `JsonSelectorPipe`            | `lhs`, `rhs`, `dotSyntax?: boolean`            |
| `"functionCall"`    | `JsonSelectorFunctionCall`    | `name: string`, `args: JsonSelector[]`         |
| `"expressionRef"`   | `JsonSelectorExpressionRef`   | `expression`                                   |
| `"variableRef"`     | `JsonSelectorVariableRef`     | `name: string`                                 |
| `"let"`             | `JsonSelectorLet`             | `bindings: {name, value}[]`, `expression`      |
| `"multiSelectList"` | `JsonSelectorMultiSelectList` | `expressions: JsonSelector[]`                  |
| `"multiSelectHash"` | `JsonSelectorMultiSelectHash` | `entries: {key, value}[]`                      |

All `expression`, `lhs`, `rhs`, `condition`, `consequent`, and `alternate` fields are of type `JsonSelector`. For complete type definitions, see `src/ast.ts` or use your editor's TypeScript support.
