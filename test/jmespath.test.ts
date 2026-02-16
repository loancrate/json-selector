import * as fs from "fs";
import * as path from "path";
import { JsonValue } from "type-fest";
import {
  evaluateJsonSelector,
  InvalidArgumentTypeError,
  InvalidArgumentValueError,
  InvalidArityError,
  JsonSelectorSyntaxError,
  parseJsonSelector,
  UnknownFunctionError,
} from "../src";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ERROR_TYPE_MAP: Record<string, new (...args: any[]) => Error> = {
  "invalid-type": InvalidArgumentTypeError,
  "invalid-value": InvalidArgumentValueError,
  "invalid-arity": InvalidArityError,
  "unknown-function": UnknownFunctionError,
  syntax: JsonSelectorSyntaxError,
};

const include = new Set<string>();
const exclude = new Set<string>();

const excludeComments: Array<string | RegExp> = [];

const excludeExpressions: Array<string | RegExp> = [];

const dirname = "test/jmespath";
const filenames = fs.readdirSync(dirname);
for (const filename of filenames) {
  const { name, ext } = path.parse(filename);
  const pathname = path.join(dirname, filename);
  if (
    ext === ".json" &&
    (!include.size || include.has(name)) &&
    !exclude.has(name) &&
    fs.statSync(pathname).isFile()
  ) {
    addTestSuitesFromFile(pathname);
  } else {
    describe.skip(pathname, () => undefined);
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

function addTestSuitesFromFile(filename: string) {
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
          if (
            !excludeComments.some((p) => matches(testCase.comment, p)) &&
            !excludeExpressions.some((p) => matches(testCase.expression, p))
          ) {
            if ("error" in testCase) {
              it(testName, function () {
                const ErrorClass = ERROR_TYPE_MAP[testCase.error];
                if (ErrorClass) {
                  expect(() => search(given, testCase.expression)).toThrow(
                    ErrorClass,
                  );
                } else {
                  expect(() => search(given, testCase.expression)).toThrow();
                }
              });
            } else {
              it(testName, function () {
                const result = search(given, testCase.expression);
                if ("result" in testCase) {
                  expect(result).toStrictEqual(testCase.result);
                }
              });
            }
          } else {
            it.skip(testName, () => undefined);
          }
          ++testNumber;
        }
      });
      ++suiteNumber;
    }
  });
}

function matches(s: string | undefined, pattern: string | RegExp): boolean {
  return (
    s != null &&
    (typeof pattern === "string" ? s.includes(pattern) : pattern.test(s))
  );
}

function search(value: JsonValue, expression: string): unknown {
  return evaluateJsonSelector(parseJsonSelector(expression), value);
}
