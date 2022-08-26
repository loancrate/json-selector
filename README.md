# LoanCrate JSON Selectors

LoanCrate JSON Selectors are based on a subset of [JMESPath](https://jmespath.org/specification.html)
with a shorthand/extension for selecting an object from an array based on ID.
Specifically, the subset includes the [Basic Expressions](https://jmespath.org/tutorial.html#basic-expressions)
([identifiers](https://jmespath.org/specification.html#identifiers),
[subexpressions](https://jmespath.org/specification.html#subexpressions),
and [index expressions](https://jmespath.org/specification.html#indexexpressions)).
To allow for selection by ID, we extend index expressions to accept a
[raw string literal](https://jmespath.org/specification.html#raw-string-literals)
(as opposed to a numeric literal), which represents the value of the `id` property
of the desired object from an array of objects.
Formally, `x['y']` would be equivalent to `x[?id == 'y'] | [0]` in JMESPath.
This should be unambiguous relative to the existing grammar and semantics.

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
