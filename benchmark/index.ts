/* eslint-disable no-console */

import { parseArgs } from "util";
import { writeFileSync } from "fs";
import { getAllCases } from "./cases";
import { collectMetadata, runBenchmark } from "./run";
import { printResults, printSummary, toJSON } from "./format";
import { compareRuns, loadBenchmarkRun, printComparison } from "./compare";
import type { BenchmarkConfig, BenchmarkRun } from "./types";

const WARMUP_ITERATIONS = 1000;
const ITERATIONS = 10000;
const DEFAULT_THRESHOLD = 10;

function printHelp(): void {
  console.log(`
JSON Selector Parsing Performance Benchmark

Usage:
  npm run benchmark                              Run and print results
  npm run benchmark -- --output results.json     Run and save to JSON file
  npm run benchmark -- --json                    Print JSON to stdout
  npm run benchmark -- --compare a.json b.json   Compare two result files
  npm run benchmark -- --threshold 15            Set regression threshold (default: 10%)
  npm run benchmark -- --help                    Show this help

Options:
  --output <file>       Save results to JSON file
  --json                Output results as JSON to stdout (no console tables)
  --compare <a> <b>     Compare two JSON result files (baseline vs current)
  --threshold <n>       Regression threshold percentage (default: 10)
  --help                Show this help message
`);
}

function main(): void {
  const { values, positionals } = parseArgs({
    options: {
      output: { type: "string" },
      json: { type: "boolean", default: false },
      compare: { type: "boolean", default: false },
      threshold: { type: "string" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  // Compare mode
  if (values.compare) {
    if (positionals.length !== 2) {
      console.error("Error: --compare requires exactly 2 file paths");
      console.error(
        "Usage: npm run benchmark -- --compare baseline.json current.json",
      );
      process.exit(1);
    }

    const threshold = values.threshold
      ? parseFloat(values.threshold)
      : DEFAULT_THRESHOLD;
    const baseline = loadBenchmarkRun(positionals[0]);
    const current = loadBenchmarkRun(positionals[1]);
    const results = compareRuns(baseline, current, threshold);
    printComparison(baseline, current, results);
    return;
  }

  // Run mode
  const config: BenchmarkConfig = {
    warmupIterations: WARMUP_ITERATIONS,
    iterations: ITERATIONS,
  };

  if (!values.json) {
    console.log("\nJSON Selector Parsing Performance Benchmark");
    console.log(
      `Warmup: ${WARMUP_ITERATIONS} iterations | Measured: ${ITERATIONS} iterations\n`,
    );
  }

  const cases = getAllCases();
  const metadata = collectMetadata();

  const isolatedResults = runBenchmark(cases.isolated, config);
  const scalingResults = runBenchmark(cases.scaling, config);
  const realWorldResults = runBenchmark(cases.realWorld, config);
  const stressResults = runBenchmark(cases.stress, config);

  const benchmarkRun: BenchmarkRun = {
    metadata,
    config,
    results: [
      ...isolatedResults,
      ...scalingResults,
      ...realWorldResults,
      ...stressResults,
    ],
  };

  // JSON output mode
  if (values.json) {
    console.log(toJSON(benchmarkRun));
    return;
  }

  // Table output mode
  printResults("1. ISOLATED NODE TYPE BENCHMARKS", isolatedResults);
  printResults("2. COMPLEXITY SCALING BENCHMARKS", scalingResults);
  printResults("3. REAL-WORLD EXPRESSION BENCHMARKS", realWorldResults);
  printResults("4. STRESS TEST BENCHMARKS", stressResults);
  printSummary(
    isolatedResults,
    scalingResults,
    realWorldResults,
    stressResults,
  );

  // Save to file if requested
  if (values.output) {
    writeFileSync(values.output, toJSON(benchmarkRun), "utf-8");
    console.log(`Results saved to ${values.output}`);
  }
}

main();
