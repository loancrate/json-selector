import { JsonValue } from "type-fest";
import { JsonSelector, JsonSelectorCompareOperator } from "./ast";
import { TokenStream } from "./lexer";

// Type for functions that transform expressions
type ExpressionBuilder = (expr: JsonSelector) => JsonSelector;

// Helper: Apply array of builder functions left-to-right via reduce
function reduceProjection(
  lhs: JsonSelector,
  rhs: ExpressionBuilder[],
): JsonSelector {
  return rhs.reduce((result, fn) => fn(result), lhs);
}

// Helper: Wrap expression in project if there are projection functions
function maybeProject(
  expression: JsonSelector,
  pfns: ExpressionBuilder[],
): JsonSelector {
  if (pfns.length === 0) return expression;
  return {
    type: "project",
    expression: unwrapTrivialProjection(expression),
    projection: reduceProjection({ type: "current" }, pfns),
  };
}

// Helper: Unwrap project(x, @) to just x
function unwrapTrivialProjection(expression: JsonSelector): JsonSelector {
  if (
    expression.type === "project" &&
    (!expression.projection || expression.projection.type === "current")
  ) {
    return expression.expression;
  }
  return expression;
}

export class Parser {
  private readonly ts: TokenStream;

  // Bound method references (created once, not per call)
  private readonly _parseOr: () => JsonSelector;
  private readonly _parseAnd: () => JsonSelector;
  private readonly _parseCompare: () => JsonSelector;

  // Comparison operator token to AST operator mapping
  private static readonly COMPARE_OPS: Record<
    string,
    JsonSelectorCompareOperator
  > = {
    lte: "<=",
    gte: ">=",
    eq: "==",
    neq: "!=",
    lt: "<",
    gt: ">",
  };

  constructor(input: string) {
    this.ts = new TokenStream(input);

    // Bind methods once
    this._parseOr = this.parseOr.bind(this);
    this._parseAnd = this.parseAnd.bind(this);
    this._parseCompare = this.parseCompare.bind(this);
  }

  // Lazy bracket type checking
  private getBracketType():
    | "flatten"
    | "filter"
    | "star"
    | "slice"
    | "index"
    | "id"
    | null {
    const token = this.ts.peek();
    if (!token) return null;

    // Fast exit for filter bracket
    if (token.type === "filterBracket") return "filter";

    // Fast exit if not a bracket at all (AVOIDS 99% of peekBracketType calls)
    if (token.type !== "lbracket") return null;

    // Only now do we need the full lookahead logic
    return this.ts.peekBracketType();
  }

  parse(): JsonSelector {
    const result = this.parsePipe();
    if (!this.ts.eof()) {
      const token = this.ts.peek();
      throw new Error(
        `Unexpected token at position ${token?.offset}: ${token?.text}`,
      );
    }
    return result;
  }

  // Binary operators: pipe, or, and
  private parseBinary(
    nextLevel: () => JsonSelector,
    opType: string,
    nodeType: "pipe" | "or" | "and",
  ): JsonSelector {
    let left = nextLevel();
    while (this.ts.tryConsume(opType)) {
      const right = nextLevel();
      left = { type: nodeType, lhs: left, rhs: right };
    }
    return left;
  }

  private parsePipe(): JsonSelector {
    return this.parseBinary(this._parseOr, "pipe", "pipe");
  }

  private parseOr(): JsonSelector {
    return this.parseBinary(this._parseAnd, "or", "or");
  }

  private parseAnd(): JsonSelector {
    return this.parseBinary(this._parseCompare, "and", "and");
  }

