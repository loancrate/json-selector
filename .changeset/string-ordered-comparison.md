---
"@loancrate/json-selector": minor
---

Support string operands in ordered comparison operators (`<`, `<=`, `>`, `>=`).

Previously these operators only compared two numbers and returned `null` for any other operand types. They now also compare two strings lexicographically (by Unicode code point). Mixed number/string operands and non-orderable types (`null`, boolean, array, object) continue to yield `null`.
