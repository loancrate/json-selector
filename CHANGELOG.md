# @loancrate/json-selector

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
