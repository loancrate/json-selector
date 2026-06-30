---
"@loancrate/json-selector": major
---

Drop support for Node.js < 22 and target Node 24.18.0 for development and CI.

BREAKING CHANGE: `engines.node` is now `>=22.0.0` (was `>=18.0.0`). Node 18 (EOL April 2025) and Node 20 (EOL April 2026) are past end-of-life. Consumers on those runtimes — especially with strict engine enforcement — must upgrade to Node 22 or later. The published code is unchanged in behavior and still compiles to ES2022.

- `.nvmrc` and the GitHub Actions release workflow now pin Node 24.18.0; CI continues to run downlevel tests against Node 22.
- Bumped `@types/node` to the v24 line and the TypeScript `target` to es2022.