  // Compare operators (multiple types)
  private parseCompare(): JsonSelector {
    let left = this.parseNot();

    while (
      this.ts.is("lte") ||
      this.ts.is("gte") ||
      this.ts.is("eq") ||
      this.ts.is("neq") ||
      this.ts.is("lt") ||
      this.ts.is("gt")
    ) {
      const token = this.ts.peek();
      if (!token?.type) {
        throw new Error("Expected comparison operator but got EOF");
      }
      const operator = Parser.COMPARE_OPS[token.type];
      if (!operator) {
        throw new Error(`Unknown comparison operator: ${token.type}`);
      }
      this.ts.advance();

      const right = this.parseNot();
      left = { type: "compare", operator, lhs: left, rhs: right };
    }

    return left;
  }

  // Not expression
  private parseNot(): JsonSelector {
    if (this.ts.tryConsume("not")) {
      return { type: "not", expression: this.parseNot() };
    }
    return this.parseFlatten();
  }

  // Flatten expression
  private parseFlatten(): JsonSelector {
    // Leading [] applies to @
    if (this.getBracketType() === "flatten") {
      const lhs = this.consumeFlatten()({ type: "current" });
      const rhs = this.collectFlattenRhs();
      return reduceProjection(lhs, rhs);
    }

    const lhs = this.parseFilter();
    const rhs = this.collectFlattenRhs();
    return reduceProjection(lhs, rhs);
  }

  private collectFlattenRhs(): ExpressionBuilder[] {
    const builders: ExpressionBuilder[] = [];

    while (true) {
      const bracketType = this.getBracketType();

      if (bracketType === "flatten") {
        const flatten = this.consumeFlatten();
        const pfns = this.collectFilterRhs();
        builders.push((expr) => maybeProject(flatten(expr), pfns));
      } else if (bracketType === "filter") {
        const filter = this.consumeFilter();
        const pfns = this.collectFilterRhs();
        builders.push((expr) => maybeProject(filter(expr), pfns));
      } else {
        const item = this.tryCollectFilterRhsItem();
        if (item) {
          builders.push(item);
        } else {
          break;
        }
      }
    }

    return builders;
  }

  private consumeFlatten(): ExpressionBuilder {
    this.ts.consume("lbracket");
    this.ts.consume("rbracket");
    return (expression) => ({ type: "flatten", expression });
  }

  // Filter expression
  private parseFilter(): JsonSelector {
    // Leading [?...] applies to @
    if (this.getBracketType() === "filter") {
      const lhs = this.consumeFilter()({ type: "current" });
      const rhs = this.collectFilterRhs();
      return reduceProjection(lhs, rhs);
    }

    const lhs = this.parseProjection();
    const rhs = this.collectFilterRhs();
    return reduceProjection(lhs, rhs);
  }

  private collectFilterRhs(): ExpressionBuilder[] {
    const builders: ExpressionBuilder[] = [];

    while (true) {
      if (this.getBracketType() === "filter") {
        const filter = this.consumeFilter();
        const pfns = this.collectFilterRhs();
        builders.push((expr) => maybeProject(filter(expr), pfns));
      } else {
        const item = this.tryCollectFilterRhsItem();
        if (item) {
          builders.push(item);
        } else {
          break;
        }
      }
    }

    return builders;
  }

  private tryCollectFilterRhsItem(): ExpressionBuilder | undefined {
    // Try projection
    const proj = this.tryConsumeProjection();
    if (proj) {
      const pfns = this.collectFilterRhs();
      return (expr) => maybeProject(proj(expr), pfns);
    }

    // Try index/id
    const idx = this.tryCollectIndexRhs();
    if (idx) return idx;

    // Try dot
    return this.tryCollectDotRhs();
  }

  private consumeFilter(): ExpressionBuilder {
    // Consume either [? as filterBracket token or [ followed by ?
    if (this.ts.is("filterBracket")) {
      this.ts.consume("filterBracket");
    } else {
      this.ts.consume("lbracket");
      this.ts.consume("question");
    }
    const condition = this.parsePipe();
    this.ts.consume("rbracket");
    return (expression) => ({ type: "filter", expression, condition });
  }

