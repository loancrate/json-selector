/* eslint-disable no-console */

import type {
  BenchmarkResult,
  BenchmarkRun,
  CategorizedResults,
} from "./types";

// Prefixes that identify isolated node type benchmarks
const ISOLATED_PREFIXES = [
  "primitive:",
  "access:",
  "collection:",
  "logical:",
  "syntax:",
  "composition:",
];

export function formatMicroseconds(ns: number): string {
  const us = ns / 1000; // Convert nanoseconds to microseconds
  if (us < 1) {
    return us.toFixed(4);
  } else if (us < 10) {
    return us.toFixed(3);
  } else if (us < 100) {
    return us.toFixed(2);
  } else {
    return us.toFixed(1);
  }
}

export function formatOpsPerSec(ops: number): string {
  return ops.toLocaleString("en-US");
}

export interface PrintOptions {
  compact?: boolean;
}

function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + "…";
}

function getColumnWidths(
  results: BenchmarkResult[],
  compact: boolean,
): { nameWidth: number; exprWidth: number } {
  return {
    nameWidth: compact
      ? 30
      : Math.max(25, ...results.map((r) => r.name.length)),
    exprWidth: compact
      ? 40
      : Math.max(35, ...results.map((r) => r.expression.length)),
  };
}

export function printResults(
  title: string,
  results: BenchmarkResult[],
  library?: string,
  options: PrintOptions = {},
): void {
  const { compact = false } = options;
  const sectionTitle = library ? `${title} [${library}]` : title;
  const { nameWidth, exprWidth } = getColumnWidths(results, compact);

  // Build columns based on mode
  const buildHeader = (): string[] => {
    const cols = [
      "Name".padEnd(nameWidth),
      "Expression".padEnd(exprWidth),
      "Avg (μs)".padStart(10),
    ];
    if (!compact) {
      cols.push("StdDev".padStart(10), "Min (μs)".padStart(10));
    }
    cols.push("p99 (μs)".padStart(10), "Ops/sec".padStart(12));
    return cols;
  };

  const buildRow = (result: BenchmarkResult): string[] => {
    const cols = [
      truncate(result.name, nameWidth).padEnd(nameWidth),
      truncate(result.expression, exprWidth).padEnd(exprWidth),
      formatMicroseconds(result.avgNs).padStart(10),
    ];
    if (!compact) {
      cols.push(
        formatMicroseconds(result.stdDev).padStart(10),
        formatMicroseconds(result.minNs).padStart(10),
      );
    }
    cols.push(
      formatMicroseconds(result.p99).padStart(10),
      formatOpsPerSec(result.opsPerSec).padStart(12),
    );
    return cols;
  };

  const header = buildHeader().join(" │ ");
  const lineWidth = header.length;

  console.log("\n" + "=".repeat(lineWidth));
  console.log(sectionTitle);
  console.log("=".repeat(lineWidth));
  console.log(header);
  console.log("─".repeat(lineWidth));

  for (const result of results) {
    console.log(buildRow(result).join(" │ "));
  }
  console.log();
}

