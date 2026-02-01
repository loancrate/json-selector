import { execSync } from "child_process";
import { parseJsonSelector } from "../src";
import type {
  BenchmarkCase,
  BenchmarkConfig,
  BenchmarkMetadata,
  BenchmarkResult,
} from "./types";

export function calculateStdDev(times: number[], avg: number): number {
  const variance =
    times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) /
    times.length;
  return Math.sqrt(variance);
}

export function calculatePercentile(sortedTimes: number[], p: number): number {
  const index = Math.ceil((p / 100) * sortedTimes.length) - 1;
  return sortedTimes[index];
}

export function collectMetadata(): BenchmarkMetadata {
  let gitCommit = "unknown";
  let gitBranch = "unknown";

  try {
    gitCommit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    // Git not available or not a git repo
  }

  try {
    gitBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    // Git not available or not a git repo
  }

  return {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    gitCommit,
    gitBranch,
  };
}

export function runBenchmark(
  cases: BenchmarkCase[],
  config: BenchmarkConfig,
): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  for (const { name, expression } of cases) {
    // Warmup phase
    for (let i = 0; i < config.warmupIterations; i++) {
      parseJsonSelector(expression);
    }

    // Measured phase
    const times: number[] = [];
    for (let i = 0; i < config.iterations; i++) {
      const start = performance.now();
      parseJsonSelector(expression);
      times.push(performance.now() - start);
    }

    // Calculate statistics
    const totalMs = times.reduce((a, b) => a + b, 0);
    const avgMs = totalMs / config.iterations;
    const sortedTimes = [...times].sort((a, b) => a - b);

    results.push({
      name,
      expression,
      iterations: config.iterations,
      totalMs,
      avgMs,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      opsPerSec: Math.round(config.iterations / (totalMs / 1000)),
      stdDev: calculateStdDev(times, avgMs),
      p50: calculatePercentile(sortedTimes, 50),
      p95: calculatePercentile(sortedTimes, 95),
      p99: calculatePercentile(sortedTimes, 99),
    });
  }

  return results;
}
