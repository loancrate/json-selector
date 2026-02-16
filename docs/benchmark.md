# Benchmark CLI

The benchmark tool measures parsing performance and compares results across JMESPath implementations.

## Quick Start

```bash
npm run benchmark
```

Runs the full benchmark suite using json-selector and prints a formatted results table.

## Options

| Flag           | Type      | Default         | Description                                                                 |
| -------------- | --------- | --------------- | --------------------------------------------------------------------------- |
| `--library`    | `string`  | `json-selector` | Library to benchmark: `json-selector`, `jmespath`, or `typescript-jmespath` |
| `--iterations` | `number`  | `10000`         | Number of measured iterations per test case                                 |
| `--warmup`     | `number`  | `1000`          | Warmup iterations before measurement (JIT warm-up)                          |
| `--runs`       | `number`  | `3`             | Independent measurement runs; the best run is kept                          |
| `--compact`    | `boolean` | `false`         | Compact output: truncate long expressions, omit StdDev/Min columns          |
| `--output`     | `string`  | —               | Save results to a JSON file                                                 |
| `--json`       | `boolean` | `false`         | Output results as JSON to stdout (no tables)                                |
| `--show`       | `string`  | —               | Load and display a saved JSON results file                                  |
| `--compare`    | `boolean` | `false`         | Compare two saved result files (requires two positional arguments)          |
| `--threshold`  | `number`  | `10`            | Regression threshold percentage for `--compare`                             |

## Library Comparison

Three JMESPath implementations can be benchmarked:

| Library               | Package                        | Notes                                                                                |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `json-selector`       | `@loancrate/json-selector`     | Full feature set including extensions                                                |
| `jmespath`            | `jmespath`                     | Original jmespath.js; excludes root node (`$`), ID access (`['id']`), and arithmetic |
| `typescript-jmespath` | `@jmespath-community/jmespath` | Community fork; excludes ID access (`['id']`)                                        |

Test cases incompatible with a library are automatically skipped.

```bash
npm run benchmark -- --library jmespath
npm run benchmark -- --library typescript-jmespath
```

## Saving and Comparing Results

Save a baseline:

```bash
npm run benchmark -- --output baseline.json
```

Save a current run and compare:

```bash
npm run benchmark -- --output current.json
npm run benchmark -- --compare baseline.json current.json
```

The comparison table shows each test case with baseline time, current time, percentage change, and a status flag (`FASTER`, `SLOWER`, or blank for within threshold).

Display saved results without re-running:

```bash
npm run benchmark -- --show baseline.json
```

## Tuning

For more stable results, increase iterations and runs:

```bash
npm run benchmark -- --iterations 50000 --runs 5
```

For quick spot-checks, use lower values and compact output:

```bash
npm run benchmark -- --iterations 1000 --runs 1 --compact
```

## Output Metrics

Each test case reports:

| Metric  | Description                        |
| ------- | ---------------------------------- |
| Avg     | Mean time per parse (microseconds) |
| StdDev  | Standard deviation                 |
| Min     | Fastest single parse               |
| p99     | 99th percentile                    |
| Ops/sec | Operations per second              |

A summary section follows the table with overall percentile distribution, the slowest test cases, and scaling characteristics.
