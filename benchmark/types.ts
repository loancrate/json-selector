export const LIBRARY_IDS = [
  "json-selector",
  "jmespath",
  "typescript-jmespath",
] as const;

export type LibraryId = (typeof LIBRARY_IDS)[number];

export function isValidLibrary(value: string): value is LibraryId {
  const valid: readonly string[] = LIBRARY_IDS;
  return valid.includes(value);
}

export interface BenchmarkResult {
  name: string;
  expression: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  opsPerSec: number;
  stdDev: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface BenchmarkCase {
  name: string;
  expression: string;
}

export interface BenchmarkMetadata {
  timestamp: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  gitCommit: string;
  gitBranch: string;
  library: LibraryId;
}

export interface BenchmarkConfig {
  warmupIterations: number;
  iterations: number;
}

export interface BenchmarkRun {
  metadata: BenchmarkMetadata;
  config: BenchmarkConfig;
  results: BenchmarkResult[];
}

export interface ComparisonResult {
  name: string;
  expression: string;
  baselineAvgMs: number;
  currentAvgMs: number;
  changePercent: number;
  status: "ok" | "faster" | "slower";
}
