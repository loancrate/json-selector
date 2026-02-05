import { JsonSelector, JsonSelectorNodeType } from "./ast";
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
  not: PRECEDENCE_NOT,
  compare: PRECEDENCE_COMPARE,
  and: PRECEDENCE_AND,
  or: PRECEDENCE_OR,
  pipe: PRECEDENCE_PIPE,
};

function formatSubexpression(
  expr: JsonSelector,
  options: Partial<FormatJsonSelectorOptions>,
  precedence: number,
): string {
  // Ensure @ is only used as a bare expression
  if (!options.currentImplied) {
    options = { ...options, currentImplied: true };
  }
  let result = formatJsonSelector(expr, options);
  const subPrecedence = operatorPrecedence[expr.type];
  if (subPrecedence != null && subPrecedence > precedence) {
    result = `(${result})`;
  }
  return result;
}

const projectionNodeTypes = new Set<JsonSelectorNodeType>([
  "project",
  "filter",
  "slice",
  "flatten",
]);

export interface FormatJsonSelectorOptions {
  currentImplied: boolean;
}

export function formatJsonSelector(
  selector: JsonSelector,
  options: Partial<FormatJsonSelectorOptions> = {},
): string {
  return visitJsonSelector<string, undefined>(
    selector,
    {
      current() {
        return !options.currentImplied ? "@" : "";
      },
      root() {
        return "$";
      },
      literal({ value }) {
        return formatLiteral(value);
      },
      identifier({ id }) {
        return formatIdentifier(id);
      },
      fieldAccess({ expression, field }) {
        const lv = formatSubexpression(expression, options, PRECEDENCE_ACCESS);
        return `${lv}.${formatIdentifier(field)}`;
      },
      indexAccess({ expression, index }) {
        const lv = formatSubexpression(expression, options, PRECEDENCE_ACCESS);
        return `${lv}[${index}]`;
      },
      idAccess({ expression, id }) {
        const lv = formatSubexpression(expression, options, PRECEDENCE_ACCESS);
        return `${lv}[${formatRawString(id)}]`;
      },
      project({ expression, projection }) {
        let result = formatSubexpression(
          expression,
          options,
          PRECEDENCE_ACCESS,
        );
        // Wildcard operator is only needed if expression is not already a projection
        if (!projectionNodeTypes.has(expression.type)) {
          result += "[*]";
        }
        if (projection) {
          result += formatSubexpression(projection, options, PRECEDENCE_MAX);
        }
        return result;
      },
      filter({ expression, condition }) {
        const lv = formatSubexpression(expression, options, PRECEDENCE_ACCESS);
        const rv = formatSubexpression(condition, options, PRECEDENCE_MAX);
        return `${lv}[?${rv}]`;
      },
      slice({ expression, start, end, step }) {
        const lv = formatSubexpression(expression, options, PRECEDENCE_ACCESS);
        const rv = `${start ?? ""}:${end ?? ""}${
          step != null ? `:${step}` : ""
        }`;
        return `${lv}[${rv}]`;
      },
      flatten({ expression }) {
        const lv = formatSubexpression(expression, options, PRECEDENCE_ACCESS);
        return `${lv}[]`;
      },
      not({ expression }) {
        return `!${formatSubexpression(expression, options, PRECEDENCE_NOT)}`;
      },
      compare({ lhs, operator, rhs }) {
        const lv = formatSubexpression(lhs, options, PRECEDENCE_COMPARE);
        const rv = formatSubexpression(rhs, options, PRECEDENCE_COMPARE - 1);
        return `${lv} ${operator} ${rv}`;
      },
      and({ lhs, rhs }) {
        const lv = formatSubexpression(lhs, options, PRECEDENCE_AND);
        const rv = formatSubexpression(rhs, options, PRECEDENCE_AND - 1);
        return `${lv} && ${rv}`;
      },
      or({ lhs, rhs }) {
        const lv = formatSubexpression(lhs, options, PRECEDENCE_OR);
        const rv = formatSubexpression(rhs, options, PRECEDENCE_OR - 1);
        return `${lv} || ${rv}`;
      },
      pipe({ lhs, rhs }) {
        const lv = formatSubexpression(lhs, options, PRECEDENCE_PIPE);
        const rv = formatSubexpression(rhs, options, PRECEDENCE_PIPE - 1);
        return `${lv} | ${rv}`;
      },
    },
    undefined,
  );
}
