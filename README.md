# LoanCrate JSON Selectors

A TypeScript library for querying and mutating JSON documents using [JMESPath](https://jmespath.org)-style expressions. Fully implements both the original JMESPath specification and [JMESPath Community Edition](https://jmespath.site/main/), with two extensions for ID-based access and bare numeric literals.

Key capabilities:

- **Parse** expression strings into a typed AST
- **Evaluate** selectors against JSON data
- **Format** ASTs back into expression strings (round-trip safe)
- **Read/write/delete** values via selector-based accessors
- **Extend** with custom functions via a pluggable registry

## Installation

```sh
npm add @loancrate/json-selector
```

## Quick Start

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

## Documentation

- [**Language Reference**](docs/language.md) — Expression syntax, operators, precedence, projections, and extensions
- [**Function Reference**](docs/functions.md) — All 43 built-in functions with signatures and behavior
- [**API Reference**](docs/api.md) — TypeScript exports, accessors, visitor, function system, errors, and AST
- [**Benchmarks**](docs/benchmark.md) — Parsing performance benchmarks and cross-library comparison

## Standards and Extensions

The library fully implements the original [JMESPath specification](https://jmespath.org) and [JMESPath Community Edition](https://jmespath.site/main/), including root-node expressions (`$`), arithmetic, ternary conditionals, and lexical-scope `let` expressions. Compliance is verified against both official [JMESPath test fixtures](https://github.com/jmespath/jmespath.test) and JMESPath Community Edition fixtures.

Two extensions are added:

- **ID-based access**: `x['id']` selects the first array element whose `id` property matches — equivalent to `x[?id == 'id'] | [0]` in standard JMESPath.
- **Bare numeric literals**: Numbers like `0`, `-1`, `3.14` can appear directly in expressions without backtick delimiters, enabling natural syntax like `foo[?price > 0]` and `a - 1`.

Compatibility options (`strictJsonLiterals`, `rawStringBackslashEscape`, `evaluateNullMultiSelect`) control standards-compliance behavior. See the [Language Reference](docs/language.md#legacy-compatibility) for details.

## License

This library is available under the [ISC license](LICENSE).
