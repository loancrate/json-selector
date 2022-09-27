# LoanCrate JSON Selectors

LoanCrate JSON Selectors are based on a subset of [JMESPath](https://jmespath.org/specification.html)
with a shorthand/extension for selecting an object from an array based on ID.

Currently, the subset includes everything except [functions](https://jmespath.org/specification.html#functions-expressions),
object projections ([`*` wildcard](https://jmespath.org/specification.html#wildcard-expressions) not within brackets),
and multi-select [lists](https://jmespath.org/specification.html#multiselect-list) and [hashes](https://jmespath.org/specification.html#multiselect-hash).
The library passes all of the [JMESPath compliance tests](https://github.com/jmespath/jmespath.test) not using those specific features.

To allow for selection by ID, we extend index expressions to accept a
[raw string literal](https://jmespath.org/specification.html#raw-string-literals)
(as opposed to a numeric literal), which represents the value of the `id` property
of the desired object from an array of objects.
Formally, `x['y']` would be equivalent to `x[?id == 'y'] | [0]` in JMESPath.
This should be unambiguous relative to the existing grammar and semantics.

In addition to the extension above, this library offers the following features compared to [jmespath.js](https://github.com/jmespath/jmespath.js):

- Written using Typescript and [PEG.js](https://pegjs.org/) for clarity and correctness
- Type definitions for the abstract syntax tree (AST) produced by the parser
- Typed visitor pattern for accessing AST nodes
- Formatting of an AST back into an expression string
- Read/write/delete accessors allow modification of the input data referenced by a selector
- Detailed error reporting for syntax errors

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

## License

This library is available under the [ISC license](LICENSE).
