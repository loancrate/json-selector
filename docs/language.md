# Expression Language Reference

LoanCrate JSON Selectors implement [JMESPath](https://jmespath.org) and [JMESPath Community Edition](https://jmespath.site/main/) with two extensions: [ID-based access](#id-based-access-extension) and [bare numeric literals](#bare-numeric-literals-extension).

## Summary

Precedence is numbered 1 (tightest) through 8 (loosest). Prefix and postfix operators are listed separately.

### Operators and Expressions

| #   | Group                           | Element                             | Syntax                               |
| --- | ------------------------------- | ----------------------------------- | ------------------------------------ |
| 1   | [Arithmetic](#arithmetic)       | [Multiply](#multiplication)         | `a * b`, `a × b`                     |
| 1   | [Arithmetic](#arithmetic)       | [Divide](#division)                 | `a / b`, `a ÷ b`                     |
| 1   | [Arithmetic](#arithmetic)       | [Integer divide](#integer-division) | `a // b`                             |
| 1   | [Arithmetic](#arithmetic)       | [Modulo](#modulo)                   | `a % b`                              |
| 2   | [Arithmetic](#arithmetic)       | [Add](#addition)                    | `a + b`                              |
| 2   | [Arithmetic](#arithmetic)       | [Subtract](#subtraction)            | `a - b`, `a − b`                     |
| 3   | [Comparison](#comparison)       | [Equality](#equality)               | `a == b`, `a != b`                   |
| 3   | [Comparison](#comparison)       | [Ordering](#ordering)               | `a < b`, `a <= b`, `a > b`, `a >= b` |
| 4   | [Logical](#logical-operators)   | [AND](#logical-and)                 | `a && b`                             |
| 5   | [Logical](#logical-operators)   | [OR](#logical-or)                   | `a \|\| b`                           |
| 6   | [Control](#control-flow)        | [Ternary](#ternary)                 | `a ? b : c`                          |
| 7   | [Control](#control-flow)        | [Pipe](#pipe)                       | `a \| b`                             |
| 8   | [Variables](#variables-and-let) | [Let](#let-expressions)             | `let $x = e in body`                 |

**Prefix operators** apply to the expression immediately to their right:

| Group                         | Element                               | Syntax           | Binding                                   |
| ----------------------------- | ------------------------------------- | ---------------- | ----------------------------------------- |
| [Logical](#logical-operators) | [Logical NOT](#logical-not)           | `!expr`          | Immediate operand only: `!a.b` = `(!a).b` |
| [Arithmetic](#arithmetic)     | [Unary plus/minus](#unary-arithmetic) | `+expr`, `-expr` | Through access: `-a.b` = `-(a.b)`         |

**Postfix / access operators** chain left-to-right and bind tighter than all binary operators:

| Group             | Element                                 | Syntax                |
| ----------------- | --------------------------------------- | --------------------- |
| [Access](#access) | [Identifier](#identifier)               | `name`                |
| [Access](#access) | [Field access](#field-access)           | `expr.name`           |
| [Access](#access) | [Index access](#index-access)           | `expr[0]`, `expr[-1]` |
| [Access](#access) | [ID access](#id-based-access-extension) | `expr['id']`          |

**Other expressions** (no precedence interaction):

| Group                         | Element                                         | Syntax                                     |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------ |
| [Context](#context)           | [Current node](#current-node)                   | `@`                                        |
| [Context](#context)           | [Root document](#root-document)                 | `$`                                        |
| [Literals](#literals)         | [JSON literal](#json-literals)                  | `` `42` ``, `` `"text"` ``, `` `[1, 2]` `` |
| [Literals](#literals)         | [Raw string](#raw-strings)                      | `'text'`                                   |
| [Literals](#literals)         | [Quoted string](#quoted-strings)                | `"text"`                                   |
| [Literals](#literals)         | [Bare number](#bare-numeric-literals-extension) | `42`, `-3.14`                              |
| [Literals](#literals)         | [Keywords](#keyword-literals)                   | `true`, `false`, `null`                    |
| [Multi-select](#multi-select) | [List](#multi-select-list)                      | `[expr, expr]`                             |
| [Multi-select](#multi-select) | [Hash](#multi-select-hash)                      | `{key: expr, key: expr}`                   |
| [Functions](#function-calls)  | [Function call](#function-calls)                | `name(arg, ...)`                           |
| [Functions](#function-calls)  | [Expression ref](#expression-references)        | `&expr`                                    |

### Projections

Projections map an operation over a collection. They continue through access operators but terminate before pipe, ternary, logical, comparison, and arithmetic operators.

| Element                                 | Syntax                 | Description                  |
| --------------------------------------- | ---------------------- | ---------------------------- |
| [Array projection](#array-projection)   | `expr[*]`              | Map over array elements      |
| [Object projection](#object-projection) | `expr.*`               | Map over object values       |
| [Flatten](#flatten)                     | `expr[]`               | Flatten one level of nesting |
| [Filter](#filter-projection)            | `expr[?condition]`     | Select matching elements     |
| [Slice](#slice)                         | `expr[start:end:step]` | Select a range of elements   |

---

## Context

### Current Node

**Syntax**: `@`

Refers to the current context value being evaluated. Usually implicit — a bare identifier `foo` is equivalent to `@.foo`. Explicit `@` is useful inside filter expressions and function arguments.

```
people[?@ == 'Alice']     # filter where the element itself equals 'Alice'
people[*].name | [0]      # @ is implicit before people
```

### Root Document

**Syntax**: `$`

Refers to the top-level input document, regardless of the current evaluation context. Useful inside filters and let expressions to reference data outside the current scope.

```
machines[?state == $preferences.default_state]
```

---

## Literals

### JSON Literals

**Syntax**: `` `value` ``

Embeds a constant JSON value. The content between backticks must be valid JSON. Escape backticks with `\``.

```
`"hello"`         # string
`42`              # number
`[1, 2, 3]`      # array
`{"a": 1}`        # object
`true`            # boolean
`null`            # null
```

Note: the backtick content must be valid JSON, so strings require inner quotes: `` `"hello"` ``, not `` `hello` ``.

With `legacyLiterals` enabled, invalid JSON inside backticks falls back to a string (e.g., `` `foo` `` becomes `"foo"`).

### Raw Strings

**Syntax**: `'text'`

A string literal where the content is taken verbatim. Escape single quotes with `\'`. By default, `\\` is also unescaped to `\`.

```
'hello world'
'it\'s escaped'
'backslash: \\'
```

With `legacyRawStringEscapes` enabled, only `\'` is unescaped; `\\` remains literal.

### Quoted Strings

**Syntax**: `"text"`

An identifier or field name with JSON-style escape sequences (`\"`, `\\`, `\n`, `\t`, `\r`, `\b`, `\f`, `\uXXXX`). Additionally supports `\`` for backtick escaping.

Quoted strings function as identifiers, not literal values. `"foo"` is equivalent to the identifier `foo` and accesses a field named `foo` on the current context.

### Keyword Literals

**Syntax**: `true`, `false`, `null`

Boolean and null constant values, evaluated as JSON literals.

### Bare Numeric Literals (Extension)

**Syntax**: `42`, `-3.14`, `1e10`

A JSON Selector extension that allows numeric literals without backtick delimiters in expression position. Supports integers, decimals, and scientific notation.

```
foo[?price > 0]       # 0 is a bare numeric literal
a - 1                 # 1 is a bare numeric literal
```

The parser folds unary sign operators on bare numeric literals at parse time: `-42` becomes a single literal node with value `-42`.

---

## Access

### Identifier

**Syntax**: `name`

Accesses a field on the current context object. Returns `null` if the field doesn't exist or the context isn't an object.

Identifiers must start with a letter or underscore and contain letters, digits, and underscores. Use [quoted strings](#quoted-strings) for other field names.

### Field Access

**Syntax**: `expr.name`

Accesses a named field on the result of `expr`. Equivalent to evaluating `expr` then looking up `name`.

```
foo.bar.baz           # nested field access
```

### Index Access

**Syntax**: `expr[n]`

Accesses an array element by index. Negative indices count from the end: `[-1]` is the last element, `[-2]` is second-to-last.

Returns `null` if the index is out of bounds or the context isn't an array.

```
items[0]              # first element
items[-1]             # last element
```

### ID-Based Access (Extension)

**Syntax**: `expr['id']`

A JSON Selector extension. Selects the first element from an array whose `id` property equals the given raw string. Formally equivalent to `expr[?id == 'id'] | [0]`.

```
users['alice']        # first element where id == 'alice'
foo.bar['x'].value    # chain with other access
```

---

## Projections

Projections evaluate a sub-expression against each element of a collection. Null results are filtered out. Projections continue through subsequent access operators (`.field`, `[n]`, etc.) but terminate before pipe, logical, comparison, and arithmetic operators.

### Array Projection

**Syntax**: `expr[*]`

Maps over all elements of an array. If the context is not an array, returns `null`.

```
people[*].name        # extract 'name' from each person
items[*][0]           # first element of each sub-array
```

### Object Projection

**Syntax**: `expr.*`

Maps over all values of an object (keys are discarded). If the context is not an object, returns `null`.

```
machines.*.state      # extract 'state' from each machine value
```

### Flatten

**Syntax**: `expr[]`

Flattens one level of array nesting. Non-array elements and `null` values are discarded.

```
[[1, 2], [3, 4]]  | []         # [1, 2, 3, 4]
[[1, 2], [3, 4]]  | [][]       # [1, 2, 3, 4] (already flat)
[[[1, 2]], [[3]]]  | []        # [[1, 2], [3]]
[[[1, 2]], [[3]]]  | [][]      # [1, 2, 3]
```

Flatten also creates a projection — subsequent access operators are applied to each element.

### Filter Projection

**Syntax**: `expr[?condition]`

Selects array elements where `condition` is truthy. The condition is evaluated against each element with `@` as the current node.

**Truthiness**: `null`, `false`, empty arrays `[]`, and empty objects `{}` are falsy. Everything else is truthy — including `0` and `""`.

```
people[?age >= 18]                # adults
items[?state == 'active'].name    # names of active items
people[?name]                     # people with a truthy name
```

### Slice

**Syntax**: `expr[start:end:step]`

Selects a range of array elements using Python-style slice semantics. All three parts are optional.

- **start**: first index (inclusive). Default: `0` (or last index if step < 0).
- **end**: stop index (exclusive). Default: array length (or before first if step < 0).
- **step**: stride. Default: `1`. Cannot be `0` (throws an error).
- Negative values for start/end count from the end of the array.
- Negative step reverses iteration direction.

```
items[0:5]            # first 5 elements
items[::2]            # every other element
items[::-1]           # reversed array
items[-3:]            # last 3 elements
items[1:-1]           # all but first and last
```

---

## Arithmetic

All arithmetic operators require numeric operands. Non-numeric operands throw `NotANumberError`. Division by zero throws `DivideByZeroError`.

Unicode operator variants are supported: `−` (U+2212) for subtraction/negation, `×` (U+00D7) for multiplication, `÷` (U+00F7) for division.

### Addition

**Syntax**: `a + b` &emsp; **Precedence**: 2

Adds two numbers.

### Subtraction

**Syntax**: `a - b` or `a − b` &emsp; **Precedence**: 2

Subtracts the right operand from the left.

### Multiplication

**Syntax**: `a * b` or `a × b` &emsp; **Precedence**: 1

Multiplies two numbers. Note: `*` in bracket context (`[*]`) is an array projection, not multiplication.

### Division

**Syntax**: `a / b` or `a ÷ b` &emsp; **Precedence**: 1

Divides the left operand by the right. Division by zero throws `DivideByZeroError`.

### Integer Division

**Syntax**: `a // b` &emsp; **Precedence**: 1

Floor division — divides and rounds toward negative infinity. Division by zero throws `DivideByZeroError`.

### Modulo

**Syntax**: `a % b` &emsp; **Precedence**: 1

Remainder after division.

### Unary Arithmetic

**Syntax**: `+expr`, `-expr`

Unary plus (identity) or negation. When applied to a numeric literal, the sign is folded into the literal at parse time (`-42` becomes a single literal node).

Unlike `!`, unary `+`/`-` extend through access operators: `-foo.bar` parses as `-(foo.bar)`, not `(-foo).bar`.

---

## Comparison

All comparison operators have precedence 3. They are non-associative: `a < b < c` is a syntax error.

### Equality

**Syntax**: `a == b`, `a != b`

Deep equality comparison using structural equality. Works on any types — two values of different types are never equal (except `null == null`).

### Ordering

**Syntax**: `a < b`, `a <= b`, `a > b`, `a >= b`

Numeric ordering. Both operands must be numbers. If either operand is not a number, the result is `null` (not an error).

---

## Logical Operators

### Logical NOT

**Syntax**: `!expr`

Returns `true` if `expr` is falsy, `false` otherwise. See [truthiness](#filter-projection) for the definition of falsy values.

`!` binds to the immediate next operand only — it does not extend through access operators. `!foo.bar` parses as `(!foo).bar`, not `!(foo.bar)`. Use parentheses for the latter: `!(foo.bar)`.

### Logical AND

**Syntax**: `a && b` &emsp; **Precedence**: 4

Short-circuit evaluation. Returns `a` if `a` is falsy, otherwise returns `b`. Does _not_ coerce to boolean.

```
name && name.first    # null if name is falsy, otherwise name.first
```

### Logical OR

**Syntax**: `a || b` &emsp; **Precedence**: 5

Short-circuit evaluation. Returns `a` if `a` is truthy, otherwise returns `b`. Does _not_ coerce to boolean.

```
nickname || name      # nickname if truthy, otherwise name
items || `[]`         # default to empty array
```

---

## Control Flow

### Pipe

**Syntax**: `a | b` &emsp; **Precedence**: 7

Evaluates `a`, then evaluates `b` with the result of `a` as the new current context. Resets the projection context — projections terminate at a pipe.

```
people[*].name | sort(@)       # sort the projected names
items[?active] | [0]           # first active item
```

### Ternary

**Syntax**: `condition ? consequent : alternate` &emsp; **Precedence**: 6

Evaluates `condition`. If truthy, evaluates and returns `consequent`; otherwise evaluates and returns `alternate`. Right-associative: `a ? b : c ? d : e` parses as `a ? b : (c ? d : e)`.

```
age >= 18 ? 'adult' : 'minor'
```

---

## Multi-Select

### Multi-Select List

**Syntax**: `[expr, expr, ...]`

Evaluates each expression against the current context and returns the results as an array.

```
[name, age, email]                # array of three values
people[*].[name, age]             # for each person, array of name and age
```

### Multi-Select Hash

**Syntax**: `{key: expr, key: expr, ...}`

Evaluates each expression against the current context and returns an object with the given keys.

```
{name: name, years: age}
people[*].{fullName: name, yearsOld: age}
```

---

## Variables and Let

### Variable References

**Syntax**: `$name`

References a lexical-scope variable bound by a `let` expression. Throws `UndefinedVariableError` if the variable is not in scope. The `$` prefix distinguishes variables from identifiers.

### Let Expressions

**Syntax**: `let $var = expr [, $var2 = expr2, ...] in body` &emsp; **Precedence**: 8

Binds one or more variables and evaluates `body` with those bindings in scope. All binding values are evaluated in the _outer_ scope (not sequentially — earlier bindings are not visible to later ones in the same `let`).

Variables use lexical scoping: inner `let` expressions can shadow outer bindings. `let` and `in` are contextual keywords, not reserved identifiers.

```
let $threshold = settings.min_age in people[?age >= $threshold]
let $x = `1`, $y = `2` in [$x, $y]
```

---

## Function Calls

**Syntax**: `name(arg1, arg2, ...)`

Calls a built-in or registered function. See the [Function Reference](functions.md) for all built-in functions.

Arguments are evaluated before being passed. Function argument types are validated at runtime; type mismatches throw `InvalidArgumentTypeError`.

### Expression References

**Syntax**: `&expr`

Creates an unevaluated reference to an expression. Used as arguments to higher-order functions like `sort_by`, `max_by`, `min_by`, `group_by`, and `map`.

```
sort_by(people, &age)             # sort by age field
map(&to_upper(@), names)          # uppercase each name
```

---

## Extensions

### ID-Based Access (Extension)

`expr['id']` selects the first array element whose `id` property matches the given raw string. Formally equivalent to `expr[?id == 'id'] | [0]`.

This is unambiguous with standard JMESPath because bracket expressions normally only accept numeric indices, not raw strings.

### Bare Numeric Literals (Extension)

Numeric literals can appear without backtick delimiters in expression position. This enables natural arithmetic (`a - 1`, `price > 0`) without requiring `` `1` `` or `` `0` ``.

The parser resolves ambiguity with negative array indices: `-` is always tokenized as an operator, and negative index/slice values are parsed explicitly within bracket grammar. Unary sign on numeric literals is folded at parse time.

---

## Legacy Compatibility

Three parser/evaluation options control backward-compatible behavior:

| Option                   | Scope      | Default | Effect                                                                          |
| ------------------------ | ---------- | ------- | ------------------------------------------------------------------------------- |
| `legacyLiterals`         | Parser     | `false` | Invalid JSON in backticks falls back to string (e.g., `` `foo` `` → `"foo"`)    |
| `legacyRawStringEscapes` | Parser     | `false` | Only `\'` is unescaped in raw strings; `\\` stays literal                       |
| `legacyNullPropagation`  | Evaluation | `false` | Multi-select on `null` context returns `null` instead of evaluating expressions |

Default behavior follows JMESPath Community Edition semantics. Enable these options for compatibility with original JMESPath behavior.
