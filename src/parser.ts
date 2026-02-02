import { JsonValue } from "type-fest";
import { JsonSelector, JsonSelectorCompareOperator } from "./ast";
import { TokenStream, TokenType } from "./lexer";

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
  // Use array indexed by TokenType for fast lookup
  private static readonly BINDING_POWER: number[] = (() => {
    const bp: number[] = new Array<number>(70).fill(0);

    // Terminators (lowest precedence) - already 0
    // TokenType.RPAREN, RBRACKET, RBRACE, COMMA - all 0

    // Binary operators (low to high)
    bp[TokenType.PIPE] = 1; // |
    bp[TokenType.OR] = 3; // ||
    bp[TokenType.AND] = 4; // &&

    // Comparison operators (all same precedence - non-associative, cannot chain)
    bp[TokenType.EQ] = 7; // ==
    bp[TokenType.NEQ] = 7; // !=
    bp[TokenType.LT] = 7; // <
    bp[TokenType.LTE] = 7; // <=
    bp[TokenType.GT] = 7; // >
    bp[TokenType.GTE] = 7; // >=

    // Projection operators
    // flatten has lower bp (9) than star/filter to allow chaining: foo[*][] or foo[?x][].bar
    // flatten is handled specially in getBindingPower()
    bp[TokenType.FILTER_BRACKET] = 21; // [?...]

    // Postfix operators (high precedence)
    bp[TokenType.DOT] = 40; // .

    // Prefix operators
    bp[TokenType.NOT] = 45; // !

    // Bracket access (highest) - handled specially in getBindingPower()

    return bp;
  })();

  // Special binding powers for context-dependent tokens
  private static readonly FLATTEN_BP = 9;
  private static readonly STAR_BP = 20;
  private static readonly LBRACKET_BP = 55;

  // Comparison operator token to AST operator mapping
  private static readonly COMPARE_OPS: JsonSelectorCompareOperator[] = (() => {
    const ops = new Array<JsonSelectorCompareOperator>(70);
    ops[TokenType.LTE] = "<=";
    ops[TokenType.GTE] = ">=";
    ops[TokenType.EQ] = "==";
    ops[TokenType.NEQ] = "!=";
    ops[TokenType.LT] = "<";
    ops[TokenType.GT] = ">";
    return ops;
  })();

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
    if (!token) return 0;

    // Brackets need lookahead to determine their binding power:
    // - [] (flatten) → bp=9 (low, allows chaining after projections)
    // - [*] (star) → bp=20 (medium, projection operator)
    // - [0], ['id'], [:] (index/id/slice) → bp=55 (highest, tightest binding)
    if (token.type === TokenType.LBRACKET) {
      const bracketType = this.ts.peekBracketType();
      if (bracketType === "flatten") {
        return Parser.FLATTEN_BP;
      }
      if (bracketType === "star") {
        return Parser.STAR_BP;
      }
      return Parser.LBRACKET_BP;
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
      case TokenType.NOT:
        this.ts.advance();
        return {
          type: "not",
          expression: this.expression(Parser.BINDING_POWER[TokenType.NOT]),
        };

      case TokenType.AT:
        this.ts.advance();
        return { type: "current" };

      case TokenType.DOLLAR:
        this.ts.advance();
        return { type: "root" };

      case TokenType.BACKTICK: {
        this.ts.advance();
        const value = this.parseJsonValue();
        this.ts.consume(TokenType.BACKTICK);
        return { type: "literal", value };
      }

      case TokenType.RAW_STRING:
        this.ts.advance();
        return { type: "literal", value: token.value };

      case TokenType.IDENTIFIER:
        this.ts.advance();
        return { type: "identifier", id: String(token.value) };

      case TokenType.QUOTED_STRING:
        this.ts.advance();
        return { type: "identifier", id: String(token.value) };

      case TokenType.LPAREN: {
        this.ts.advance();
        const expr = this.expression(0);
        this.ts.consume(TokenType.RPAREN);
        return expr;
      }

      case TokenType.LBRACKET:
        return this.parseLeadingBracket();

      case TokenType.FILTER_BRACKET:
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
    if (!token) {
      throw new Error("Unexpected end of input in led()");
    }

    switch (token.type) {
      case TokenType.PIPE: // bp=1
        this.ts.advance();
        return {
          type: "pipe",
          lhs: left,
          rhs: this.expression(Parser.BINDING_POWER[TokenType.PIPE]),
        };

      case TokenType.OR: // bp=3
        this.ts.advance();
        return {
          type: "or",
          lhs: left,
          rhs: this.expression(Parser.BINDING_POWER[TokenType.OR]),
        };

      case TokenType.AND: // bp=4
        this.ts.advance();
        return {
          type: "and",
          lhs: left,
          rhs: this.expression(Parser.BINDING_POWER[TokenType.AND]),
        };

      case TokenType.EQ: // bp=7
      case TokenType.NEQ:
      case TokenType.LT:
      case TokenType.LTE:
      case TokenType.GT:
      case TokenType.GTE: {
        const compareOp = Parser.COMPARE_OPS[token.type];
        this.ts.advance();
        return {
          type: "compare",
          operator: compareOp,
          lhs: left,
          rhs: this.expression(Parser.BINDING_POWER[token.type]),
        };
      }

      case TokenType.FILTER_BRACKET: // bp=21
        return this.parseFilterExpression(left);

      case TokenType.DOT: {
        // bp=40
        this.ts.advance();
        const field = this.parseIdentifier();
        return { type: "fieldAccess", expression: left, field };
      }

      case TokenType.LBRACKET: // bp=55
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
      this.ts.consume(TokenType.LBRACKET);
      this.ts.consume(TokenType.RBRACKET);
      const flattenNode: JsonSelector = {
        type: "flatten",
        expression: { type: "current" },
      };
      // Continue parsing RHS (e.g., [].foo)
      return this.parseProjectionRHS(flattenNode);
    }

    if (bracketType === "star") {
      // Leading [*] applies to @
      this.ts.consume(TokenType.LBRACKET);
      this.ts.consume(TokenType.STAR);
      this.ts.consume(TokenType.RBRACKET);
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
      this.ts.consume(TokenType.LBRACKET);
      const index = parseInt(this.ts.consume(TokenType.NUMBER).text, 10);
      this.ts.consume(TokenType.RBRACKET);
      return {
        type: "indexAccess",
        expression: { type: "current" },
        index,
      };
    }

    if (bracketType === "id") {
      // Leading ['id'] applies to @
      this.ts.consume(TokenType.LBRACKET);
      const id = String(this.ts.consume(TokenType.RAW_STRING).value);
      this.ts.consume(TokenType.RBRACKET);
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
    // Lexer emits FILTER_BRACKET token for [?
    this.ts.consume(TokenType.FILTER_BRACKET);

    const condition = this.expression(0);
    this.ts.consume(TokenType.RBRACKET);

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
      this.ts.consume(TokenType.LBRACKET);
      this.ts.consume(TokenType.RBRACKET);
      const flattenNode: JsonSelector = {
        type: "flatten",
        expression: left,
      };
      return this.parseProjectionRHS(flattenNode);
    }

    if (bracketType === "star") {
      // foo[*] - project
      this.ts.consume(TokenType.LBRACKET);
      this.ts.consume(TokenType.STAR);
      this.ts.consume(TokenType.RBRACKET);
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
      this.ts.consume(TokenType.LBRACKET);
      const index = parseInt(this.ts.consume(TokenType.NUMBER).text, 10);
      this.ts.consume(TokenType.RBRACKET);
      return {
        type: "indexAccess",
        expression: left,
        index,
      };
    }

    if (bracketType === "id") {
      // foo['id'] - id access (no projection)
      this.ts.consume(TokenType.LBRACKET);
      const id = String(this.ts.consume(TokenType.RAW_STRING).value);
      this.ts.consume(TokenType.RBRACKET);
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
    // Lexer emits FILTER_BRACKET token for [?
    this.ts.consume(TokenType.FILTER_BRACKET);

    const condition = this.expression(0);
    this.ts.consume(TokenType.RBRACKET);

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
      token.type === TokenType.DOT ||
      token.type === TokenType.LBRACKET ||
      token.type === TokenType.FILTER_BRACKET
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
    this.ts.consume(TokenType.LBRACKET);

    let start: number | undefined;
    let end: number | undefined;
    let step: number | undefined;

    const startToken = this.ts.tryConsume(TokenType.NUMBER);
    if (startToken) {
      start = parseInt(startToken.text, 10);
    }

    this.ts.consume(TokenType.COLON);

    const endToken = this.ts.tryConsume(TokenType.NUMBER);
    if (endToken) {
      end = parseInt(endToken.text, 10);
    }

    if (this.ts.tryConsume(TokenType.COLON)) {
      const stepToken = this.ts.tryConsume(TokenType.NUMBER);
      if (stepToken) {
        step = parseInt(stepToken.text, 10);
      }
    }

    this.ts.consume(TokenType.RBRACKET);

    return {
      type: "slice",
      expression: left,
      start,
      end,
      step,
    };
  }

  private parseIdentifier(): string {
    const id = this.ts.tryConsume(TokenType.IDENTIFIER);
    if (id) return String(id.value);

    const quoted = this.ts.tryConsume(TokenType.QUOTED_STRING);
    if (quoted) return String(quoted.value);

    const token = this.ts.peek();
    throw new Error(`Expected identifier at position ${token?.offset}`);
  }

  /**
   * Parse JSON value inside backticks: `{...}`, `[...]`, `"..."`, etc.
   */
  private parseJsonValue(): JsonValue {
    if (this.ts.tryConsume(TokenType.NULL)) {
      return null;
    }

    if (this.ts.tryConsume(TokenType.TRUE)) {
      return true;
    }

    if (this.ts.tryConsume(TokenType.FALSE)) {
      return false;
    }

    const number = this.ts.tryConsume(TokenType.NUMBER);
    if (number) {
      return parseFloat(number.text);
    }

    const quoted = this.ts.tryConsume(TokenType.QUOTED_STRING);
    if (quoted) {
      return String(quoted.value);
    }

    if (this.ts.is(TokenType.LBRACKET)) {
      return this.parseJsonArray();
    }

    if (this.ts.is(TokenType.LBRACE)) {
      return this.parseJsonObject();
    }

    // Fallback: parse as unquoted string (non-standard, for backwards compatibility)
    // Consumes tokens until closing backtick
    return this.parseUnquotedJsonString();
  }

  private parseUnquotedJsonString(): string {
    let result = "";
    while (!this.ts.eof() && !this.ts.is(TokenType.BACKTICK)) {
      const token = this.ts.peek();
      if (!token) break;

      const quoted = this.ts.tryConsume(TokenType.QUOTED_STRING);
      if (quoted) {
        result += String(quoted.value);
      } else {
        result += token.text;
        this.ts.advance();
      }
    }
    return result.trim();
  }

  private parseJsonArray(): JsonValue[] {
    this.ts.consume(TokenType.LBRACKET);

    const values: JsonValue[] = [];

    if (!this.ts.is(TokenType.RBRACKET)) {
      values.push(this.parseJsonValue());

      while (this.ts.tryConsume(TokenType.COMMA)) {
        values.push(this.parseJsonValue());
      }
    }

    this.ts.consume(TokenType.RBRACKET);
    return values;
  }

  private parseJsonObject(): Record<string, JsonValue> {
    this.ts.consume(TokenType.LBRACE);

    const obj: Record<string, JsonValue> = {};

    if (!this.ts.is(TokenType.RBRACE)) {
      const [key, value] = this.parseJsonMember();
      obj[key] = value;

      while (this.ts.tryConsume(TokenType.COMMA)) {
        const [k, v] = this.parseJsonMember();
        obj[k] = v;
      }
    }

    this.ts.consume(TokenType.RBRACE);
    return obj;
  }

  private parseJsonMember(): [string, JsonValue] {
    const key = String(this.ts.consume(TokenType.QUOTED_STRING).value);
    this.ts.consume(TokenType.COLON);
    const value = this.parseJsonValue();
    return [key, value];
  }
}
