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

const include = new Set<string>();
const exclude = new Set<string>();

const excludeComments: Array<string | RegExp> = [];

const excludeExpressions: Array<string | RegExp> = [];

const deferredCommunityCases: Array<{
  file: RegExp;
  comment?: string | RegExp;
  expression?: string | RegExp;
}> = [
  // Deferred: JMESPath Community string function semantics.
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: "find_first(string, 'string', `-6`)",
  },
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: "find_first(string, 'string', `-99`, `100`)",
  },
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: "find_first(string, '')",
  },
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: "find_first('', '')",
  },
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: "find_last(string, 's', `-6`)",
  },
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: "find_last(string, '')",
  },
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: "find_last('', '')",
  },
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: /trim\('[\s\S]*\u2000[\s\S]*'\)/u,
  },
  {
    file: /test\/jmespath-community\/functions_strings\.json$/,
    expression: "split('all chars', '', `3`)",
  },

  // Deferred: literal-grammar/raw-string community deltas.
  {
    file: /test\/jmespath-community\/literal\.json$/,
    comment: "Can escape backslash",
  },

  // Deferred: projection/pipe community semantics on null and string slices.
  {
    file: /test\/jmespath-community\/pipe\.json$/,
    expression: "`null`|[@]",
  },
  {
    file: /test\/jmespath-community\/pipe\.json$/,
    expression: "`null`|{foo: @}",
  },
  {
    file: /test\/jmespath-community\/slice\.json$/,
    expression: "'foo'[:].length(@)",
  },

  // Deferred: Unicode collation/grapheme semantics.
  {
    file: /test\/jmespath-community\/unicode\.json$/,
    expression: "length('𝌆')",
  },
  {
    file: /test\/jmespath-community\/unicode\.json$/,
    expression: "sort(strings)",
  },
  {
    file: /test\/jmespath-community\/unicode\.json$/,
    expression: "sort_by(graphemeClusters, &string)",
  },
];

const fixtureDirs = ["test/jmespath", "test/jmespath-community"];

for (const dirname of fixtureDirs) {
  if (!fs.existsSync(dirname)) {
    describe.skip(dirname, () => undefined);
    continue;
  }
  const files = listJsonFiles(dirname);
  for (const pathname of files) {
    const { name, ext } = path.parse(pathname);
    if (
      ext === ".json" &&
      (!include.size || include.has(name)) &&
      !exclude.has(name)
    ) {
      addTestSuitesFromFile(pathname);
    } else {
      describe.skip(pathname, () => undefined);
    }
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
  const evalCtx = getFixtureEvalContext(filename);
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
            !excludeExpressions.some((p) => matches(testCase.expression, p)) &&
            !isDeferredCommunityCase(filename, testCase)
          ) {
            if ("error" in testCase) {
              it(testName, function () {
                const ErrorClass = ERROR_TYPE_MAP[testCase.error];
                if (ErrorClass) {
                  expect(() =>
                    search(given, testCase.expression, evalCtx),
                  ).toThrow(ErrorClass);
                } else {
                  expect(() =>
                    search(given, testCase.expression, evalCtx),
                  ).toThrow();
                }
              });
            } else {
              it(testName, function () {
                const result = search(given, testCase.expression, evalCtx);
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

function getFixtureEvalContext(
  filename: string,
): Partial<EvaluationContext> | undefined {
  if (/test\/jmespath-community\/legacy\//.test(filename)) {
    return { legacyLiterals: true };
  }
  return undefined;
}

function isDeferredCommunityCase(
  filename: string,
  testCase: TestCase,
): boolean {
  return deferredCommunityCases.some(
    ({ file, comment, expression }) =>
      file.test(filename) &&
      (comment === undefined || matches(testCase.comment, comment)) &&
      (expression === undefined || matches(testCase.expression, expression)),
  );
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

function matches(s: string | undefined, pattern: string | RegExp): boolean {
  return (
    s != null &&
    (typeof pattern === "string" ? s.includes(pattern) : pattern.test(s))
  );
}

function search(
  value: JsonValue,
  expression: string,
  evalCtx?: Partial<EvaluationContext>,
): unknown {
  return evaluateJsonSelector(
    parseJsonSelector(expression, { legacyLiterals: evalCtx?.legacyLiterals }),
    value,
    evalCtx,
  );
}
