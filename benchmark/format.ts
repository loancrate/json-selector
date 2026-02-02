/* eslint-disable no-console */

import type { BenchmarkResult, BenchmarkRun } from "./types";

export function formatNumber(num: number): string {
  if (num < 0.01) {
    return num.toFixed(6);
  } else if (num < 1) {
    return num.toFixed(4);
  } else {
    return num.toFixed(2);
  }
}

export function formatOpsPerSec(ops: number): string {
  return ops.toLocaleString("en-US");
}

export function printResults(
  title: string,
  results: BenchmarkResult[],
  library?: string,
): void {
  const sectionTitle = library ? `${title} [${library}]` : title;
  console.log("\n" + "=".repeat(140));
  console.log(sectionTitle);
  console.log("=".repeat(140));

  // Calculate column widths
  const nameWidth = Math.max(25, ...results.map((r) => r.name.length));
  const exprWidth = Math.max(35, ...results.map((r) => r.expression.length));

  // Print header
  const header = [
    "Name".padEnd(nameWidth),
    "Expression".padEnd(exprWidth),
    "Avg (ms)".padStart(10),
    "StdDev".padStart(10),
    "Min (ms)".padStart(10),
    "Max (ms)".padStart(10),
    "Ops/sec".padStart(12),
  ].join(" │ ");
  console.log(header);
  console.log("─".repeat(140));

  // Print results
  for (const result of results) {
    const row = [
      result.name.padEnd(nameWidth),
      result.expression.slice(0, exprWidth).padEnd(exprWidth),
      formatNumber(result.avgMs).padStart(10),
      formatNumber(result.stdDev).padStart(10),
      formatNumber(result.minMs).padStart(10),
      formatNumber(result.maxMs).padStart(10),
      formatOpsPerSec(result.opsPerSec).padStart(12),
    ].join(" │ ");
    console.log(row);
  }
  console.log();
}

export function printSummary(
  isolatedResults: BenchmarkResult[],
  scalingResults: BenchmarkResult[],
  realWorldResults: BenchmarkResult[],
  stressResults: BenchmarkResult[],
): void {
  console.log("=".repeat(140));
  console.log("SUMMARY");
  console.log("=".repeat(140));
  console.log(
    `Total expressions tested: ${isolatedResults.length + scalingResults.length + realWorldResults.length + stressResults.length}`,
  );
  console.log();

  // Percentile distribution for all tests
  const allResults = [
    ...isolatedResults,
    ...scalingResults,
    ...realWorldResults,
    ...stressResults,
  ];
  const allP50s = allResults.map((r) => r.p50).sort((a, b) => a - b);
  const allP95s = allResults.map((r) => r.p95).sort((a, b) => a - b);
  const allP99s = allResults.map((r) => r.p99).sort((a, b) => a - b);
  console.log("Percentile distribution across all tests:");
  console.log(
    `  Median (p50): ${formatNumber(allP50s[Math.floor(allP50s.length / 2)])} ms`,
  );
  console.log(
    `  p95:          ${formatNumber(allP95s[Math.floor(allP95s.length * 0.95)])} ms`,
  );
  console.log(
    `  p99:          ${formatNumber(allP99s[Math.floor(allP99s.length * 0.99)])} ms`,
  );
  console.log();

  // Slowest isolated node types
  const sortedIsolated = [...isolatedResults].sort((a, b) => b.avgMs - a.avgMs);
  console.log("Slowest isolated node types:");
  for (let i = 0; i < Math.min(5, sortedIsolated.length); i++) {
    const r = sortedIsolated[i];
    console.log(
      `  ${i + 1}. ${r.name.padEnd(30)} ${formatNumber(r.avgMs).padStart(8)} ms - ${r.expression}`,
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
    const ratio = fieldScaling[1].result.avgMs / fieldScaling[0].result.avgMs;
    console.log(
      `  Field access: 50x depth = ${ratio.toFixed(1)}x slower (${ratio < 5 ? "sub-linear" : ratio < 60 ? "~linear" : "super-linear"})`,
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
    const ratio = pipeScaling[1].result.avgMs / pipeScaling[0].result.avgMs;
    console.log(
      `  Pipe chains:  50x length = ${ratio.toFixed(1)}x slower (${ratio < 60 ? "sub-linear" : ratio < 75 ? "~linear" : "super-linear"})`,
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
    const ratio = projScaling[1].result.avgMs / projScaling[0].result.avgMs;
    console.log(
      `  Projections:  25x depth = ${ratio.toFixed(1)}x slower (${ratio < 30 ? "sub-linear" : ratio < 40 ? "~linear" : "super-linear"})`,
    );
  }
  console.log();

  // Real-world performance
  const avgRealWorld =
    realWorldResults.reduce((sum, r) => sum + r.avgMs, 0) /
    realWorldResults.length;
  const slowestRealWorld = realWorldResults.reduce((max, r) =>
    r.avgMs > max.avgMs ? r : max,
  );
  console.log("Real-world expressions:");
  console.log(
    `  Average: ${formatNumber(avgRealWorld)} ms (${Math.round(1000 / avgRealWorld).toLocaleString()} ops/sec)`,
  );
  console.log(
    `  Slowest: ${slowestRealWorld.name} - ${formatNumber(slowestRealWorld.avgMs)} ms`,
  );
  console.log();
}

export function toJSON(run: BenchmarkRun): string {
  return JSON.stringify(run, null, 2);
}