export function printSummary(
  isolatedResults: BenchmarkResult[],
  scalingResults: BenchmarkResult[],
  realWorldResults: BenchmarkResult[],
  stressResults: BenchmarkResult[],
  options: PrintOptions = {},
): void {
  const { compact = false } = options;
  const allResults = [
    ...isolatedResults,
    ...scalingResults,
    ...realWorldResults,
    ...stressResults,
  ];

  // Compact: fixed 114 chars (matches table). Full: capped at 140 chars.
  const lineWidth = compact ? 114 : 140;

  console.log("=".repeat(lineWidth));
  console.log("SUMMARY");
  console.log("=".repeat(lineWidth));
  console.log(`Total expressions tested: ${allResults.length}`);
  console.log();

  // Percentile distribution for all tests
  const allP50s = allResults.map((r) => r.p50).sort((a, b) => a - b);
  const allP95s = allResults.map((r) => r.p95).sort((a, b) => a - b);
  const allP99s = allResults.map((r) => r.p99).sort((a, b) => a - b);
  console.log("Percentile distribution across all tests:");
  console.log(
    `  Median (p50): ${formatMicroseconds(allP50s[Math.floor(allP50s.length / 2)])} μs`,
  );
  console.log(
    `  p95:          ${formatMicroseconds(allP95s[Math.floor(allP95s.length * 0.95)])} μs`,
  );
  console.log(
    `  p99:          ${formatMicroseconds(allP99s[Math.floor(allP99s.length * 0.99)])} μs`,
  );
  console.log();

  // Slowest isolated node types
  const sortedIsolated = [...isolatedResults].sort((a, b) => b.avgNs - a.avgNs);
  console.log("Slowest isolated node types:");
  for (let i = 0; i < Math.min(5, sortedIsolated.length); i++) {
    const r = sortedIsolated[i];
    console.log(
      `  ${i + 1}. ${r.name.padEnd(30)} ${formatMicroseconds(r.avgNs).padStart(8)} μs - ${r.expression}`,
    );
  }
  console.log();

  // Scaling efficiency (ops/sec per unit of complexity)
  console.log("Scaling characteristics:");
  const fieldScaling = [
    {
      depth: 1,
      result: scalingResults.find((r) => r.name === "scale: field depth 1"),
    },
    {
      depth: 50,
      result: scalingResults.find((r) => r.name === "scale: field depth 50"),
    },
  ];
  if (fieldScaling[0].result && fieldScaling[1].result) {
    const ratio = fieldScaling[1].result.avgNs / fieldScaling[0].result.avgNs;
    const normalized = ratio / 50; // Compare to input scale
    console.log(
      `  Field access: 50x depth = ${ratio.toFixed(1)}x slower (${normalized < 0.9 ? "sub-linear" : normalized < 1.1 ? "~linear" : "super-linear"})`,
    );
  }

  const pipeScaling = [
    {
      len: 1,
      result: scalingResults.find((r) => r.name === "scale: pipe length 1"),
    },
    {
      len: 50,
      result: scalingResults.find((r) => r.name === "scale: pipe length 50"),
    },
  ];
  if (pipeScaling[0].result && pipeScaling[1].result) {
    const ratio = pipeScaling[1].result.avgNs / pipeScaling[0].result.avgNs;
    const normalized = ratio / 50; // Compare to input scale
    console.log(
      `  Pipe chains:  50x length = ${ratio.toFixed(1)}x slower (${normalized < 0.9 ? "sub-linear" : normalized < 1.1 ? "~linear" : "super-linear"})`,
    );
  }

  const projScaling = [
    {
      depth: 1,
      result: scalingResults.find(
        (r) => r.name === "scale: projection depth 1",
      ),
    },
    {
      depth: 25,
      result: scalingResults.find(
        (r) => r.name === "scale: projection depth 25",
      ),
    },
  ];
  if (projScaling[0].result && projScaling[1].result) {
    const ratio = projScaling[1].result.avgNs / projScaling[0].result.avgNs;
    const normalized = ratio / 25; // Compare to input scale
    console.log(
      `  Projections:  25x depth = ${ratio.toFixed(1)}x slower (${normalized < 0.9 ? "sub-linear" : normalized < 1.1 ? "~linear" : "super-linear"})`,
    );
  }
  console.log();

  // Real-world performance
  const avgRealWorld =
    realWorldResults.reduce((sum, r) => sum + r.avgNs, 0) /
    realWorldResults.length;
  const slowestRealWorld = realWorldResults.reduce((max, r) =>
    r.avgNs > max.avgNs ? r : max,
  );
  console.log("Real-world expressions:");
  console.log(
    `  Average: ${formatMicroseconds(avgRealWorld)} μs (${Math.round(1_000_000_000 / avgRealWorld).toLocaleString()} ops/sec)`,
  );
  console.log(
    `  Slowest: ${slowestRealWorld.name} - ${formatMicroseconds(slowestRealWorld.avgNs)} μs`,
  );
  console.log();
}

export function toJSON(run: BenchmarkRun): string {
  return JSON.stringify(run, null, 2);
}

export function categorizeResults(
  results: BenchmarkResult[],
): CategorizedResults {
  const isolated: BenchmarkResult[] = [];
  const scaling: BenchmarkResult[] = [];
  const realWorld: BenchmarkResult[] = [];
  const stress: BenchmarkResult[] = [];

  for (const result of results) {
    if (result.name.startsWith("scale:")) {
      scaling.push(result);
    } else if (result.name.startsWith("real:")) {
      realWorld.push(result);
    } else if (result.name.startsWith("stress:")) {
      stress.push(result);
    } else if (ISOLATED_PREFIXES.some((p) => result.name.startsWith(p))) {
      isolated.push(result);
    } else {
      // Unknown category - put in isolated as fallback
      isolated.push(result);
    }
  }

  return { isolated, scaling, realWorld, stress };
}

export function printAllResults(
  results: CategorizedResults,
  library: string,
  options: PrintOptions,
): void {
  const { isolated, scaling, realWorld, stress } = results;
  printResults("1. ISOLATED NODE TYPE BENCHMARKS", isolated, library, options);
  printResults("2. COMPLEXITY SCALING BENCHMARKS", scaling, library, options);
  printResults(
    "3. REAL-WORLD EXPRESSION BENCHMARKS",
    realWorld,
    library,
    options,
  );
  printResults("4. STRESS TEST BENCHMARKS", stress, library, options);
  printSummary(isolated, scaling, realWorld, stress, options);
}
