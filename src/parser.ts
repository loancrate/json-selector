import { JsonValue } from "type-fest";

import {
  JsonSelector,
  JsonSelectorArithmeticOperator,
  JsonSelectorCompareOperator,
  JsonSelectorCurrent,
  JsonSelectorRoot,
} from "./ast";
import {
  InvalidTokenError,
  UnexpectedEndOfInputError,
  UnexpectedTokenError,
} from "./errors";
import { isWhitespace, Lexer } from "./lexer";
import { EOF_DESCRIPTION, Token, TOKEN_LIMIT, TokenType } from "./token";

// Pre-computed singleton AST nodes
const CURRENT_NODE: Readonly<JsonSelectorCurrent> = Object.freeze({
  type: "current",
});
const ROOT_NODE: Readonly<JsonSelectorRoot> = Object.freeze({
  type: "root",
});

// Binding power constants (higher = tighter binding)
const BP_PIPE = 1;
const BP_TERNARY = 2;
const BP_OR = 3;
const BP_AND = 4;
const BP_COMPARE = 5;
const BP_ADD = 6;
const BP_MUL = 7;
const BP_FLATTEN = 9;
const BP_FILTER = 21;
const BP_DOT = 40;
const BP_NOT = 45;
const BP_BRACKET = 55;

// Projection stop threshold: operators below this terminate projections
// Separates terminators (pipe, ternary, or, and, comparisons) from continuators (dot, brackets)
const PROJECTION_STOP_BP = 10;

