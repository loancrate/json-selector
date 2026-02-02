/* eslint-disable no-console */

import { writeFileSync } from "fs";
import { parseArgs } from "util";
import { getCompatibleCases } from "./cases";
import { compareRuns, loadBenchmarkRun, printComparison } from "./compare";
import { printResults, printSummary, toJSON } from "./format";
import { getLibraryDisplayName, getParser } from "./parsers";
import { collectMetadata, runBenchmark } from "./run";
import {
  isValidLibrary,
  LIBRARY_IDS,
  type BenchmarkConfig,
  type BenchmarkRun,
} from "./types";

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
  npm run benchmark -- --library jmespath        Benchmark a specific library
  npm run benchmark -- --help                    Show this help

Options:
  --output <file>       Save results to JSON file
  --json                Output results as JSON to stdout (no console tables)
  --compare <a> <b>     Compare two JSON result files (baseline vs current)
  --threshold <n>       Regression threshold percentage (default: 10)
  --library <name>      Library to benchmark (default: json-selector)
                        Options: json-selector, jmespath, typescript-jmespath
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
      library: { type: "string", default: "json-selector" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  // Validate library choice
  if (!isValidLibrary(values.library)) {
    console.error(`Error: Invalid library: ${values.library}`);
    console.error(`Valid options: ${LIBRARY_IDS.join(", ")}`);
    process.exit(1);
  }

  const library = values.library;

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

  const parser = getParser(library);
  const libraryDisplayName = getLibraryDisplayName(library);

  if (!values.json) {
    console.log(
      `\nJSON Selector Parsing Performance Benchmark [${libraryDisplayName}]`,
    );
    console.log(
      `Warmup: ${WARMUP_ITERATIONS} iterations | Measured: ${ITERATIONS} iterations\n`,
    );
  }

  const cases = getCompatibleCases(library);
  const metadata = collectMetadata(library);

  const isolatedResults = runBenchmark(cases.isolated, config, parser);
  const scalingResults = runBenchmark(cases.scaling, config, parser);
  const realWorldResults = runBenchmark(cases.realWorld, config, parser);
  const stressResults = runBenchmark(cases.stress, config, parser);

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
  printResults(
    "1. ISOLATED NODE TYPE BENCHMARKS",
    isolatedResults,
    libraryDisplayName,
  );
  printResults(
    "2. COMPLEXITY SCALING BENCHMARKS",
    scalingResults,
    libraryDisplayName,
  );
  printResults(
    "3. REAL-WORLD EXPRESSION BENCHMARKS",
    realWorldResults,
    libraryDisplayName,
  );
  printResults("4. STRESS TEST BENCHMARKS", stressResults, libraryDisplayName);
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
