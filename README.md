# LoanCrate JSON Selectors

LoanCrate JSON Selectors is a production-focused TypeScript implementation for querying and updating JSON documents with JMESPath-style expressions. It emphasizes strict type-checking discipline and performance-focused execution, with typed AST/visitor APIs, formatting back to expression strings, and read/write/delete accessors for mutating selected values.

## Installation

```sh
npm add @loancrate/json-selector
```

## Usage

```ts
import {
  accessWithJsonSelector,
  parseJsonSelector,
} from "@loancrate/json-selector";

const obj = {
  foo: {
    bar: [
      {
        id: "x",
        value: 1,
      },
    ],
  },
};
const selector = parseJsonSelector("foo.bar['x'].value");
const accessor = accessWithJsonSelector(selector, obj);
console.log(accessor.get()); // 1
console.log(obj.foo.bar[0].value); // 1
accessor.set(2);
console.log(obj.foo.bar[0].value); // 2
accessor.delete();
console.log(obj.foo.bar[0].value); // undefined
```

## Standards and Extensions

- **Original [JMESPath](https://jmespath.org) spec**: fully implemented.
- **[JMESPath Community Edition](https://jmespath.site/main/)**: fully implemented (community fixtures are maintained separately from core JMESPath fixtures).
- **JSON Selector extension**: ID-based index shorthand (`x['id']`).
- **JSON Selector extension**: bare numeric literals as general expressions (for example `a-1`, `-1`, `foo[?price > 0]`) in addition to backtick numeric literals.

This includes JMESPath Community features such as root-node expressions (`$`), arithmetic expressions, and lexical-scope `let` expressions (`let $x = expr in expr`). In `let` expressions, binding values are evaluated in the outer scope, and `let`/`in` are contextual keywords (not reserved identifiers). The library maintains full compliance with both official [JMESPath compliance tests](https://github.com/jmespath/jmespath.test) (`test/jmespath/*`) and JMESPath Community Edition fixtures (`test/jmespath-community/*`).

Backtick literals use modern (JEP-12a-style) behavior by default. Legacy compatibility behavior is configurable via `ParserOptions` and `EvaluationContext`:

- `legacyLiterals` (parser option): enables legacy backtick-literal fallback behavior.
- `legacyRawStringEscapes` (parser option): enables legacy raw-string escaping where only `\'` is unescaped.
- `legacyNullPropagation` (evaluation option): enables legacy null propagation for multi-select expressions (set via `evaluateJsonSelector(..., context, { legacyNullPropagation: true })`).

By default, raw strings unescape both `\'` and `\\`, and multi-select expressions evaluate on `null` context per Community Edition semantics.

To allow for selection by ID, we extend index expressions to accept a
[raw string literal](https://jmespath.org/specification.html#raw-string-literals)
(as opposed to a numeric literal), which represents the value of the `id` property
of the desired object from an array of objects.
Formally, `x['y']` would be equivalent to `x[?id == 'y'] | [0]` in JMESPath.
This should be unambiguous relative to the existing grammar and semantics.

To support arithmetic with bare numeric literals while preserving JMESPath-style
negative index/slice syntax, `-` is always tokenized as an operator and resolved
in the parser:

- unary sign over numeric literals is folded at parse time (for example `-42`, `--1`)
- subtraction in expression position remains standard (for example `a-1`)
- negative index/slice values are parsed explicitly in bracket/slice grammar (for example `foo[-1]`, `foo[:-1]`)

In addition to the extensions above, this library offers the following features compared to [jmespath.js](https://github.com/jmespath/jmespath.js):

- Strict type-checking and runtime validation discipline across parser, evaluator, and functions
- Performance-focused implementation with optimized parsing and benchmarking support
- Type definitions for the abstract syntax tree (AST) produced by the parser
- Typed visitor pattern for accessing AST nodes
- Formatting of an AST back into an expression string
- Read/write/delete accessors allow modification of the input data referenced by a selector
- Detailed error reporting for syntax errors

## Operator Precedence

JSON Selector expressions use deterministic precedence rules. When parentheses
are omitted, operators bind from lowest to highest as listed below.

The expression grammar has three main categories of operators:

**Control, logical, comparison, and arithmetic operators** (lowest to highest):

- pipe: `|`
- ternary: `?:`
- or: `||`
- and: `&&`
- compare: `<=`, `>=`, `<`, `>`, `==`, `!=`
- additive: `+`, `-`, `−`
- multiplicative: `*`, `×`, `/`, `÷`, `%`, `//`
- unary prefixes: `!`, unary `+`, unary `-`, unary `−`

Higher-precedence operators bind more tightly. For example, `a || b && c`
parses as `a || (b && c)`, and `a || b.c` parses as `a || (b.c)` because
access operators have higher precedence than `||`.

**Access operators** chain left-to-right as postfix operators:

- member access: `.field`
- index access: `[0]`, `[n:m]` (slices)
- ID access: `['id']` (shorthand for `[?id == 'id'] | [0]`)

For example, `a[0].b.c['id'].d.e` parses as `(((((a[0]).b).c)['id']).d).e` -
each operator applies to the complete expression on its left, building up the
chain step by step.

**Projection operators** create projections that map over collections:

- flatten: `[]` (flatten arrays)
- filter: `[?condition]` (filter by condition)
- array star: `[*]` (map over array values)
- object star: `*`, `.*` (map over object values)

Projections terminate before pipe, ternary, logical, comparison, and arithmetic
operators, but continue with access operators and can chain with other
projections. For example:

- `items[*].name` - projects over items, accessing name from each
- `items[*].tags[]` - projects over items, then flattens tags arrays
- `obj.*.name` - projects over object values, then accesses `name` from each
- `items[*] || []` - projection completes before the `||`, result is `(items[*]) || []`

**Note on chained flattens**: Multiple flattens compound to flatten deeper
levels. For example, on data `[[[1,2]], [[3,4]]]`:

- `[]` gives `[[1,2], [3,4]]` (one level)
- `[][]` gives `[1,2,3,4]` (two levels)
- `[*][]` gives `[[1,2], [3,4]]` (projects then flattens once - not the same as `[][]`)

## License

This library is available under the [ISC license](LICENSE).
