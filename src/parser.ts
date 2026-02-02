import { JsonValue } from "type-fest";
import { JsonSelector, JsonSelectorCompareOperator } from "./ast";
import { TokenStream } from "./lexer";

/**
 * Pratt Parser for JSON Selectors
 *
 * Uses precedence-climbing (Pratt parsing) with binding power (0-55 range) to handle
 * operator precedence efficiently. The parser uses two main methods:
 * - nud() for prefix/primary expressions (no left context)
 * - led() for infix/postfix operators (with left context)
 */
export class Parser {
  private readonly ts: TokenStream;

  // Projection stop threshold: operators below this terminate projections
  // Separates terminators (pipe, or, and, comparisons) from continuators (dot, brackets)
  private static readonly PROJECTION_STOP_THRESHOLD = 10;

  // Binding power table (higher = tighter binding)
  private static readonly BINDING_POWER: Record<string, number> = {
    // Terminators (lowest precedence)
    eof: 0,
    rparen: 0,
    rbracket: 0,
    rbrace: 0,
    comma: 0,

    // Binary operators (low to high)
    pipe: 1, // |
    or: 3, // ||
    and: 4, // &&

    // Comparison operators (all same precedence - non-associative, cannot chain)
    eq: 7, // ==
    neq: 7, // !=
    lt: 7, // <
    lte: 7, // <=
    gt: 7, // >
    gte: 7, // >=

    // Projection operators
    // flatten has lower bp (9) than star/filter to allow chaining: foo[*][] or foo[?x][].bar
    flatten: 9, // []
    star: 20, // [*]
    filterBracket: 21, // [?...]

    // Postfix operators (high precedence)
    dot: 40, // .

    // Prefix operators
    not: 45, // !

    // Bracket access (highest)
    lbracket: 55, // [ (for index/slice/id access)
  };

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
  }

  /**
   * Main entry point: parse a complete expression
   */
  parse(): JsonSelector {
    const result = this.expression(0);
    if (!this.ts.eof()) {
      const token = this.ts.peek();
      throw new Error(
        `Unexpected token at position ${token?.offset}: ${token?.text}`,
      );
    }
    return result;
  }

  /**
   * Core Pratt parser: expression parsing with binding power
   *
   * @param rbp Right binding power - controls when to stop parsing
   * @returns Parsed expression node
   */
  private expression(rbp: number): JsonSelector {
    // Get prefix/primary expression via nud (null denotation)
    let left = this.nud();

    // Continue parsing while current operator has higher binding power
    while (rbp < this.getBindingPower()) {
      left = this.led(left);
    }

    return left;
  }

  /**
   * Get binding power of current token
   *
   * Special case: Brackets have context-dependent binding power based on their content.
   * [] (flatten) has lower precedence than [*]/[0]/['id'] to allow projection chaining.
   */
  private getBindingPower(): number {
    const token = this.ts.peek();
    if (!token || !token.type) return 0;

    // Brackets need lookahead to determine their binding power:
    // - [] (flatten) → bp=9 (low, allows chaining after projections)
    // - [*] (star) → bp=20 (medium, projection operator)
    // - [0], ['id'], [:] (index/id/slice) → bp=55 (highest, tightest binding)
    if (token.type === "lbracket") {
      const bracketType = this.ts.peekBracketType();
      if (bracketType === "flatten") {
        return Parser.BINDING_POWER.flatten;
      }
      if (bracketType === "star") {
        return Parser.BINDING_POWER.star;
      }
      return Parser.BINDING_POWER.lbracket;
    }

    return Parser.BINDING_POWER[token.type] ?? 0;
  }

  /**
   * NUD (Null Denotation): Handle prefix operators and primary expressions
   * Called when we don't have a left-hand side yet
   */
  private nud(): JsonSelector {
    const token = this.ts.peek();
    if (!token) {
      throw new Error("Unexpected end of input");
    }

    switch (token.type) {
      case "not":
        this.ts.advance();
        return {
          type: "not",
          expression: this.expression(Parser.BINDING_POWER.not),
        };

      case "at":
        this.ts.advance();
        return { type: "current" };

      case "dollar":
        this.ts.advance();
        return { type: "root" };

      case "backtick": {
        this.ts.advance();
        const value = this.parseJsonValue();
        this.ts.consume("backtick");
        return { type: "literal", value };
      }

      case "rawString":
        this.ts.advance();
        return { type: "literal", value: token.value };

      case "identifier":
        this.ts.advance();
        return { type: "identifier", id: token.value };

      case "quotedString":
        this.ts.advance();
        return { type: "identifier", id: token.value };

      case "lparen": {
        this.ts.advance();
        const expr = this.expression(0);
        this.ts.consume("rparen");
        return expr;
      }

      case "lbracket":
        return this.parseLeadingBracket();

      case "filterBracket":
        return this.parseLeadingFilter();

      default:
        throw new Error(
          `Unexpected token at position ${token.offset}: ${token.text}`,
        );
    }
  }

  /**
   * LED (Left Denotation): Handle infix and postfix operators
   * Called when we have a left-hand side
   */
  private led(left: JsonSelector): JsonSelector {
    const token = this.ts.peek();
    if (!token || !token.type) {
      throw new Error("Unexpected end of input in led()");
    }

    switch (token.type) {
      case "pipe": // bp=1
        this.ts.advance();
        return {
          type: "pipe",
          lhs: left,
          rhs: this.expression(Parser.BINDING_POWER.pipe),
        };

      case "or": // bp=3
        this.ts.advance();
        return {
          type: "or",
          lhs: left,
          rhs: this.expression(Parser.BINDING_POWER.or),
        };

      case "and": // bp=4
        this.ts.advance();
        return {
          type: "and",
          lhs: left,
          rhs: this.expression(Parser.BINDING_POWER.and),
        };

      case "eq": // bp=7
      case "neq":
      case "lt":
      case "lte":
      case "gt":
      case "gte": {
        const compareOp = Parser.COMPARE_OPS[token.type];
        this.ts.advance();
        return {
          type: "compare",
          operator: compareOp,
          lhs: left,
          rhs: this.expression(Parser.BINDING_POWER[token.type]),
        };
      }

      case "filterBracket": // bp=21
        return this.parseFilterExpression(left);

      case "dot": {
        // bp=40
        this.ts.advance();
        const field = this.parseIdentifier();
        return { type: "fieldAccess", expression: left, field };
      }

      case "lbracket": // bp=55
        return this.parseBracketExpression(left);

      default:
        throw new Error(
          `Unexpected token in led() at position ${token.offset}: ${token.text}`,
        );
    }
  }

  /**
   * Parse leading bracket expressions (no LHS): [], [*], [0], [:], ['id']
   *
   * When a bracket appears at the start of an expression or after an operator,
   * it implicitly applies to @ (current context). For example:
   * - `[0]` means `@[0]`
   * - `foo | [*]` means `foo | @[*]`
   */
  private parseLeadingBracket(): JsonSelector {
    const bracketType = this.ts.peekBracketType();

    if (bracketType === "flatten") {
      // Leading [] applies to @
      this.ts.consume("lbracket");
      this.ts.consume("rbracket");
      const flattenNode: JsonSelector = {
        type: "flatten",
        expression: { type: "current" },
      };
      // Continue parsing RHS (e.g., [].foo)
      return this.parseProjectionRHS(flattenNode);
    }

    if (bracketType === "star") {
      // Leading [*] applies to @
      this.ts.consume("lbracket");
      this.ts.consume("star");
      this.ts.consume("rbracket");
      const projectNode: JsonSelector = {
        type: "project",
        expression: { type: "current" },
        projection: { type: "current" },
      };
      return this.parseProjectionRHS(projectNode);
    }

    if (bracketType === "slice") {
      // Leading [:] applies to @
      const sliceNode = this.parseSlice({ type: "current" });
      return this.parseProjectionRHS(sliceNode);
    }

    if (bracketType === "index") {
      // Leading [0] applies to @
      this.ts.consume("lbracket");
      const index = parseInt(this.ts.consume("number").text, 10);
      this.ts.consume("rbracket");
      return {
        type: "indexAccess",
        expression: { type: "current" },
        index,
      };
    }

    if (bracketType === "id") {
      // Leading ['id'] applies to @
      this.ts.consume("lbracket");
      const id = this.ts.consume("rawString").value;
      this.ts.consume("rbracket");
      return {
        type: "idAccess",
        expression: { type: "current" },
        id,
      };
    }

    throw new Error("Invalid bracket expression");
  }

  /**
   * Parse leading filter expression (no LHS): [?...]
   *
   * When [? appears without a left-hand side, it implicitly applies to @ (current context).
   * Example: `[?x > 5]` means `@[?x > 5]`
   */
  private parseLeadingFilter(): JsonSelector {
    // Lexer may emit either a single "filterBracket" token or separate "lbracket" + "question"
    // Try the combined token first, fall back to consuming separately
    if (this.ts.tryConsume("filterBracket")) {
      // Combined [? token consumed
    } else {
      this.ts.consume("lbracket");
      this.ts.consume("question");
    }

    const condition = this.expression(0);
    this.ts.consume("rbracket");

    const filterNode: JsonSelector = {
      type: "filter",
      expression: { type: "current" },
      condition,
    };

    return this.parseProjectionRHS(filterNode);
  }

  /**
   * Parse bracket expression with LHS: foo[0], foo[:], foo[*], foo['id']
   */
  private parseBracketExpression(left: JsonSelector): JsonSelector {
    const bracketType = this.ts.peekBracketType();

    if (bracketType === "flatten") {
      // foo[] - flatten
      this.ts.consume("lbracket");
      this.ts.consume("rbracket");
      const flattenNode: JsonSelector = {
        type: "flatten",
        expression: left,
      };
      return this.parseProjectionRHS(flattenNode);
    }

    if (bracketType === "star") {
      // foo[*] - project
      this.ts.consume("lbracket");
      this.ts.consume("star");
      this.ts.consume("rbracket");
      const projectNode: JsonSelector = {
        type: "project",
        expression: left,
        projection: { type: "current" },
      };
      return this.parseProjectionRHS(projectNode);
    }

    if (bracketType === "slice") {
      // foo[0:5] - slice (creates projection)
      const sliceNode = this.parseSlice(left);
      return this.parseProjectionRHS(sliceNode);
    }

    if (bracketType === "index") {
      // foo[0] - index (no projection)
      this.ts.consume("lbracket");
      const index = parseInt(this.ts.consume("number").text, 10);
      this.ts.consume("rbracket");
      return {
        type: "indexAccess",
        expression: left,
        index,
      };
    }

    if (bracketType === "id") {
      // foo['id'] - id access (no projection)
      this.ts.consume("lbracket");
      const id = this.ts.consume("rawString").value;
      this.ts.consume("rbracket");
      return {
        type: "idAccess",
        expression: left,
        id,
      };
    }

    throw new Error("Invalid bracket expression");
  }

  /**
   * Parse filter expression with LHS: foo[?bar]
   */
  private parseFilterExpression(left: JsonSelector): JsonSelector {
    // Lexer may emit either a single "filterBracket" token or separate "lbracket" + "question"
    if (this.ts.tryConsume("filterBracket")) {
      // Combined [? token consumed
    } else {
      this.ts.consume("lbracket");
      this.ts.consume("question");
    }

    const condition = this.expression(0);
    this.ts.consume("rbracket");

    const filterNode: JsonSelector = {
      type: "filter",
      expression: left,
      condition,
    };

    return this.parseProjectionRHS(filterNode);
  }

  /**
   * Parse projection RHS: what comes after [*], [], [?...], or slice
   *
   * Key insight: After a projection, subsequent operations may either:
   * 1. Continue the projection chain (e.g., foo[].bar[].baz)
   * 2. Terminate the projection
   *
   * Uses PROJECTION_STOP_THRESHOLD to distinguish:
   * - Below threshold: terminators (pipe, or, and, comparisons, EOF, closing brackets)
   * - At/above threshold: continuation operators (flatten, filter, star, dot, bracket access)
   *
   * This allows proper precedence: `foo[] | bar` pipes the projection result,
   * while `foo[].bar` continues the projection to select .bar from each element.
   *
   * NOTE: Unlike jmespath which uses binding power (rbp) to control projection continuation,
   * we use a fixed threshold. This is because our AST structure is different: jmespath chains
   * projections (project(project(x, y), z)) while we nest them in the projection field
   * (project(x, project(y, z))). Both approaches produce the same JMESPath-compatible results,
   * but our nested structure creates clearer semantics for expressions like foo[*].bar[*].
   */
  private parseProjectionRHS(projectionNode: JsonSelector): JsonSelector {
    const nextBp = this.getBindingPower();

    // Terminators (bp < threshold) stop projection continuation
    if (nextBp < Parser.PROJECTION_STOP_THRESHOLD) {
      return projectionNode;
    }

    // Check what comes next
    const token = this.ts.peek();
    if (!token) return projectionNode;

    // Continue with dot, bracket, or filter - these are postfix operators
    // Parse them starting from @ (current context within the projection)
    if (
      token.type === "dot" ||
      token.type === "lbracket" ||
      token.type === "filterBracket"
    ) {
      // Start with @ (current element in projection) and build up the RHS expression
      let rhs: JsonSelector = { type: "current" };

      // Keep applying postfix operators until we hit a terminator
      while (this.getBindingPower() >= Parser.PROJECTION_STOP_THRESHOLD) {
        rhs = this.led(rhs);
      }

      // Update the projection to apply RHS to each element
      // [*] nodes already have a projection field, so update it directly
      if (projectionNode.type === "project") {
        return {
          ...projectionNode,
          projection: rhs,
        };
      }

      // flatten/filter/slice nodes don't have projection fields, so wrap them
      // This creates: project(flatten/filter/slice(...), rhs)
      return {
        type: "project",
        expression: projectionNode,
        projection: rhs,
      };
    }

    return projectionNode;
  }

  /**
   * Parse slice: [start:end] or [start:end:step]
   *
   * All three components are optional: [:] is valid.
   * Returns a slice node (creates a projection when wrapped by parseProjectionRHS).
   */
  private parseSlice(left: JsonSelector): JsonSelector {
    this.ts.consume("lbracket");

    let start: number | undefined;
    let end: number | undefined;
    let step: number | undefined;

    const startToken = this.ts.tryConsume("number");
    if (startToken) {
      start = parseInt(startToken.text, 10);
    }

    this.ts.consume("colon");

    const endToken = this.ts.tryConsume("number");
    if (endToken) {
      end = parseInt(endToken.text, 10);
    }

    if (this.ts.tryConsume("colon")) {
      const stepToken = this.ts.tryConsume("number");
      if (stepToken) {
        step = parseInt(stepToken.text, 10);
      }
    }

    this.ts.consume("rbracket");

    return {
      type: "slice",
      expression: left,
      start,
      end,
      step,
    };
  }

  private parseIdentifier(): string {
    const id = this.ts.tryConsume("identifier");
    if (id) return id.value;

    const quoted = this.ts.tryConsume("quotedString");
    if (quoted) return quoted.value;

    const token = this.ts.peek();
    throw new Error(`Expected identifier at position ${token?.offset}`);
  }

  /**
   * Parse JSON value inside backticks: `{...}`, `[...]`, `"..."`, etc.
   */
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

    const number = this.ts.tryConsume("number");
    if (number) {
      return parseFloat(number.text);
    }

    const quoted = this.ts.tryConsume("quotedString");
    if (quoted) {
      return quoted.value;
    }

    if (this.ts.is("lbracket")) {
      return this.parseJsonArray();
    }

    if (this.ts.is("lbrace")) {
      return this.parseJsonObject();
    }

    // Fallback: parse as unquoted string (non-standard, for backwards compatibility)
    // Consumes tokens until closing backtick
    return this.parseUnquotedJsonString();
  }

  private parseUnquotedJsonString(): string {
    let result = "";
    while (!this.ts.eof() && !this.ts.is("backtick")) {
      const token = this.ts.peek();
      if (!token) break;

      const quoted = this.ts.tryConsume("quotedString");
      if (quoted) {
        result += quoted.value;
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
    const key = this.ts.consume("quotedString").value;
    this.ts.consume("colon");
    const value = this.parseJsonValue();
    return [key, value];
  }
}