// Binding power table (higher = tighter binding)
// Use array indexed by TokenType for fast lookup
const TOKEN_BP: number[] = (() => {
  const bp: number[] = new Array<number>(TOKEN_LIMIT).fill(0);

  // Terminators (lowest precedence) - already 0
  // TokenType.RPAREN, RBRACKET, RBRACE, COMMA - all 0

  // Binary operators (low to high)
  bp[TokenType.PIPE] = BP_PIPE; // |
  bp[TokenType.QUESTION] = BP_TERNARY; // ?:
  bp[TokenType.OR] = BP_OR; // ||
  bp[TokenType.AND] = BP_AND; // &&

  // Comparison operators (all same precedence - non-associative, cannot chain)
  bp[TokenType.EQ] = BP_COMPARE; // ==
  bp[TokenType.NEQ] = BP_COMPARE; // !=
  bp[TokenType.LT] = BP_COMPARE; // <
  bp[TokenType.LTE] = BP_COMPARE; // <=
  bp[TokenType.GT] = BP_COMPARE; // >
  bp[TokenType.GTE] = BP_COMPARE; // >=
  bp[TokenType.PLUS] = BP_ADD; // +
  bp[TokenType.MINUS] = BP_ADD; // -
  bp[TokenType.STAR] = BP_MUL; // * (multiplication in led context)
  bp[TokenType.MULTIPLY] = BP_MUL; // ×
  bp[TokenType.DIVIDE] = BP_MUL; // /, ÷
  bp[TokenType.MODULO] = BP_MUL; // %
  bp[TokenType.INT_DIVIDE] = BP_MUL; // //

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

export interface ParserOptions {
  /** Requires valid JSON content in backtick literals; throws on invalid JSON instead of falling back to a string. */
  strictJsonLiterals?: boolean;
  /** Enables backslash escape in raw strings (both \' and \\ are unescaped). Defaults to true. */
  rawStringBackslashEscape?: boolean;
}

/**
 * Hand-written parser for JSON Selectors.
 *
 * Uses precedence-climbing (Pratt parsing) with binding power (0-55 range) to handle
 * operator precedence efficiently. The parser uses two main methods:
 * - nud() for prefix/primary expressions (no left context)
 * - led() for infix/postfix operators (with left context)
 */
export class Parser {
  private readonly input: string;
  private readonly lexer: Lexer;
  private readonly strictJsonLiterals: boolean;

  constructor(input: string, options?: ParserOptions) {
    this.input = input;
    this.lexer = new Lexer(input, {
      rawStringBackslashEscape: options?.rawStringBackslashEscape,
    });
    this.strictJsonLiterals = options?.strictJsonLiterals === true;
  }

  /**
   * Main entry point: parse a complete expression
   */
  parse(): JsonSelector {
    const result = this.expression(0);
    const token = this.lexer.peek();
    if (token.type !== TokenType.EOF) {
      throw this.unexpectedToken(token, EOF_DESCRIPTION);
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
    return this.expressionFrom(this.nud(), rbp);
  }

  /**
   * Continue Pratt parsing from a given left-hand side node.
   * Applies led (left denotation) operators while their binding power exceeds rbp.
   */
  private expressionFrom(left: JsonSelector, rbp: number): JsonSelector {
    let current = left;
    let token = this.lexer.peek();
    while (token.type !== TokenType.EOF && rbp < TOKEN_BP[token.type]) {
      current = this.led(current, token);
      token = this.lexer.peek();
    }
    return current;
  }

  /**
   * NUD (Null Denotation): Handle prefix operators and primary expressions
   * Called when we don't have a left-hand side yet
   */
  private nud(): JsonSelector {
    const token = this.lexer.peek();
    if (token.type === TokenType.EOF) {
      throw new UnexpectedEndOfInputError(this.input);
    }

    switch (token.type) {
      // Hot path: field names (most common) or function calls
      case TokenType.IDENTIFIER: {
        this.lexer.advance();
        // Check if this is a function call (identifier followed by `(`)
        if (this.lexer.peek().type === TokenType.LPAREN) {
          return this.parseFunctionCall(token.value);
        }
        // Contextual keyword: let expressions
        if (
          token.value === "let" &&
          this.lexer.peek().type === TokenType.VARIABLE
        ) {
          return this.parseLetExpression();
        }
        return { type: "identifier", id: token.value };
      }

      case TokenType.QUOTED_STRING:
        this.lexer.advance();
        return { type: "identifier", id: token.value };

      case TokenType.AT:
        this.lexer.advance();
        return { type: "current", explicit: true };

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

      case TokenType.VARIABLE:
        this.lexer.advance();
        return { type: "variableRef", name: token.value };

      case TokenType.RAW_STRING:
      case TokenType.TRUE:
      case TokenType.FALSE:
      case TokenType.NULL:
      case TokenType.NUMBER:
        this.lexer.advance();
        return { type: "literal", value: token.value };

      case TokenType.BACKTICK_LITERAL: {
        this.lexer.advance();
        const content = trimJsonWhitespace(token.value);
        try {
          // Type assertion is safe as JSON.parse returns a JsonValue
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const value = JSON.parse(content) as JsonValue;
          return { type: "literal", value, backtickSyntax: true };
        } catch {
          if (this.strictJsonLiterals) {
            throw new InvalidTokenError(
              this.input,
              token.offset,
              "JSON literal",
              "expected valid JSON content between backticks",
            );
          }
          return {
            type: "literal",
            value: content.replace(/\\"/g, '"'),
            backtickSyntax: true,
          };
        }
      }

      case TokenType.NOT:
        this.lexer.advance();
        return {
          type: "not",
          expression: this.expression(BP_NOT),
        };

      case TokenType.PLUS:
        this.lexer.advance();
        return this.foldUnaryArithmeticLiteral("+", this.expression(BP_ADD));

      case TokenType.MINUS:
        this.lexer.advance();
        return this.foldUnaryArithmeticLiteral("-", this.expression(BP_ADD));

      case TokenType.LPAREN: {
        this.lexer.advance();
        const expr = this.expression(0);
        this.lexer.consume(TokenType.RPAREN);
        return expr;
      }

      case TokenType.LBRACE:
        // Multi-select hash: {a: x, b: y}
        return this.parseMultiSelectHash();

      case TokenType.STAR: {
        // Root object projection: * or *.foo
        this.lexer.advance();
        return this.parseObjectProjection(CURRENT_NODE);
      }

      case TokenType.AMPERSAND: {
        // Expression reference: &expr (for sort_by, max_by, etc.)
        // Use binding power 0 to capture the full expression (up to comma or closing bracket)
        this.lexer.advance();
        return {
          type: "expressionRef",
          expression: this.expression(0),
        };
      }

      default:
        throw this.unexpectedToken(token, "expression");
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
        const nextToken = this.lexer.peek();

        // Object projection: foo.*
        if (nextToken.type === TokenType.STAR) {
          this.lexer.advance();
          return this.parseObjectProjection(left);
        }

        // Multi-select hash: foo.{a: x, b: y}
        if (nextToken.type === TokenType.LBRACE) {
          const multiSelectHash = this.parseMultiSelectHash();
          return {
            type: "pipe",
            lhs: left,
            rhs: multiSelectHash,
            dotSyntax: true,
          };
        }

        // Multi-select list: foo.[a, b]
        if (nextToken.type === TokenType.LBRACKET) {
          return this.parseDotBracket(left);
        }

        // Standard field access or function call
        const field = this.parseIdentifier();

        // Check if this is a function call: foo.func(args)
        // This is equivalent to: foo | func(args)
        if (this.lexer.peek().type === TokenType.LPAREN) {
          const funcCall = this.parseFunctionCall(field);
          return {
            type: "pipe",
            lhs: left,
            rhs: funcCall,
            dotSyntax: true,
          };
        }

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

      case TokenType.PLUS:
        return this.parseArithmetic(left, "+", BP_ADD);

      case TokenType.MINUS:
        return this.parseArithmetic(left, "-", BP_ADD);

      case TokenType.STAR:
      case TokenType.MULTIPLY:
        return this.parseArithmetic(left, "*", BP_MUL);

      case TokenType.DIVIDE:
        return this.parseArithmetic(left, "/", BP_MUL);

      case TokenType.MODULO:
        return this.parseArithmetic(left, "%", BP_MUL);

      case TokenType.INT_DIVIDE:
        return this.parseArithmetic(left, "//", BP_MUL);

      case TokenType.QUESTION: {
        this.lexer.advance();
        const consequent = this.expression(0);
        this.lexer.consume(TokenType.COLON);
        return {
          type: "ternary",
          condition: left,
          consequent,
          // NOTE: This differs from jmespath-community/typescript-jmespath, which
          // parses the false branch with expression(0).
          //
          // We intentionally parse with BP_TERNARY - 1 so the current ternary keeps
          // ownership of lower-precedence operators like pipe. This yields:
          //   a ? b : c | d  =>  (a ? b : c) | d
          //
          // This follows JEP-21 exactly:
          // - "higher precedence than the `|` pipe expression and lower precedence
          //   than the `||` and `&&` logical expressions"
          // - "Expressions within a ternary conditional expression are evaluated
          //   using a right-associative reading."
          // Spec: https://github.com/jmespath-community/jmespath.spec/blob/main/jep-0021-ternary-conditionals.md
          alternate: this.expression(BP_TERNARY - 1),
        };
      }

      case TokenType.EQ:
        return this.parseCompare(left, "==");

      case TokenType.NEQ:
        return this.parseCompare(left, "!=");

      case TokenType.LT:
        return this.parseCompare(left, "<");

      case TokenType.LTE:
        return this.parseCompare(left, "<=");

      case TokenType.GT:
        return this.parseCompare(left, ">");

      case TokenType.GTE:
        return this.parseCompare(left, ">=");

      default:
        throw this.unexpectedToken(token);
    }
  }

  /**
   * Parse lexical scope expression:
   *   let $a = expr, $b = expr in body
   *
   * Called after consuming contextual "let".
   */
  private parseLetExpression(): JsonSelector {
    const bindings: Array<{ name: string; value: JsonSelector }> = [];

    do {
      const variable = this.lexer.consume(TokenType.VARIABLE);
      this.lexer.consume(TokenType.ASSIGN);
      bindings.push({
        name: variable.value,
        value: this.expression(0),
      });
    } while (this.lexer.tryConsume(TokenType.COMMA));

    const token = this.lexer.peek();
    if (token.type !== TokenType.IDENTIFIER || token.value !== "in") {
      throw this.unexpectedToken(token, "'in'", "after let bindings");
    }
    this.lexer.advance();

    return {
      type: "let",
      bindings,
      expression: this.expression(0),
    };
  }

  private parseCompare(
    left: JsonSelector,
    operator: JsonSelectorCompareOperator,
  ): JsonSelector {
    this.lexer.advance();
    return {
      type: "compare",
      operator,
      lhs: left,
      rhs: this.expression(BP_COMPARE),
    };
  }

  private parseArithmetic(
    left: JsonSelector,
    operator: JsonSelectorArithmeticOperator,
    bp: number,
  ): JsonSelector {
    this.lexer.advance();
    return {
      type: "arithmetic",
      operator,
      lhs: left,
      rhs: this.expression(bp),
    };
  }

  private foldUnaryArithmeticLiteral(
    operator: "+" | "-",
    expression: JsonSelector,
  ): JsonSelector {
    if (expression.type === "literal" && typeof expression.value === "number") {
      const value = operator === "+" ? expression.value : -expression.value;
      return {
        type: "literal",
        value,
        ...(expression.backtickSyntax !== undefined && {
          backtickSyntax: expression.backtickSyntax,
        }),
      };
    }
    return {
      type: "unaryArithmetic",
      operator,
      expression,
    };
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
        // At root level, [*...] could be:
        // - [*] = array projection
        // - [*.*] = multi-select list containing object projection chain
        // We need to lookahead to distinguish
        this.lexer.consume(TokenType.STAR);

        // Check what comes after *
        const nextToken = this.lexer.peek();
        if (nextToken.type === TokenType.RBRACKET) {
          // [*] - array projection
          this.lexer.consume(TokenType.RBRACKET);
          const projectNode: JsonSelector = {
            type: "project",
            expression: left,
            projection: CURRENT_NODE,
          };
          return this.parseProjectionRHS(projectNode);
        }

        // Not just [*], so this is multi-select list starting with * expression
        // We've already consumed *, so we need to build the expression from there
        if (left !== CURRENT_NODE) {
          // foo[*.something] is not valid - multi-select list after expression needs .[
          throw this.unexpectedToken(nextToken, "']'", "after '[*'");
        }

        // Build the rest of the * expression and continue parsing multi-select list
        const starExpr = this.expressionFrom(
          {
            type: "objectProject",
            expression: CURRENT_NODE,
            projection: CURRENT_NODE,
          },
          0,
        );

        return this.parseMultiSelectListFromBracket(starExpr);
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

      case TokenType.NUMBER:
        return this.parseIndexOrSlice(
          left,
          this.lexer.consume(TokenType.NUMBER).value,
        );

      case TokenType.MINUS: {
        this.lexer.consume(TokenType.MINUS);

        const numberToken = this.lexer.tryConsume(TokenType.NUMBER);
        if (numberToken) {
          return this.parseIndexOrSlice(left, -numberToken.value);
        }

        // Root multi-select list can still start with unary minus (e.g. [-foo])
        if (left !== CURRENT_NODE) {
          const nextToken = this.lexer.peek();
          throw this.unexpectedToken(nextToken, "number", "after '[-'");
        }

        return this.parseMultiSelectListFromBracket(
          this.foldUnaryArithmeticLiteral("-", this.expression(BP_ADD)),
        );
      }

      case TokenType.COLON: {
        // Slice starting with colon: foo[:n] or foo[:]
        const sliceNode = this.parseSlice(left);
        return this.parseProjectionRHS(sliceNode);
      }

      default: {
        // Multi-select list: [expr1, expr2, ...]
        // Only valid at root level (left === CURRENT_NODE), not after foo[
        // Requires foo.[a, b] syntax, not foo[a, b]
        if (left !== CURRENT_NODE) {
          throw this.unexpectedToken(
            token,
            "number, ':', '*', or string",
            "after '['",
          );
        }

        return this.parseMultiSelectListFromBracket(this.expression(0));
      }
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
   * - Below threshold: terminators (pipe, ternary, or, and, comparisons, EOF, closing brackets)
   * - At/above threshold: continuation operators (flatten, filter, star, dot, bracket access)
   *
   * This allows proper precedence: `foo[] | bar` pipes the projection result,
   * while `foo[].bar` continues the projection to select .bar from each element.
   *
   * NOTE: Unlike the reference implementation which uses binding power (rbp) to control
   * projection continuation, we use a fixed threshold. This is because our AST structure is
   * different: the reference chains projections (project(project(x, y), z)) while we nest
   * them in the projection field (project(x, project(y, z))). Both approaches produce the same results,
   * but our nested structure creates clearer semantics for expressions like foo[*].bar[*].
   */
  private parseProjectionRHS(projectionNode: JsonSelector): JsonSelector {
    const rhs = this.parseProjectionContinuation();
    if (rhs === undefined) {
      return projectionNode;
    }

    // [*] nodes already have a projection field, so update it directly
    //
    // SAFETY: This mutation is safe because projectionNode is freshly created
    // in parseBracketExpression, parseFilterExpression, or parseSlice,
    // and has not been shared or returned yet.
    if (projectionNode.type === "project") {
      projectionNode.projection = rhs;
      return projectionNode;
    }

    // flatten/filter/slice nodes don't have projection fields, so wrap them
    return {
      type: "project",
      expression: projectionNode,
      projection: rhs,
    };
  }

  /**
   * Parse the continuation of a projection: the chain of postfix operators
   * (dot, bracket, filter) that apply to each projected element.
   *
   * Returns undefined if the next token does not continue the projection
   * (e.g. pipe, comparison, EOF, or closing brackets).
   */
  private parseProjectionContinuation(): JsonSelector | undefined {
    const token = this.lexer.peek();
    if (
      token.type !== TokenType.DOT &&
      token.type !== TokenType.LBRACKET &&
      token.type !== TokenType.FILTER_BRACKET
    ) {
      return undefined;
    }
    return this.expressionFrom(CURRENT_NODE, PROJECTION_STOP_BP - 1);
  }

  /**
   * Parse slice after [ and optional start have been consumed: [start:end:step]
   *
   * Called when pattern is [:...] (start undefined) or [n:...] / [-n:...] (start known).
   */
  private parseSlice(left: JsonSelector, start?: number): JsonSelector {
    // [ and optional start already consumed, current token should be COLON
    this.lexer.consume(TokenType.COLON);

    const end = this.tryConsumeSignedNumber();
    let step: number | undefined;

    if (this.lexer.tryConsume(TokenType.COLON)) {
      step = this.tryConsumeSignedNumber();
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

  /**
   * After consuming [ and a number, determine if this is an index or slice.
   */
  private parseIndexOrSlice(left: JsonSelector, num: number): JsonSelector {
    if (this.lexer.peek().type === TokenType.COLON) {
      return this.parseProjectionRHS(this.parseSlice(left, num));
    }
    this.lexer.consume(TokenType.RBRACKET);
    return { type: "indexAccess", expression: left, index: num };
  }

  private tryConsumeSignedNumber(): number | undefined {
    const token = this.lexer.peek();

    if (token.type === TokenType.NUMBER) {
      return this.lexer.consume(TokenType.NUMBER).value;
    }

    if (token.type === TokenType.PLUS || token.type === TokenType.MINUS) {
      const sign = token.type === TokenType.MINUS ? -1 : 1;
      this.lexer.advance();
      const numberToken = this.lexer.tryConsume(TokenType.NUMBER);
      if (!numberToken) {
        const nextToken = this.lexer.peek();
        throw this.unexpectedToken(nextToken, "number");
      }
      return sign * numberToken.value;
    }

    return undefined;
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
    throw this.unexpectedToken(token, "identifier");
  }

  /**
   * Parse comma-separated expressions and closing bracket into a multi-select list.
   * Called after the first expression has already been parsed.
   */
  private parseMultiSelectListFromBracket(first: JsonSelector): JsonSelector {
    const expressions = [first];
    while (this.lexer.tryConsume(TokenType.COMMA)) {
      expressions.push(this.expression(0));
    }
    this.lexer.consume(TokenType.RBRACKET);
    return { type: "multiSelectList", expressions };
  }

  /**
   * Parse function call: name(arg1, arg2, ...)
   * Called after identifier has been consumed and ( has been peeked
   */
  private parseFunctionCall(name: string): JsonSelector {
    this.lexer.consume(TokenType.LPAREN);

    const args: JsonSelector[] = [];

    // Handle empty args: func()
    if (this.lexer.peek().type !== TokenType.RPAREN) {
      // First argument
      args.push(this.expression(0));

      // Additional arguments
      while (this.lexer.tryConsume(TokenType.COMMA)) {
        args.push(this.expression(0));
      }
    }

    this.lexer.consume(TokenType.RPAREN);

    return {
      type: "functionCall",
      name,
      args,
    };
  }

  /**
   * Parse multi-select hash: {key: expr, key: expr, ...}
   */
  private parseMultiSelectHash(): JsonSelector {
    this.lexer.consume(TokenType.LBRACE);
    const entries: Array<{ key: string; value: JsonSelector }> = [];

    // Empty multi-select hash {} is invalid
    if (this.lexer.peek().type === TokenType.RBRACE) {
      const token = this.lexer.peek();
      throw this.unexpectedToken(
        token,
        "key-value pair",
        "in multi-select hash",
      );
    }

    // Parse first key-value pair
    entries.push(this.parseMultiSelectHashEntry());

    // Parse remaining comma-separated entries
    while (this.lexer.tryConsume(TokenType.COMMA)) {
      entries.push(this.parseMultiSelectHashEntry());
    }

    this.lexer.consume(TokenType.RBRACE);

    return {
      type: "multiSelectHash",
      entries,
    };
  }

  /**
   * Parse a single key: value entry in a multi-select hash
   */
  private parseMultiSelectHashEntry(): { key: string; value: JsonSelector } {
    const key = this.parseIdentifier();
    this.lexer.consume(TokenType.COLON);
    const value = this.expression(0);
    return { key, value };
  }

  /**
   * Parse object projection: creates the objectProject node and parses
   * any continuation operators.
   */
  private parseObjectProjection(expression: JsonSelector): JsonSelector {
    return {
      type: "objectProject",
      expression,
      projection: this.parseProjectionContinuation() ?? CURRENT_NODE,
    };
  }

  /**
   * Parse dot-bracket: foo.[...] which could be:
   * - Multi-select list: foo.[a, b]
   * - Array projection: foo.[*]
   *
   * Note: foo.[0], foo.[:], and foo.['id'] are rejected as syntax errors.
   */
  private parseDotBracket(left: JsonSelector): JsonSelector {
    this.lexer.consume(TokenType.LBRACKET);
    const token = this.lexer.peek();

    // After .[, only STAR and expressions are valid
    // NUMBER, COLON, RAW_STRING are NOT valid (use foo[0], foo[:], foo['id'] instead)
    if (token.type === TokenType.STAR) {
      // .[*] is valid as projection
      this.lexer.advance();
      this.lexer.consume(TokenType.RBRACKET);
      const projectNode: JsonSelector = {
        type: "project",
        expression: left,
        projection: CURRENT_NODE,
      };
      return this.parseProjectionRHS(projectNode);
    }

    // NUMBER, COLON, RAW_STRING after .[ are syntax errors
    if (
      token.type === TokenType.NUMBER ||
      token.type === TokenType.COLON ||
      token.type === TokenType.RAW_STRING
    ) {
      throw this.unexpectedToken(token, "expression or '*'", "after '.['");
    }

    // Multi-select list: [expr1, expr2, ...]
    const expressions: JsonSelector[] = [];
    expressions.push(this.expression(0));

    while (this.lexer.tryConsume(TokenType.COMMA)) {
      const next = this.lexer.peek();
      if (
        next.type === TokenType.NUMBER ||
        next.type === TokenType.COLON ||
        next.type === TokenType.RAW_STRING
      ) {
        throw this.unexpectedToken(next, "expression", "after '.['");
      }
      expressions.push(this.expression(0));
    }

    this.lexer.consume(TokenType.RBRACKET);

    return {
      type: "pipe",
      lhs: left,
      rhs: {
        type: "multiSelectList",
        expressions,
      },
      dotSyntax: true,
    };
  }

  private unexpectedToken(
    token: Token,
    expected?: string,
    context?: string,
  ): UnexpectedTokenError {
    return new UnexpectedTokenError(
      this.input,
      token.offset,
      token.text || EOF_DESCRIPTION,
      expected,
      context,
    );
  }
}

function trimJsonWhitespace(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isWhitespace(value.charCodeAt(start))) {
    ++start;
  }
  while (end > start && isWhitespace(value.charCodeAt(end - 1))) {
    --end;
  }
  return value.slice(start, end);
}