  // Projection expression
  private parseProjection(): JsonSelector {
    // Leading [*] or slice applies to @
    const proj = this.tryConsumeProjection();
    if (proj) {
      const lhs = proj({ type: "current" });
      const rhs = this.collectProjectionRhs();
      return reduceProjection(lhs, rhs);
    }

    const lhs = this.parseIndex();
    const rhs = this.collectProjectionRhs();
    return reduceProjection(lhs, rhs);
  }

  private collectProjectionRhs(): ExpressionBuilder[] {
    const builders: ExpressionBuilder[] = [];

    while (true) {
      const proj = this.tryConsumeProjection();
      if (proj) {
        const pfns = this.collectFilterRhs();
        builders.push((expr) => maybeProject(proj(expr), pfns));
      } else {
        const idx = this.tryCollectIndexRhs();
        if (idx) {
          builders.push(idx);
        } else {
          break;
        }
      }
    }

    return builders;
  }

  private tryConsumeProjection(): ExpressionBuilder | undefined {
    const bracketType = this.getBracketType();

    if (bracketType === "star") {
      this.ts.consume("lbracket");
      this.ts.consume("star");
      this.ts.consume("rbracket");
      return (expression) => ({
        type: "project",
        expression,
        projection: { type: "current" },
      });
    }

    if (bracketType === "slice") {
      return this.parseSlice();
    }

    return undefined;
  }

  private parseSlice(): ExpressionBuilder {
    this.ts.consume("lbracket");

    let start: number | undefined;
    let end: number | undefined;
    let step: number | undefined;

    // Parse start (optional)
    if (this.ts.is("number")) {
      start = parseInt(this.ts.consume("number").text, 10);
    }

    this.ts.consume("colon");

    // Parse end (optional)
    if (this.ts.is("number")) {
      end = parseInt(this.ts.consume("number").text, 10);
    }

    // Check for second colon (optional)
    if (this.ts.tryConsume("colon")) {
      // Parse step (optional)
      if (this.ts.is("number")) {
        step = parseInt(this.ts.consume("number").text, 10);
      }
    }

    this.ts.consume("rbracket");

    return (expression: JsonSelector) => ({
      type: "slice",
      expression,
      start,
      end,
      step,
    });
  }

  // Index expression
  private parseIndex(): JsonSelector {
    // Leading [n] or ['id'] applies to @
    const idx = this.tryCollectIndexRhs();
    if (idx) {
      const lhs = idx({ type: "current" });
      const rhs = this.collectIndexRhs();
      return reduceProjection(lhs, rhs);
    }

    const lhs = this.parseMember();
    const rhs = this.collectIndexRhs();
    return reduceProjection(lhs, rhs);
  }

  private collectIndexRhs(): ExpressionBuilder[] {
    const builders: ExpressionBuilder[] = [];

    while (true) {
      const item = this.tryCollectIndexRhs();
      if (item) {
        builders.push(item);
      } else {
        break;
      }
    }

    return builders;
  }

  private tryCollectIndexRhs(): ExpressionBuilder | undefined {
    const bracketType = this.getBracketType();

    if (bracketType === "index") {
      this.ts.consume("lbracket");
      const index = parseInt(this.ts.consume("number").text, 10);
      this.ts.consume("rbracket");
      return (expression) => ({ type: "indexAccess", expression, index });
    }

    if (bracketType === "id") {
      this.ts.consume("lbracket");
      const id = String(this.ts.consume("rawString").value);
      this.ts.consume("rbracket");
      return (expression) => ({ type: "idAccess", expression, id });
    }

    return undefined;
  }

  // Member expression
  private parseMember(): JsonSelector {
    let result = this.parsePrimary();

    // Direct field access (no array, no closure, no reduce)
    while (this.ts.is("dot")) {
      this.ts.consume("dot");
      const field = this.parseIdentifier();
      result = { type: "fieldAccess", expression: result, field };
    }

    return result;
  }

