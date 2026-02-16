# Function Reference

All built-in functions available in LoanCrate JSON Selector expressions. See the [API Reference](api.md#function-system) for registering custom functions.

**Error handling:** All functions validate argument count and types. Calling with the wrong number of arguments throws `InvalidArityError`. Passing an argument of the wrong type throws `InvalidArgumentTypeError`. Calling an undefined function throws `UnknownFunctionError`. Additional function-specific errors are noted in the detailed sections below.

## Summary

### Type Functions

| Function                  | Signature                         | Description                                   |
| ------------------------- | --------------------------------- | --------------------------------------------- |
| [`to_array`](#to_array)   | `to_array(any) → array`           | Wraps a non-array value in an array           |
| [`to_number`](#to_number) | `to_number(any) → number \| null` | Converts a value to a number                  |
| [`to_string`](#to_string) | `to_string(any) → string`         | Converts a value to its string representation |
| [`type`](#type)           | `type(any) → string`              | Returns the type name of a value              |

### String Functions

| Function                      | Signature                                                       | Description                                             |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| [`contains`](#contains)       | `contains(string \| array, any) → boolean`                      | Tests if a value contains a search target               |
| [`ends_with`](#ends_with)     | `ends_with(string, string) → boolean`                           | Tests if a string ends with a suffix                    |
| [`find_first`](#find_first)   | `find_first(string, string, number?, number?) → number \| null` | Finds the first occurrence of a substring               |
| [`find_last`](#find_last)     | `find_last(string, string, number?, number?) → number \| null`  | Finds the last occurrence of a substring                |
| [`join`](#join)               | `join(string, string[]) → string`                               | Joins array elements with a delimiter                   |
| [`length`](#length)           | `length(string \| array \| object) → number`                    | Returns the length of a value                           |
| [`lower`](#lower)             | `lower(string) → string`                                        | Converts a string to lowercase                          |
| [`pad_left`](#pad_left)       | `pad_left(string, number, string?) → string`                    | Pads a string on the left                               |
| [`pad_right`](#pad_right)     | `pad_right(string, number, string?) → string`                   | Pads a string on the right                              |
| [`replace`](#replace)         | `replace(string, string, string, number?) → string`             | Replaces occurrences of a substring                     |
| [`reverse`](#reverse)         | `reverse(string \| array) → string \| array`                    | Reverses a string or array                              |
| [`split`](#split)             | `split(string, string, number?) → string[]`                     | Splits a string by a delimiter                          |
| [`starts_with`](#starts_with) | `starts_with(string, string) → boolean`                         | Tests if a string starts with a prefix                  |
| [`trim`](#trim)               | `trim(string, string?) → string`                                | Trims whitespace or specified characters from both ends |
| [`trim_left`](#trim_left)     | `trim_left(string, string?) → string`                           | Trims from the left end                                 |
| [`trim_right`](#trim_right)   | `trim_right(string, string?) → string`                          | Trims from the right end                                |
| [`upper`](#upper)             | `upper(string) → string`                                        | Converts a string to uppercase                          |

### Math Functions

| Function          | Signature                                              | Description                    |
| ----------------- | ------------------------------------------------------ | ------------------------------ |
| [`abs`](#abs)     | `abs(number) → number`                                 | Absolute value                 |
| [`avg`](#avg)     | `avg(number[]) → number \| null`                       | Average of array elements      |
| [`ceil`](#ceil)   | `ceil(number) → number`                                | Rounds up to nearest integer   |
| [`floor`](#floor) | `floor(number) → number`                               | Rounds down to nearest integer |
| [`max`](#max)     | `max(number[] \| string[]) → number \| string \| null` | Maximum value                  |
| [`min`](#min)     | `min(number[] \| string[]) → number \| string \| null` | Minimum value                  |
| [`sum`](#sum)     | `sum(number[]) → number`                               | Sum of array elements          |

### Array and Object Functions

| Function                    | Signature                            | Description                           |
| --------------------------- | ------------------------------------ | ------------------------------------- |
| [`from_items`](#from_items) | `from_items(array) → object`         | Creates an object from pairs          |
| [`group_by`](#group_by)     | `group_by(array, &expr) → object`    | Groups elements by a key              |
| [`items`](#items)           | `items(object) → array`              | Returns `[key, value]` pairs          |
| [`keys`](#keys)             | `keys(object) → string[]`            | Returns object keys                   |
| [`map`](#map)               | `map(&expr, array) → array`          | Applies an expression to each element |
| [`max_by`](#max_by)         | `max_by(array, &expr) → any`         | Element with maximum key              |
| [`merge`](#merge)           | `merge(...object) → object`          | Merges objects                        |
| [`min_by`](#min_by)         | `min_by(array, &expr) → any`         | Element with minimum key              |
| [`not_null`](#not_null)     | `not_null(...any) → any`             | First non-null argument               |
| [`sort`](#sort)             | `sort(number[] \| string[]) → array` | Sorts an array                        |
| [`sort_by`](#sort_by)       | `sort_by(array, &expr) → array`      | Sorts by an expression key            |
| [`values`](#values)         | `values(object) → array`             | Returns object values                 |
| [`zip`](#zip)               | `zip(...array) → array`              | Transposes arrays into tuples         |

---

## Type Functions

### `to_array`

```
to_array(value: any) → array
```

If `value` is already an array, returns it unchanged. Otherwise, wraps it in a single-element array: `[value]`.

### `to_number`

```
to_number(value: any) → number | null
```

Converts `value` to a number.

- **Numbers** pass through unchanged.
- **Strings** conforming to JSON number syntax are parsed. Empty and whitespace-only strings return `null`. Non-numeric strings return `null`.
- **All other types** return `null`.

### `to_string`

```
to_string(value: any) → string
```

Converts `value` to a string. Strings pass through unchanged. All other types are JSON-serialized (e.g., `to_string(`42`)` returns `"42"`, `to_string(`true`)` returns `"true"`).

### `type`

```
type(value: any) → string
```

Returns the type of `value` as one of: `"array"`, `"boolean"`, `"null"`, `"number"`, `"object"`, `"string"`.

---

## String Functions

### `contains`

```
contains(subject: string | array, search: any) → boolean
```

- **String subject**: returns `true` if `subject` contains `search` as a substring. Both must be strings.
- **Array subject**: returns `true` if any element of `subject` is equal to `search` (reference equality via `includes`).

### `ends_with`

```
ends_with(subject: string, suffix: string) → boolean
```

Returns `true` if `subject` ends with `suffix`.

### `find_first`

```
find_first(subject: string, search: string, start?: number, end?: number) → number | null
```

Returns the index of the first occurrence of `search` within `subject[start:end]`, or `null` if not found.

- `search` of `""` (empty string) always returns `null`.
- `start` defaults to `0`. Negative values count from the end.
- `end` defaults to `subject.length`. Negative values count from the end.
- The returned index is relative to the beginning of `subject`, not to `start`.

Throws `InvalidArgumentValueError` if `start` or `end` is not an integer.

Note: indices are based on UTF-16 code units (JavaScript string positions), not Unicode code points.

### `find_last`

```
find_last(subject: string, search: string, start?: number, end?: number) → number | null
```

Like [`find_first`](#find_first), but returns the index of the _last_ occurrence within the range.

Throws `InvalidArgumentValueError` if `start` or `end` is not an integer.

### `join`

```
join(glue: string, list: string[]) → string
```

Joins all elements of `list` into a single string, separated by `glue`.

Note the parameter order: delimiter first, then array. This matches the JMESPath specification.

### `length`

```
length(subject: string | array | object) → number
```

Returns the length of the subject.

- **Strings**: counts Unicode code points (not UTF-16 code units). A surrogate pair (e.g., an emoji) counts as one.
- **Arrays**: returns `array.length`.
- **Objects**: returns the number of keys.

### `lower`

```
lower(subject: string) → string
```

Converts `subject` to lowercase using the default locale-independent transformation.

### `pad_left`

```
pad_left(subject: string, width: number, pad?: string) → string
```

Pads `subject` on the left to reach `width` characters.

- `pad` defaults to a space character.
- If `subject` is already at least `width` characters, it is returned unchanged.

Throws `InvalidArgumentValueError` if `width` is not a non-negative integer, or if `pad` is not exactly one character long.

### `pad_right`

```
pad_right(subject: string, width: number, pad?: string) → string
```

Like [`pad_left`](#pad_left), but pads on the right.

Throws `InvalidArgumentValueError` if `width` is not a non-negative integer, or if `pad` is not exactly one character long.

### `replace`

```
replace(subject: string, old: string, new: string, count?: number) → string
```

Replaces occurrences of `old` with `new` in `subject`.

- Without `count`: replaces all occurrences.
- With `count`: replaces at most `count` occurrences, left to right.
- `count` of `0` returns the original string unchanged.

Throws `InvalidArgumentValueError` if `count` is not a non-negative integer.

### `reverse`

```
reverse(subject: string | array) → string | array
```

Returns a reversed copy.

- **Strings**: splits into Unicode code points, reverses, and rejoins. Handles surrogate pairs correctly.
- **Arrays**: returns a new array in reverse order (does not mutate the original).

### `split`

```
split(subject: string, delimiter: string, count?: number) → string[]
```

Splits `subject` by `delimiter`.

The optional `count` parameter limits the number of _splits_ performed (not the number of results). The remainder of the string after the last split becomes the final element.

- `split('a,b,c', ',')` returns `["a", "b", "c"]`
- `split('a,b,c', ',', 1)` returns `["a", "b,c"]`
- `split('a,b,c', ',', 0)` returns `["a,b,c"]`

Throws `InvalidArgumentValueError` if `count` is not a non-negative integer.

### `starts_with`

```
starts_with(subject: string, prefix: string) → boolean
```

Returns `true` if `subject` starts with `prefix`.

### `trim`

```
trim(subject: string, chars?: string) → string
```

Removes characters from both ends of `subject`.

- Without `chars`: trims Unicode whitespace (including U+0085 NEXT LINE).
- With `chars`: trims any characters present in the `chars` string.

### `trim_left`

```
trim_left(subject: string, chars?: string) → string
```

Like [`trim`](#trim), but only from the left (start) of the string.

### `trim_right`

```
trim_right(subject: string, chars?: string) → string
```

Like [`trim`](#trim), but only from the right (end) of the string.

### `upper`

```
upper(subject: string) → string
```

Converts `subject` to uppercase using the default locale-independent transformation.

---

## Math Functions

### `abs`

```
abs(value: number) → number
```

Returns the absolute value.

### `avg`

```
avg(list: number[]) → number | null
```

Returns the arithmetic mean. Returns `null` for empty arrays. Divides by `list.length` (the total number of elements).

### `ceil`

```
ceil(value: number) → number
```

Returns the smallest integer greater than or equal to `value`.

### `floor`

```
floor(value: number) → number
```

Returns the largest integer less than or equal to `value`.

### `max`

```
max(list: number[] | string[]) → number | string | null
```

Returns the maximum value from a homogeneous array of numbers or strings. Returns `null` for empty arrays.

String comparison uses Unicode code point ordering.

### `min`

```
min(list: number[] | string[]) → number | string | null
```

Returns the minimum value from a homogeneous array of numbers or strings. Returns `null` for empty arrays.

String comparison uses Unicode code point ordering.

### `sum`

```
sum(list: number[]) → number
```

Returns the sum of all numeric elements. Returns `0` for empty arrays.

---

## Array and Object Functions

### `from_items`

```
from_items(list: array) → object
```

Creates an object from an array of `[key, value]` pairs. Each element must be a two-element array where the first element is a string.

Throws `InvalidArgumentValueError` if any element is not a two-element array or its first element is not a string.

```
from_items([['a', 1], ['b', 2]])   # {"a": 1, "b": 2}
```

### `group_by`

```
group_by(list: array, expref: &expression) → object
```

Groups `list` elements by evaluating `expref` against each element.

- The expression must evaluate to a string or `null` for each element.
- Elements with `null` keys are excluded from the result.
- Returns an object mapping string keys to arrays of matching elements.

Throws `InvalidArgumentTypeError` if the expression evaluates to a non-string, non-null type for any element.

```
group_by(people, &department)   # {"Engineering": [...], "Sales": [...]}
```

### `items`

```
items(obj: object) → array
```

Returns an array of `[key, value]` pairs from the object (equivalent to `Object.entries()`).

### `keys`

```
keys(obj: object) → string[]
```

Returns an array of the object's own enumerable property names.

### `map`

```
map(expref: &expression, list: array) → array
```

Applies `expref` to each element of `list` and returns an array of results.

Note the parameter order: expression reference first, then array. This matches the JMESPath specification.

```
map(&to_upper(@), names)        # uppercase each name
map(&age, people)               # extract age from each person
```

### `max_by`

```
max_by(list: array, expref: &expression) → any
```

Returns the element from `list` with the maximum key value when `expref` is evaluated. Returns `null` for empty arrays.

Throws `InvalidArgumentTypeError` if the expression evaluates to a type other than number or string.

### `merge`

```
merge(...objects: object) → object
```

Merges one or more objects left to right. Later values override earlier ones for duplicate keys.

```
merge({a: 1}, {b: 2}, {a: 3})   # {a: 3, b: 2}
```

Requires at least one argument.

### `min_by`

```
min_by(list: array, expref: &expression) → any
```

Returns the element from `list` with the minimum key value when `expref` is evaluated. Returns `null` for empty arrays.

Throws `InvalidArgumentTypeError` if the expression evaluates to a type other than number or string.

### `not_null`

```
not_null(...args: any) → any
```

Returns the first argument that is not `null` or `undefined`. Returns `null` if all arguments are null.

```
not_null(null, 'hello', null)    # 'hello'
not_null(null, null)             # null
```

Requires at least one argument.

### `sort`

```
sort(list: number[] | string[]) → array
```

Returns a new sorted array. The array must be homogeneous (all numbers or all strings).

- **Numbers**: sorted ascending numerically.
- **Strings**: sorted by Unicode code point comparison (not locale-sensitive).
- Empty arrays return `[]`.

### `sort_by`

```
sort_by(list: array, expref: &expression) → array
```

Sorts `list` by evaluating `expref` against each element. The expression must evaluate to a consistent type across all elements — either all numbers or all strings (nulls are not allowed).

Uses a Schwartzian transform: keys are evaluated once per element, not during comparison.

Throws `InvalidArgumentTypeError` if the expression evaluates to a non-number/non-string type, or if key types are inconsistent across elements.

```
sort_by(people, &age)           # sort by numeric age
sort_by(items, &name)           # sort by string name
```

### `values`

```
values(obj: object) → array
```

Returns an array of the object's own enumerable property values.

### `zip`

```
zip(...lists: array) → array
```

Transposes multiple arrays into an array of tuples. Uses the minimum length among all input arrays.

```
zip([1, 2], ['a', 'b'])         # [[1, 'a'], [2, 'b']]
zip([1, 2, 3], ['a', 'b'])      # [[1, 'a'], [2, 'b']]
```

Returns `[]` if no arguments are provided.
