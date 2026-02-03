import { JsonValue } from "type-fest";
import { JsonSelector, JsonSelectorCurrent, JsonSelectorRoot } from "./ast";
import { Lexer } from "./lexer";
import { Token, TOKEN_LIMIT, TokenType } from "./token";

// Pre-computed singleton AST nodes
const CURRENT_NODE: Readonly<JsonSelectorCurrent> = Object.freeze({
  type: "current",
});
const ROOT_NODE: Readonly<JsonSelectorRoot> = Object.freeze({
  type: "root",
});

// Binding power constants (higher = tighter binding)
const BP_PIPE = 1;
const BP_OR = 3;
const BP_AND = 4;
const BP_COMPARE = 7;
const BP_FLATTEN = 9;
const BP_FILTER = 21;
const BP_DOT = 40;
const BP_NOT = 45;
const BP_BRACKET = 55;

// Projection stop threshold: operators below this terminate projections
// Separates terminators (pipe, or, and, comparisons) from continuators (dot, brackets)
const PROJECTION_STOP_BP = 10;

// Binding power table (higher = tighter binding)
// Use array indexed by TokenType for fast lookup
const TOKEN_BP: number[] = (() => {
  const bp: number[] = new Array<number>(TOKEN_LIMIT).fill(0);

  // Terminators (lowest precedence) - already 0
  // TokenType.RPAREN, RBRACKET, RBRACE, COMMA - all 0

  // Binary operators (low to high)
  bp[TokenType.PIPE] = BP_PIPE; // |
  bp[TokenType.OR] = BP_OR; // ||
  bp[TokenType.AND] = BP_AND; // &&

  // Comparison operators (all same precedence - non-associative, cannot chain)
  bp[TokenType.EQ] = BP_COMPARE; // ==
  bp[TokenType.NEQ] = BP_COMPARE; // !=
  bp[TokenType.LT] = BP_COMPARE; // <
  bp[TokenType.LTE] = BP_COMPARE; // <=
  bp[TokenType.GT] = BP_COMPARE; // >
  bp[TokenType.GTE] = BP_COMPARE; // >=

  // Projection operators
  // flatten has lower bp (9) than star/filter to allow chaining: foo[*][] or foo[?x][].bar
  bp[TokenType.FLATTEN_BRACKET] = BP_FLATTEN; // []
  bp[TokenType.FILTER_BRACKET] = BP_FILTER; // [?...]

  // Postfix operators (high precedence)
  bp[TokenType.DOT] = BP_DOT; // .

  // Prefix operators
  bp[TokenType.NOT] = BP_NOT; // !

  // Bracket access (highest)
  bp[TokenType.LBRACKET] = BP_BRACKET; // [n], ['id'], [n:], etc.

  return bp;
})();

/**
 * Pratt Parser for JSON Selectors
 *
 * Uses precedence-climbing (Pratt parsing) with binding power (0-55 range) to handle
 * operator precedence efficiently. The parser uses two main methods:
 * - nud() for prefix/primary expressions (no left context)
 * - led() for infix/postfix operators (with left context)
 */
export class Parser {
  private readonly lexer: Lexer;

  constructor(input: string) {
    this.lexer = new Lexer(input);
  }

