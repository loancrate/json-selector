# LoanCrate JSON Selectors

LoanCrate JSON Selectors are based on a subset of [JMESPath](https://jmespath.org)
with the following additions:

- A shorthand/extension for selecting an object from an array based on ID.
- A root-node expression, as added in the [JMESPath Community Edition](https://jmespath.site/main/#spec-root-node).

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

In addition to the extensions above, this library offers the following features compared to [jmespath.js](https://github.com/jmespath/jmespath.js):

- Written using TypeScript with hand-written recursive descent parser
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

## Operator Precedence

As mentioned above, JSON Selectors are based on
[JMESPath](https://jmespath.org). Although JMESPath claims to have an "ABNF
grammar with a complete specification", the
[specification](https://jmespath.org/specification.html) is not complete
regarding operator precedence, since it only mentions the relative precedence of
5 tokens (`|`, `||`, `&&`, `!`, and `]`). To discover the precedence of other
operators, we must turn to the [JMESPath source
code](https://github.com/jmespath/jmespath.js/blob/master/jmespath.js). It is
implemented as a [Top-Down Operator Precedence (TDOP)
parser](https://eli.thegreenplace.net/2010/01/02/top-down-operator-precedence-parsing),
which is based on principles like "token binding power", "null denotation"
(**nud**), and "left denotation" (**led**). Given knowledge of these principles
and the [binding power
table](https://github.com/jmespath/jmespath.js/blob/master/jmespath.js#L474-L501)
from the source, we can reverse-engineer the operator precedence of JMESPath.

Essentially, the expression grammar is structured as a left-hand side (LHS)
expression followed by zero or more right-hand side (RHS) expressions (which are
often projections on the result of the LHS). RHS expressions are consumed by the
parser and projected onto the LHS as long as they have the same or higher
binding power as the LHS. RHS expressions with lower binding power are projected
onto the result of the overall expression to the left, as opposed to the nearest
subexpression. For example, since dot (40) has a higher binding power than left
bracket (55), `a.b.c['id'].d.e` is parsed and evaluated like
`((a.b.c)['id']).d.e`. Binding power and precedence can be summarized as
follows, in increasing order:

- pipe: `|`
- or: `||`
- and: `&&`
- compare: `<=`, `>=`, `<`, `>`, `==`, `!=`
- not: `!`
- flatten projection: `[]`
- filter projection: `[?`
- star/slice projection: `[*`, `[<number?>:`
- index/ID access: `[<number>`, `['`
- member access: `.`

However, as a [special
case](https://github.com/jmespath/jmespath.js/blob/master/jmespath.js#L803-L805),
member access can directly follow (act as RHS) for any projection.

## License

This library is available under the [ISC license](LICENSE).
