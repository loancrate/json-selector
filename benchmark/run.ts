import { execSync } from "child_process";
import type {
  BenchmarkCase,
  BenchmarkConfig,
  BenchmarkMetadata,
  BenchmarkResult,
  LibraryId,
} from "./types";
import type { ParseFn } from "./parsers";

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

export function collectMetadata(library: LibraryId): BenchmarkMetadata {
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
    library,
  };
}

export function runBenchmark(
  cases: BenchmarkCase[],
  config: BenchmarkConfig,
  parseFn: ParseFn,
): BenchmarkResult[] {
  // Store only the best result for each case
  const bestResults: (BenchmarkResult | null)[] = cases.map(() => null);

  for (let pass = 0; pass < config.runsPerIteration; pass++) {
    for (let caseIndex = 0; caseIndex < cases.length; caseIndex++) {
      const { name, expression } = cases[caseIndex];

      // Warmup only on first pass
      if (pass === 0) {
        for (let i = 0; i < config.warmupIterations; i++) {
          parseFn(expression);
        }
      }

      // Measured iterations - compute statistics incrementally
      const times: number[] = [];
      for (let i = 0; i < config.iterations; i++) {
        const start = process.hrtime.bigint();
        parseFn(expression);
        const elapsedNs = Number(process.hrtime.bigint() - start);
        times.push(elapsedNs);
      }

      // Compute statistics immediately
      const totalNs = times.reduce((a, b) => a + b, 0);
      const avgNs = totalNs / config.iterations;
      const sortedTimes = [...times].sort((a, b) => a - b);

      const result: BenchmarkResult = {
        name,
        expression,
        iterations: config.iterations,
        totalNs,
        avgNs,
        minNs: Math.min(...times),
        maxNs: Math.max(...times),
        opsPerSec: Math.round(config.iterations / (totalNs / 1_000_000_000)),
        stdDev: calculateStdDev(times, avgNs),
        p50: calculatePercentile(sortedTimes, 50),
        p95: calculatePercentile(sortedTimes, 95),
        p99: calculatePercentile(sortedTimes, 99),
      };

      // Keep if this is the best pass (lowest totalNs)
      const current = bestResults[caseIndex];
      if (current === null || result.totalNs < current.totalNs) {
        bestResults[caseIndex] = result;
      }
    }
  }

  return bestResults.filter(
    (result): result is BenchmarkResult => result !== null,
  );
}
