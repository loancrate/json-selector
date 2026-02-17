import * as fs from "fs";
import * as path from "path";

import { JsonValue } from "type-fest";

import {
  type EvaluationContext,
  evaluateJsonSelector,
  InvalidArgumentTypeError,
  InvalidArgumentValueError,
  InvalidArityError,
  JsonSelectorSyntaxError,
  parseJsonSelector,
  ParserOptions,
  UndefinedVariableError,
  UnknownFunctionError,
} from "../src";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ERROR_TYPE_MAP: Record<string, new (...args: any[]) => Error> = {
  "invalid-type": InvalidArgumentTypeError,
  "invalid-value": InvalidArgumentValueError,
  "invalid-arity": InvalidArityError,
  "unknown-function": UnknownFunctionError,
  syntax: JsonSelectorSyntaxError,
  "undefined-variable": UndefinedVariableError,
};

const fixtureDirs = ["test/jmespath", "test/jmespath-community"];

for (const dirname of fixtureDirs) {
  if (!fs.existsSync(dirname)) {
    describe.skip(dirname, () => undefined);
    continue;
  }
  const files = listJsonFiles(dirname);
  for (const pathname of files) {
    addTestSuitesFromFile(pathname);
  }
}

interface TestSuite {
  comment?: string;
  given: JsonValue;
  cases: TestCase[];
}

type TestCase = ResultTestCase | BenchmarkTestCase | ErrorTestCase;

interface ResultTestCase {
  comment?: string;
  expression: string;
  result: JsonValue;
}

interface BenchmarkTestCase {
  comment?: string;
  expression: string;
  bench: JsonValue;
}

interface ErrorTestCase {
  comment?: string;
  expression: string;
  error: string;
}

interface SearchOptions {
  evalCtx?: Partial<EvaluationContext>;
  parserOptions?: ParserOptions;
}

function addTestSuitesFromFile(filename: string) {
  const options = getFixtureSearchOptions(filename);
  describe(filename, function () {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const suites = JSON.parse(
      fs.readFileSync(filename, { encoding: "utf8" }),
    ) as TestSuite[];
    let suiteNumber = 1;
    for (const suite of suites) {
      const { given, cases } = suite;
      const suiteName = `Suite #${suiteNumber}: ${
        suite.comment || `${cases.length} tests`
      }`;
      describe(suiteName, function () {
        let testNumber = 1;
        for (const testCase of cases) {
          const testName = `Test #${testNumber}: ${
            testCase.comment || testCase.expression
          }`;
          if ("error" in testCase) {
            it(testName, function () {
              const ErrorClass = ERROR_TYPE_MAP[testCase.error];
              if (ErrorClass) {
                expect(() =>
                  search(given, testCase.expression, options),
                ).toThrow(ErrorClass);
              } else {
                expect(() =>
                  search(given, testCase.expression, options),
                ).toThrow();
              }
            });
          } else {
            it(testName, function () {
              const result = search(given, testCase.expression, options);
              if ("result" in testCase) {
                expect(result).toStrictEqual(testCase.result);
              }
            });
          }
          ++testNumber;
        }
      });
      ++suiteNumber;
    }
  });
}

function getFixtureSearchOptions(filename: string): SearchOptions | undefined {
  if (/test\/jmespath\//.test(filename)) {
    return {
      evalCtx: { evaluateNullMultiSelect: false },
      parserOptions: { rawStringBackslashEscape: false },
    };
  }
  if (/test\/jmespath-community\/legacy\//.test(filename)) {
    return undefined; // default permissive behavior
  }
  if (/test\/jmespath-community\//.test(filename)) {
    return { parserOptions: { strictJsonLiterals: true } };
  }
  return undefined;
}

function listJsonFiles(dirname: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dirname, { withFileTypes: true })) {
    const pathname = path.join(dirname, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(pathname));
    } else if (entry.isFile() && path.extname(entry.name) === ".json") {
      files.push(pathname);
    }
  }
  files.sort();
  return files;
}

function search(
  value: JsonValue,
  expression: string,
  options?: SearchOptions,
): unknown {
  return evaluateJsonSelector(
    parseJsonSelector(expression, options?.parserOptions),
    value,
    options?.evalCtx,
  );
}
