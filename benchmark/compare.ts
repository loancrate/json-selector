/* eslint-disable no-console */

import { readFileSync } from "fs";
import type { BenchmarkRun, ComparisonResult } from "./types";
import { formatMicroseconds } from "./format";

export function loadBenchmarkRun(path: string): BenchmarkRun {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as BenchmarkRun;
}

export function compareRuns(
  baseline: BenchmarkRun,
  current: BenchmarkRun,
  threshold: number,
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  // Create a map of baseline results by name for quick lookup
  const baselineMap = new Map(baseline.results.map((r) => [r.name, r.avgNs]));

  for (const currentResult of current.results) {
    const baselineAvgNs = baselineMap.get(currentResult.name);

    if (baselineAvgNs === undefined) {
      // Test exists in current but not baseline - treat as new test
      results.push({
        name: currentResult.name,
        expression: currentResult.expression,
        baselineAvgNs: 0,
        currentAvgNs: currentResult.avgNs,
        changePercent: 0,
        status: "ok",
      });
      continue;
    }

    const changePercent =
      ((currentResult.avgNs - baselineAvgNs) / baselineAvgNs) * 100;

    let status: "ok" | "faster" | "slower" = "ok";
    if (changePercent < -threshold) {
      status = "faster";
    } else if (changePercent > threshold) {
      status = "slower";
    }

    results.push({
      name: currentResult.name,
      expression: currentResult.expression,
      baselineAvgNs,
      currentAvgNs: currentResult.avgNs,
      changePercent,
      status,
    });
  }

  return results;
}

export function printComparison(
  baseline: BenchmarkRun,
  current: BenchmarkRun,
  results: ComparisonResult[],
): void {
  console.log("\nBenchmark Comparison");
  console.log(
    `Baseline: ${baseline.metadata.timestamp.split("T")[0]}, ${baseline.metadata.gitCommit.slice(0, 7)} (${baseline.metadata.gitBranch})`,
  );
  console.log(
    `Current:  ${current.metadata.timestamp.split("T")[0]}, ${current.metadata.gitCommit.slice(0, 7)} (${current.metadata.gitBranch})`,
  );
  console.log();

  // Calculate column widths
  const nameWidth = Math.max(25, ...results.map((r) => r.name.length));

  // Print header
  const header = [
    "Name".padEnd(nameWidth),
    "Base (μs)".padStart(10),
    "Curr (μs)".padStart(10),
    "Change".padStart(10),
    "Status",
  ].join(" │ ");
  console.log(header);
  console.log("─".repeat(nameWidth + 10 + 10 + 10 + 20));

  // Print results
  for (const result of results) {
    const changeStr =
      result.baselineAvgNs === 0
        ? "NEW"
        : (result.changePercent >= 0 ? "+" : "") +
          result.changePercent.toFixed(1) +
          "%";

    const statusStr =
      result.status === "faster"
        ? "FASTER"
        : result.status === "slower"
          ? "SLOWER"
          : "";

    const row = [
      result.name.padEnd(nameWidth),
      (result.baselineAvgNs === 0
        ? "-"
        : formatMicroseconds(result.baselineAvgNs)
      ).padStart(10),
      formatMicroseconds(result.currentAvgNs).padStart(10),
      changeStr.padStart(10),
      statusStr,
    ].join(" │ ");
    console.log(row);
  }

  // Print summary
  const okCount = results.filter((r) => r.status === "ok").length;
  const fasterCount = results.filter((r) => r.status === "faster").length;
  const slowerCount = results.filter((r) => r.status === "slower").length;

  console.log();
  console.log(
    `Summary: ${okCount} ok, ${fasterCount} faster, ${slowerCount} slower`,
  );
  console.log();
}