  private tryCollectDotRhs(): ExpressionBuilder | undefined {
    if (!this.ts.is("dot")) {
      return undefined;
    }

    this.ts.consume("dot");
    const field = this.parseIdentifier();
    return (expression) => ({ type: "fieldAccess", expression, field });
  }

  // Primary expression
  private parsePrimary(): JsonSelector {
    // @
    if (this.ts.tryConsume("at")) {
      return { type: "current" };
    }

    // $
    if (this.ts.tryConsume("dollar")) {
      return { type: "root" };
    }

    // Literal `...`
    if (this.ts.tryConsume("backtick")) {
      const value = this.parseJsonValue();
      this.ts.consume("backtick");
      return { type: "literal", value };
    }

    // Raw string (used as literal)
    if (this.ts.is("rawString")) {
      const value = String(this.ts.consume("rawString").value);
      return { type: "literal", value };
    }

    // Parenthesized expression
    if (this.ts.tryConsume("lparen")) {
      const expression = this.parsePipe();
      this.ts.consume("rparen");
      return expression;
    }

    // Identifier
    if (this.ts.is("identifier") || this.ts.is("quotedString")) {
      const id = this.parseIdentifier();
      return { type: "identifier", id };
    }

    const token = this.ts.peek();
    throw new Error(
      `Unexpected token at position ${token?.offset}: ${token?.text}`,
    );
  }

  private parseIdentifier(): string {
    if (this.ts.is("identifier")) {
      return String(this.ts.consume("identifier").value);
    }
    if (this.ts.is("quotedString")) {
      return String(this.ts.consume("quotedString").value);
    }
    const token = this.ts.peek();
    throw new Error(`Expected identifier at position ${token?.offset}`);
  }

  private parseJsonValue(): JsonValue {
    if (this.ts.tryConsume("null")) {
      return null;
    }

    if (this.ts.tryConsume("true")) {
      return true;
    }

    if (this.ts.tryConsume("false")) {
      return false;
    }

    if (this.ts.is("number")) {
      return parseFloat(this.ts.consume("number").text);
    }

    if (this.ts.is("quotedString")) {
      return String(this.ts.consume("quotedString").value);
    }

    if (this.ts.is("lbracket")) {
      return this.parseJsonArray();
    }

    if (this.ts.is("lbrace")) {
      return this.parseJsonObject();
    }

    // Unquoted string (for literals)
    return this.parseUnquotedJsonString();
  }

  private parseUnquotedJsonString(): string {
    let result = "";
    while (!this.ts.eof() && !this.ts.is("backtick")) {
      const token = this.ts.peek();
      if (!token) break; // Safety check (should not happen due to eof check)

      if (this.ts.is("quotedString")) {
        result += String(this.ts.consume("quotedString").value);
      } else {
        result += token.text;
        this.ts.advance();
      }
    }
    return result.trim();
  }

  private parseJsonArray(): JsonValue[] {
    this.ts.consume("lbracket");

    const values: JsonValue[] = [];

    if (!this.ts.is("rbracket")) {
      values.push(this.parseJsonValue());

      while (this.ts.tryConsume("comma")) {
        values.push(this.parseJsonValue());
      }
    }

    this.ts.consume("rbracket");
    return values;
  }

  private parseJsonObject(): Record<string, JsonValue> {
    this.ts.consume("lbrace");

    const obj: Record<string, JsonValue> = {};

    if (!this.ts.is("rbrace")) {
      const [key, value] = this.parseJsonMember();
      obj[key] = value;

      while (this.ts.tryConsume("comma")) {
        const [k, v] = this.parseJsonMember();
        obj[k] = v;
      }
    }

    this.ts.consume("rbrace");
    return obj;
  }

  private parseJsonMember(): [string, JsonValue] {
    const key = String(this.ts.consume("quotedString").value);
    this.ts.consume("colon");
    const value = this.parseJsonValue();
    return [key, value];
  }
}
