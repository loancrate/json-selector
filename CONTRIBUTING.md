# Contributing to json-selector

Thank you for your interest in contributing to json-selector! This document provides guidelines and instructions for contributing to the project.

## Prerequisites

- Node.js 22.0.0 or higher
- npm (comes with Node.js)
- Git

## Getting Started

1. **Fork and Clone**

   Fork the repository on GitHub and clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/json-selector.git
   cd json-selector
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Build the Project**

   ```bash
   npm run build
   ```

4. **Run Tests**

   ```bash
   npm test
   ```

## Development Workflow

### Project Structure

- `src/` - TypeScript source code
  - `lexer.ts` - Hand-written lexer for tokenization
  - `parser.ts` - Hand-written Pratt parser
  - `ast.ts` - AST node type definitions
  - `evaluate.ts` - Selector evaluation logic
  - `evaluation-context.ts` - Shared evaluation context type and compatibility options
  - `access.ts` - Read/write/delete accessors
  - `format.ts` - AST formatting back to selector strings
  - `visitor.ts` - Visitor pattern for AST traversal
- `test/` - Jest test files
- `benchmark/` - Performance benchmarking tools
- `dist/` - Built output (UMD and ESM bundles)

### Available Scripts

- `npm run build` - Build the project (UMD and ESM bundles)
- `npm test` - Run all tests with coverage
- `npm run test:ci` - Run tests in CI mode (sequential)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run benchmark` - Run performance benchmarks
- `npm run changeset` - Create a changeset for your changes

### Making Changes

1. **Create a Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clear, readable code following existing patterns
   - Add tests for new functionality
   - Update documentation as needed
   - Follow the project's code style (enforced by ESLint and Prettier)

3. **Run Tests and Linting**

   ```bash
   npm test
   npm run lint
   ```

4. **Create a Changeset**

   Before committing, create a changeset describing your changes:

   ```bash
   npm run changeset
   ```

   This will prompt you to:
   - Select the type of change (patch, minor, major)
   - Write a summary of the changes

   Commit the generated changeset file along with your changes.

## Code Standards

### TypeScript

- Use TypeScript strict mode (enabled in `tsconfig.json`)
- Prefer type safety over convenience
- Use discriminated unions for AST nodes
- Avoid `any` type unless absolutely necessary

### ESLint

- **CRITICAL**: Avoid suppressing ESLint errors with `eslint-disable` comments unless absolutely necessary
- When you must suppress an error (e.g., for safe type assertions), add a comment explaining why it's safe
- Run `npm run lint` before committing

### Testing

- Write tests for all new functionality
- Maintain 100% code coverage for statements, branches, functions, and lines
- Use descriptive test names
- Test edge cases and error conditions
- Keep standards fixtures passing: `test/jmespath/*` (core) and `test/jmespath-community/*` (community)

### Performance

- The parser is performance-critical - avoid changes that significantly degrade performance
- Run benchmarks (`npm run benchmark`) for parser changes
- The hand-written Pratt parser and lexer are optimized for speed

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management and releases.

### For Contributors

1. **Create a changeset** when making changes:

   ```bash
   npm run changeset
   ```

2. **Choose the change type**:
   - **patch** (0.0.x) - Bug fixes, documentation updates
   - **minor** (0.x.0) - New features, backward-compatible changes
   - **major** (x.0.0) - Breaking changes

3. **Write a clear summary** - This will appear in the changelog

4. **Commit the changeset** along with your changes

### For Maintainers

Releases are automated via GitHub Actions using NPM Trusted Publishing (OIDC):

1. **Merge PRs with changesets** to the `master` branch

2. **Changesets action** automatically:
   - Creates/updates a "Version Packages" PR with version bumps and changelog
   - When the "Version Packages" PR is merged, publishes to npm with provenance

Manual release (if needed):

```bash
npm run version-packages  # Bump versions and update changelog
npm run release           # Publish to npm
```

## Pull Request Guidelines

1. **Keep PRs focused** - One feature or fix per PR
2. **Write clear descriptions** - Explain what changes and why
3. **Include tests** - Ensure tests pass and coverage is maintained
4. **Add a changeset** - Required for all PRs that should trigger a release
5. **Update documentation** - Update README.md, CLAUDE.md, or other docs as needed
6. **Follow code style** - ESLint and Prettier must pass

## Getting Help

- Open an issue for bug reports or feature requests
- Check existing issues before creating a new one
- Be respectful and constructive in discussions

## License

By contributing to json-selector, you agree that your contributions will be licensed under the ISC License.
