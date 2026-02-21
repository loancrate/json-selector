# @loancrate/json-selector

## 5.1.0

### Minor Changes

- Add strict accessor variants (getOrThrow, setOrThrow, deleteOrThrow) that throw structured AccessorError instead of silently returning null or ignoring invalid writes

## 5.0.0

### Major Changes

- # Complete JMESPath and JMESPath Community Edition Compliance

  This major release achieves **full compliance with both original JMESPath and JMESPath Community Edition**, expanding from 85.9% (593/690) to 100% standards compliance. The implementation adds 43 built-in functions, multi-select expressions, object projections, let expressions, ternary conditionals, arithmetic operations, and a structured error hierarchy.

  ## Breaking Changes

  ### `parseJsonSelector` signature changed

  `parseJsonSelector` now accepts an optional second `options` parameter (`ParserOptions`). Direct calls are unaffected, but passing `parseJsonSelector` as a callback to higher-order functions will now produce TypeScript errors if extra arguments are passed that aren't assignable to `ParserOptions`.

  ### `evaluateJsonSelector` signature changed

  Was `(selector, context, rootContext?)`. Now has two overloads:
  - `(selector, context, evalCtx?: Partial<EvaluationContext>)` (preferred)
  - `(selector, context, rootContext?, options?)` (deprecated)

  Code passing a `rootContext` that is not an object or does not contain `EvaluationContext` keys (`rootContext`, `functionProvider`, `bindings`, `evaluateNullMultiSelect`) still works via the deprecated overload. Code passing just two args is unaffected.

  ### New error hierarchy

  All library errors now extend `JsonSelectorError` instead of generic `Error`:
  - **Parse errors**: extend `JsonSelectorSyntaxError` with structured `expression` and `offset` fields
  - **Runtime errors**: extend `JsonSelectorRuntimeError`
  - **Type errors**: extend `JsonSelectorTypeError` (e.g. `NotANumberError`, `DivideByZeroError`)
  - **Function errors**: extend `FunctionError` (e.g. `InvalidArityError`, `InvalidArgumentTypeError`)

  Code catching errors by type may need updating.

  ### 10 new AST node types

  The `JsonSelector` discriminated union grew from 16 to 26 types. Exhaustive switches or visitor implementations will need new cases: `arithmetic`, `unaryArithmetic`, `ternary`, `functionCall`, `expressionRef`, `variableRef`, `let`, `multiSelectList`, `multiSelectHash`, `objectProject`.

  ## New Features

  ### JMESPath Community Edition support
  - **Arithmetic expressions**: `+`, `-`, `*`, `/`, `%`, `//` plus Unicode operators (`×`, `÷`, `−`)
  - **Let expressions**: `let $var = expr in expression` with lexical scope
  - **Ternary conditionals**: `condition ? true_expr : false_expr`
  - **String slices**: full JEP-15 support for string slicing operations

  ### Complete function system

  43 built-in JMESPath functions with `FunctionRegistry` and extensible `FunctionProvider`:
  - **Type**: `type()`
  - **String**: `length()`, `reverse()`, `to_string()`, `starts_with()`, `ends_with()`, `contains()`, `join()`, `split()`, `trim()`, `upper()`, `lower()`, `replace()`, `pad_left()`, `pad_right()`, `find_first()`, `find_last()`
  - **Math**: `abs()`, `ceil()`, `floor()`, `sum()`, `avg()`, `min()`, `max()`, `min_by()`, `max_by()`
  - **Array**: `sort()`, `sort_by()`, `keys()`, `values()`, `map()`, `to_array()`, `reverse()`, `merge()`, `zip()`, `from_entries()`, `to_entries()`, `group_by()`, `unique()`, `unique_by()`, `items()`
  - **Object**: `to_object()`, `not_null()`

  ### Multi-select expressions
  - **Multi-select lists**: `[foo, bar]` — select multiple fields into an array
  - **Multi-select hashes**: `{a: foo, b: bar}` — create new objects from selections

  ### Object projections and expression references
  - **Wildcard projections**: `.*` — project over object values
  - **Expression references**: `&expr` — for use with `sort_by()`, `max_by()`, `min_by()`, `group_by()`, `map()`

  ### Parser and evaluation options
  - `ParserOptions` for controlling literal parsing (`strictJsonLiterals`) and raw-string escape behavior (`rawStringBackslashEscape`)
  - `EvaluationContext` for runtime configuration including function provider, variable bindings, and null multi-select behavior

  ## Other Improvements
  - Full JMESPath compliance: 690/690 original tests passing
  - Full JMESPath Community Edition compliance: all fixtures passing
  - Comprehensive reference documentation (language, functions, API, benchmarks)
  - 100% code coverage maintained

## 4.0.0

### Major Changes

- # Major Release: Complete Parser Rewrite

  **This major version bump is primarily due to a complete rewrite of the parser and lexer**, replacing the PEG.js-based implementation with a hand-written Pratt parser and custom lexer. While the public API remains unchanged, the internal implementation is fundamentally different.

  ## Breaking Changes
  - **NOT operator (`!`) precedence**: Changed to match JMESPath specification for proper operator precedence
    - **Old behavior**: `!foo.bar.baz` parsed as `!(foo.bar.baz)` - NOT applied to entire field access chain
    - **New behavior**: `!foo.bar.baz` parsed as `((!foo).bar).baz` - NOT applied only to `foo`, then field access continues
    - **Context**: The new hand-written Pratt parser uses the same architecture as jmespath.js and @jmespath-community/jmespath. Comparison testing with these implementations revealed the precedence incompatibility in the previous PEG.js-based parser.
    - **Migration**: Use parentheses to explicitly control precedence: `!(foo.bar.baz)` for old behavior

  ## Performance: 18x Faster Parsing

  Complete parser rewrite delivering dramatic performance improvements:
  - **Real-world operations**: 12-20x faster (91-95% reduction in parse time)
  - **Overall average**: ~18x faster across all test cases
  - **Benchmark results**: 77/77 test cases show improvement, ranging from 73-98% faster

  **Technical implementation**:
  - Hand-written Pratt parser (precedence-climbing) with binding power control
  - Custom hand-written lexer using character-code comparisons for tokenization

  ## Infrastructure & Tooling
  - **Automated Releases**: Set up changesets for automated version management and npm publishing with NPM Trusted Publishing (OIDC) and provenance attestation
  - **GitHub Actions**: Migrated CI/CD to GitHub Actions with automated testing and release workflows
  - **Contributing Guide**: Added comprehensive CONTRIBUTING.md with development guidelines and release process documentation
  - **Node.js 22**: Upgraded to Node.js 22 for latest features and performance improvements

  ## Bug Fixes
  - **Jest Compatibility**: Fixed package exports configuration for proper Jest compatibility
  - **TypeScript Configuration**: Fixed TypeScript and ESLint configuration for better type safety and linting

  ## Development Experience
  - **Enhanced Benchmarking**: Improved benchmarking suite with support for multiple JMESPath libraries (jmespath.js, @jmespath-community/jmespath)
    - CLI options for library selection, JSON output, result comparison
    - Comprehensive test coverage across 81 test cases
    - Statistical analysis with percentiles (p50, p95, p99)
    - Regression detection with configurable thresholds

  ## Testing
  - Current status: 593/690 JMESPath compliance tests passing (85.9%)
  - 100% code coverage maintained
  - 964 total tests passing

  This release represents a significant milestone in project maturity with professional release automation, substantial performance improvements, and enhanced developer tooling.