  /**
   * Main entry point: parse a complete expression
   */
  parse(): JsonSelector {
    const result = this.expression(0);
    const token = this.lexer.peek();
    if (token.type !== TokenType.EOF) {
      throw new Error(
        `Unexpected token at position ${token.offset}: ${token.text}`,
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

    // Inline binding power check - hot path optimization
    let token = this.lexer.peek();
    while (token.type !== TokenType.EOF && rbp < TOKEN_BP[token.type]) {
      left = this.led(left, token);
      token = this.lexer.peek();
    }

    return left;
  }

  /**
   * NUD (Null Denotation): Handle prefix operators and primary expressions
   * Called when we don't have a left-hand side yet
   */
  private nud(): JsonSelector {
    const token = this.lexer.peek();
    if (token.type === TokenType.EOF) {
      throw new Error("Unexpected end of input");
    }

    switch (token.type) {
      // Hot path: field names (most common)
      case TokenType.IDENTIFIER:
        this.lexer.advance();
        return { type: "identifier", id: token.value };

      case TokenType.QUOTED_STRING:
        this.lexer.advance();
        return { type: "identifier", id: token.value };

      case TokenType.AT:
        this.lexer.advance();
        return CURRENT_NODE;

      case TokenType.LBRACKET:
        return this.parseBracketExpression();

      case TokenType.FLATTEN_BRACKET: {
        // Leading [] applies to @
        this.lexer.consume(TokenType.FLATTEN_BRACKET);
        const flattenNode: JsonSelector = {
          type: "flatten",
          expression: CURRENT_NODE,
        };
        return this.parseProjectionRHS(flattenNode);
      }

      case TokenType.FILTER_BRACKET:
        return this.parseFilterExpression();

      case TokenType.DOLLAR:
        this.lexer.advance();
        return ROOT_NODE;

      case TokenType.RAW_STRING:
        this.lexer.advance();
        return { type: "literal", value: token.value };

      case TokenType.BACKTICK_LITERAL: {
        this.lexer.advance();
        const content = token.value.trim();
        try {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const value = JSON.parse(content) as JsonValue;
          return { type: "literal", value };
        } catch {
          // Fallback: parse as unquoted string (legacy compatibility)
          return { type: "literal", value: content };
        }
      }

      case TokenType.NOT:
        this.lexer.advance();
        return {
          type: "not",
          expression: this.expression(BP_NOT),
        };

      case TokenType.LPAREN: {
        this.lexer.advance();
        const expr = this.expression(0);
        this.lexer.consume(TokenType.RPAREN);
        return expr;
      }

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
  private led(left: JsonSelector, token: Token): JsonSelector {
    switch (token.type) {
      // Hot path: field access (most common!)
      case TokenType.DOT: {
        this.lexer.advance();
        const field = this.parseIdentifier();
        return { type: "fieldAccess", expression: left, field };
      }

      case TokenType.LBRACKET:
        return this.parseBracketExpression(left);

      case TokenType.FLATTEN_BRACKET: {
        this.lexer.consume(TokenType.FLATTEN_BRACKET);
        const flattenNode: JsonSelector = {
          type: "flatten",
          expression: left,
        };
        return this.parseProjectionRHS(flattenNode);
      }

      case TokenType.FILTER_BRACKET:
        return this.parseFilterExpression(left);

      case TokenType.PIPE:
        this.lexer.advance();
        return {
          type: "pipe",
          lhs: left,
          rhs: this.expression(BP_PIPE),
        };

      case TokenType.AND:
        this.lexer.advance();
        return {
          type: "and",
          lhs: left,
          rhs: this.expression(BP_AND),
        };

      case TokenType.OR:
        this.lexer.advance();
        return {
          type: "or",
          lhs: left,
          rhs: this.expression(BP_OR),
        };

      case TokenType.EQ:
        this.lexer.advance();
        return {
          type: "compare",
          operator: "==",
          lhs: left,
          rhs: this.expression(BP_COMPARE),
        };

      case TokenType.NEQ:
        this.lexer.advance();
        return {
          type: "compare",
          operator: "!=",
          lhs: left,
          rhs: this.expression(BP_COMPARE),
        };

      case TokenType.LT:
        this.lexer.advance();
        return {
          type: "compare",
          operator: "<",
          lhs: left,
          rhs: this.expression(BP_COMPARE),
        };

      case TokenType.LTE:
        this.lexer.advance();
        return {
          type: "compare",
          operator: "<=",
          lhs: left,
          rhs: this.expression(BP_COMPARE),
        };

      case TokenType.GT:
        this.lexer.advance();
        return {
          type: "compare",
          operator: ">",
          lhs: left,
          rhs: this.expression(BP_COMPARE),
        };

      case TokenType.GTE:
        this.lexer.advance();
        return {
          type: "compare",
          operator: ">=",
          lhs: left,
          rhs: this.expression(BP_COMPARE),
        };

      default:
        throw new Error(
          `Unexpected token at position ${token.offset}: ${token.text}`,
        );
    }
  }

  /**
   * Parse bracket expression: foo[0], foo[:], foo[*], foo['id']
   * Also handles leading brackets (no LHS): [0], [:], [*], ['id']
   *
   * When a bracket appears at the start of an expression or after an operator,
   * it implicitly applies to @ (current context). For example:
   * - `[0]` means `@[0]`
   * - `foo | [*]` means `foo | @[*]`
   *
   * Note: foo[] (flatten) is handled separately via FLATTEN_BRACKET token in led()
   */
  private parseBracketExpression(
    left: JsonSelector = CURRENT_NODE,
  ): JsonSelector {
    // Must be LBRACKET - consume it and check what follows
    this.lexer.consume(TokenType.LBRACKET);

    const token = this.lexer.peek();
    switch (token.type) {
      case TokenType.STAR: {
        // foo[*] - project
        this.lexer.consume(TokenType.STAR);
        this.lexer.consume(TokenType.RBRACKET);
        const projectNode: JsonSelector = {
          type: "project",
          expression: left,
          projection: CURRENT_NODE,
        };
        return this.parseProjectionRHS(projectNode);
      }

      case TokenType.RAW_STRING: {
        // foo['id'] - id access (no projection)
        const id = this.lexer.consume(TokenType.RAW_STRING).value;
        this.lexer.consume(TokenType.RBRACKET);
        return {
          type: "idAccess",
          expression: left,
          id,
        };
      }

      case TokenType.NUMBER: {
        const num = this.lexer.consume(TokenType.NUMBER).value;
        if (this.lexer.peek().type === TokenType.COLON) {
          // Slice: foo[n:...]
          const sliceNode = this.parseSlice(left, num);
          return this.parseProjectionRHS(sliceNode);
        }
        // Index: foo[n]
        this.lexer.consume(TokenType.RBRACKET);
        return {
          type: "indexAccess",
          expression: left,
          index: num,
        };
      }

      case TokenType.COLON: {
        // Slice starting with colon: foo[:n] or foo[:]
        const sliceNode = this.parseSlice(left);
        return this.parseProjectionRHS(sliceNode);
      }

      default:
        throw new Error(
          `Unexpected token after '[' at position ${token.offset}: ${token.text}`,
        );
    }
  }

  /**
   * Parse filter expression: foo[?bar]
   * Also handles leading filter expression (no LHS): [?...]
   *
   * When [? appears without a left-hand side, it implicitly applies to @ (current context).
   * Example: `[?x > 5]` means `@[?x > 5]`
   */
  private parseFilterExpression(
    left: JsonSelector = CURRENT_NODE,
  ): JsonSelector {
    // Lexer emits FILTER_BRACKET token for [?
    this.lexer.consume(TokenType.FILTER_BRACKET);

    const condition = this.expression(0);
    this.lexer.consume(TokenType.RBRACKET);

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
    // Check what comes next - inline binding power check
    const token = this.lexer.peek();
    if (token.type === TokenType.EOF) {
      return projectionNode;
    }

    const nextBp = TOKEN_BP[token.type];

    // Terminators (bp < threshold) stop projection continuation
    if (nextBp < PROJECTION_STOP_BP) {
      return projectionNode;
    }

    // Continue with dot, bracket, flatten, or filter - these are postfix operators
    // Parse them starting from @ (current context within the projection)
    if (
      token.type === TokenType.DOT ||
      token.type === TokenType.LBRACKET ||
      token.type === TokenType.FLATTEN_BRACKET ||
      token.type === TokenType.FILTER_BRACKET
    ) {
      // Start with @ (current element in projection) and build up the RHS expression
      let rhs: JsonSelector = CURRENT_NODE;

      // Keep applying postfix operators until we hit a terminator
      let rhsToken = this.lexer.peek();
      while (
        rhsToken.type !== TokenType.EOF &&
        TOKEN_BP[rhsToken.type] >= PROJECTION_STOP_BP
      ) {
        rhs = this.led(rhs, rhsToken);
        rhsToken = this.lexer.peek();
      }

      // Update the projection to apply RHS to each element
      // [*] nodes already have a projection field, so update it directly
      if (projectionNode.type === "project") {
        projectionNode.projection = rhs;
        return projectionNode;
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
   * Parse slice after [ and optional start have been consumed: [start:end:step]
   *
   * Called when pattern is [:...] (start undefined) or [n:...] (start known).
   */
  private parseSlice(left: JsonSelector, start?: number): JsonSelector {
    // [ and optional start NUMBER already consumed, current token should be COLON
    this.lexer.consume(TokenType.COLON);

    let end: number | undefined;
    let step: number | undefined;

    const endToken = this.lexer.tryConsume(TokenType.NUMBER);
    if (endToken) {
      end = endToken.value;
    }

    if (this.lexer.tryConsume(TokenType.COLON)) {
      const stepToken = this.lexer.tryConsume(TokenType.NUMBER);
      if (stepToken) {
        step = stepToken.value;
      }
    }

    this.lexer.consume(TokenType.RBRACKET);

    return {
      type: "slice",
      expression: left,
      start,
      end,
      step,
    };
  }

  private parseIdentifier(): string {
    const id = this.lexer.tryConsume(TokenType.IDENTIFIER);
    if (id) {
      return id.value;
    }

    const quoted = this.lexer.tryConsume(TokenType.QUOTED_STRING);
    if (quoted) {
      return quoted.value;
    }

    const token = this.lexer.peek();
    throw new Error(`Expected identifier at position ${token.offset}`);
  }
}
