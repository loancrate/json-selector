import { JsonSelector, JsonSelectorNodeType } from "./ast";
import { isIdentityProjection } from "./evaluate";
import { formatIdentifier, formatLiteral, formatRawString } from "./util";
import { visitJsonSelector } from "./visitor";

const PRECEDENCE_ACCESS = 1;
const PRECEDENCE_NOT = 2;
const PRECEDENCE_COMPARE = 3;
const PRECEDENCE_AND = 4;
const PRECEDENCE_OR = 5;
const PRECEDENCE_PIPE = 6;
const PRECEDENCE_MAX = 7;

const operatorPrecedence: { [type in JsonSelectorNodeType]?: number } = {
  fieldAccess: PRECEDENCE_ACCESS,
  idAccess: PRECEDENCE_ACCESS,
  indexAccess: PRECEDENCE_ACCESS,
  project: PRECEDENCE_ACCESS,
  filter: PRECEDENCE_ACCESS,
  slice: PRECEDENCE_ACCESS,
  flatten: PRECEDENCE_ACCESS,
  functionCall: PRECEDENCE_ACCESS,
  multiSelectList: PRECEDENCE_ACCESS,
  multiSelectHash: PRECEDENCE_ACCESS,
  objectProject: PRECEDENCE_ACCESS,
  not: PRECEDENCE_NOT,
  compare: PRECEDENCE_COMPARE,
  and: PRECEDENCE_AND,
  or: PRECEDENCE_OR,
  pipe: PRECEDENCE_PIPE,
};

function formatSubexpression(expr: JsonSelector, precedence: number): string {
  let result = format(expr);
  const subPrecedence = operatorPrecedence[expr.type];
  if (subPrecedence != null && subPrecedence > precedence) {
    result = `(${result})`;
  }
  return result;
}

const projectionNodeTypes = new Set<JsonSelectorNodeType>([
  "project",
  "objectProject",
  "filter",
  "slice",
  "flatten",
]);

/** Options controlling how a selector AST is formatted. */
export interface FormatJsonSelectorOptions {
  /**
   * @deprecated This option has no effect. The AST now includes an `explicit`
   * flag for current nodes and the formatter ensures valid output in all cases.
   */
  currentImplied: boolean;
}

/** Converts a selector AST back into its canonical string representation. */
export function formatJsonSelector(
  selector: JsonSelector,
  _options?: Partial<FormatJsonSelectorOptions>,
): string {
  const result = format(selector);
  // Ensure the output is always valid syntax: an empty result or one starting
  // with '.' cannot be a standalone expression, so prepend '@'.
  if (!result || result[0] === ".") {
    return "@" + result;
  }
  return result;
}

function format(selector: JsonSelector): string {
  return visitJsonSelector<string, undefined>(
    selector,
    {
      current({ explicit }) {
        return explicit ? "@" : "";
      },
      root() {
        return "$";
      },
      literal({ value, backtickSyntax }) {
        if (!backtickSyntax) {
          switch (value) {
            case true:
            case false:
            case null:
              return String(value);
          }
          if (typeof value === "string") {
            return formatRawString(value);
          }
        }
        return formatLiteral(value);
      },
      identifier({ id }) {
        return formatIdentifier(id);
      },
      fieldAccess({ expression, field }) {
        const lv = formatSubexpression(expression, PRECEDENCE_ACCESS);
        return `${lv}.${formatIdentifier(field)}`;
      },
      indexAccess({ expression, index }) {
        const lv = formatSubexpression(expression, PRECEDENCE_ACCESS);
        return `${lv}[${index}]`;
      },
      idAccess({ expression, id }) {
        const lv = formatSubexpression(expression, PRECEDENCE_ACCESS);
        return `${lv}[${formatRawString(id)}]`;
      },
      project({ expression, projection }) {
        let result = formatSubexpression(expression, PRECEDENCE_ACCESS);
        // Wildcard operator is only needed if expression is not already a projection
        if (!projectionNodeTypes.has(expression.type)) {
          result += "[*]";
        }
        if (!isIdentityProjection(projection)) {
          result += formatSubexpression(projection, PRECEDENCE_MAX);
        }
        return result;
      },
      filter({ expression, condition }) {
        const lv = formatSubexpression(expression, PRECEDENCE_ACCESS);
        const rv = formatSubexpression(condition, PRECEDENCE_MAX);
        return `${lv}[?${rv}]`;
      },
      slice({ expression, start, end, step }) {
        const lv = formatSubexpression(expression, PRECEDENCE_ACCESS);
        const rv = `${start ?? ""}:${end ?? ""}${
          step != null ? `:${step}` : ""
        }`;
        return `${lv}[${rv}]`;
      },
      flatten({ expression }) {
        const lv = formatSubexpression(expression, PRECEDENCE_ACCESS);
        return `${lv}[]`;
      },
      not({ expression }) {
        return `!${formatSubexpression(expression, PRECEDENCE_NOT)}`;
      },
      compare({ lhs, operator, rhs }) {
        const lv = formatSubexpression(lhs, PRECEDENCE_COMPARE);
        const rv = formatSubexpression(rhs, PRECEDENCE_COMPARE - 1);
        return `${lv} ${operator} ${rv}`;
      },
      and({ lhs, rhs }) {
        const lv = formatSubexpression(lhs, PRECEDENCE_AND);
        const rv = formatSubexpression(rhs, PRECEDENCE_AND - 1);
        return `${lv} && ${rv}`;
      },
      or({ lhs, rhs }) {
        const lv = formatSubexpression(lhs, PRECEDENCE_OR);
        const rv = formatSubexpression(rhs, PRECEDENCE_OR - 1);
        return `${lv} || ${rv}`;
      },
      pipe({ lhs, rhs, dotSyntax }) {
        const lv = formatSubexpression(lhs, PRECEDENCE_PIPE);
        if (dotSyntax) {
          // Dot syntax: foo.func(), foo.{...}, foo.[...]
          if (rhs.type === "multiSelectList") {
            return `${lv}.[${rhs.expressions.map((e) => format(e)).join(", ")}]`;
          }
          // For function calls and multi-select hashes, just use dot
          return `${lv}.${format(rhs)}`;
        }
        const rv = formatSubexpression(rhs, PRECEDENCE_PIPE - 1);
        return `${lv} | ${rv}`;
      },
      functionCall({ name, args }) {
        const formattedArgs = args.map((a) => format(a)).join(", ");
        return `${name}(${formattedArgs})`;
      },
      expressionRef({ expression }) {
        return `&${formatSubexpression(expression, PRECEDENCE_ACCESS)}`;
      },
      multiSelectList({ expressions }) {
        const items = expressions.map((expr) => format(expr)).join(", ");
        return `[${items}]`;
      },
      multiSelectHash({ entries }) {
        const items = entries
          .map(({ key, value }) => {
            const formattedKey = formatIdentifier(key);
            const formattedValue = format(value);
            return `${formattedKey}: ${formattedValue}`;
          })
          .join(", ");
        return `{${items}}`;
      },
      objectProject({ expression, projection }) {
        let result = formatSubexpression(expression, PRECEDENCE_ACCESS);
        // Only add .* if expression is not already a projection
        if (!projectionNodeTypes.has(expression.type)) {
          result += ".*";
        }
        if (!isIdentityProjection(projection)) {
          result += formatSubexpression(projection, PRECEDENCE_MAX);
        }
        return result;
      },
    },
    undefined,
  );
}
