/**
 * Hand-written lexer for JSON Selectors
 *
 * Performance-optimized using:
 * - Numeric const enum for token types (fast comparison)
 * - Direct range/value comparisons for character classification
 * - Switch-case dispatch for single-character tokens
 * - Minimal string allocations
 */

// Token type enum (numeric for performance)
export const enum TokenType {
  // Delimiters (10-19)
  LPAREN = 10,
  RPAREN = 11,
  LBRACKET = 12,
  RBRACKET = 13,
  LBRACE = 14,
  RBRACE = 15,
  DOT = 16,
  COMMA = 17,
  COLON = 18,

  // Operators (20-39)
  PIPE = 20,
  OR = 21,
  AND = 22,
  NOT = 23,
  EQ = 24,
  NEQ = 25,
  LT = 26,
  LTE = 27,
  GT = 28,
  GTE = 29,

  // Special symbols (40-49)
  AT = 40,
  DOLLAR = 41,
  STAR = 42,
  QUESTION = 43,
  FILTER_BRACKET = 44,
  BACKTICK = 45,

  // Values (50-59)
  IDENTIFIER = 50,
  QUOTED_STRING = 51,
  RAW_STRING = 52,
  NUMBER = 53,

  // Keywords (60-69)
  NULL = 60,
  TRUE = 61,
  FALSE = 62,
}

// Token interface
export interface Token {
  type: TokenType;
  text: string;
  value: string | number | boolean | null;
  offset: number;
}

// Keyword mapping
const KEYWORDS: Record<string, TokenType> = {
  null: TokenType.NULL,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
};

// Inline helper functions
function isWhitespace(ch: number): boolean {
  return ch === 32 || ch === 9 || ch === 10 || ch === 13; // space, tab, newline, carriage return
}

function isDigit(ch: number): boolean {
  return ch >= 48 && ch <= 57; // 0-9
}

function isIdentStart(ch: number): boolean {
  return (
    (ch >= 65 && ch <= 90) || // A-Z
    (ch >= 97 && ch <= 122) || // a-z
    ch === 95
  ); // _
}

function isIdentChar(ch: number): boolean {
  return (
    (ch >= 48 && ch <= 57) || // 0-9
    (ch >= 65 && ch <= 90) || // A-Z
    (ch >= 97 && ch <= 122) || // a-z
    ch === 95
  ); // _
}

/**
 * Core lexer class
 */
class Lexer {
  private input: string;
  private length: number;
  private pos: number = 0;

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
  }

  /**
   * Get next token (null at EOF)
   */
  next(): Token | null {
    let ch = -1;
    while (
      this.pos < this.length &&
      isWhitespace((ch = this.input.charCodeAt(this.pos)))
    ) {
      this.pos++;
    }

    const start = this.pos;
    let singleType = 0;
    switch (ch) {
      case -1:
        return null;
      case 91: // [
        return this.scanBracket(start);
      case 124: // |
        return this.scanPipe(start);
      case 33: // !
        return this.scanBang(start);
      case 60: // <
        return this.scanLessThan(start);
      case 62: // >
        return this.scanGreaterThan(start);
      case 61: // =
        return this.scanEquals(start);
      case 38: // &
        return this.scanAmpersand(start);
      case 39: // '
        return this.scanRawString(start);
      case 34: // "
        return this.scanQuotedString(start);
      case 45: // - (negative number)
        if (
          this.pos + 1 < this.length &&
          isDigit(this.input.charCodeAt(this.pos + 1))
        ) {
          return this.scanNumber(start);
        }
        break;
      case 40: // (
        singleType = TokenType.LPAREN;
        break;
      case 41: // )
        singleType = TokenType.RPAREN;
        break;
      case 93: // ]
        singleType = TokenType.RBRACKET;
        break;
      case 123: // {
        singleType = TokenType.LBRACE;
        break;
      case 125: // }
        singleType = TokenType.RBRACE;
        break;
      case 46: // .
        singleType = TokenType.DOT;
        break;
      case 44: // ,
        singleType = TokenType.COMMA;
        break;
      case 58: // :
        singleType = TokenType.COLON;
        break;
      case 64: // @
        singleType = TokenType.AT;
        break;
      case 36: // $
        singleType = TokenType.DOLLAR;
        break;
      case 42: // *
        singleType = TokenType.STAR;
        break;
      case 63: // ?
        singleType = TokenType.QUESTION;
        break;
      case 96: // `
        singleType = TokenType.BACKTICK;
        break;
    }

    if (singleType !== 0) {
      this.pos++;
      return {
        type: singleType,
        text: this.input[start],
        value: this.input[start],
        offset: start,
      };
    }

    if (isDigit(ch)) {
      return this.scanNumber(start);
    }

    if (isIdentStart(ch)) {
      return this.scanIdentifier(start);
    }

    throw new Error(
      `Unexpected character at position ${start}: ${this.input[start]}`,
    );
  }

  /**
   * Scan [ or [?
   */
  private scanBracket(start: number): Token {
    this.pos++; // consume [
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 63) {
      // ?
      this.pos++;
      return {
        type: TokenType.FILTER_BRACKET,
        text: "[?",
        value: "[?",
        offset: start,
      };
    }
    return {
      type: TokenType.LBRACKET,
      text: "[",
      value: "[",
      offset: start,
    };
  }

  /**
   * Scan | or ||
   */
  private scanPipe(start: number): Token {
    this.pos++; // consume |
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 124) {
      // |
      this.pos++;
      return { type: TokenType.OR, text: "||", value: "||", offset: start };
    }
    return { type: TokenType.PIPE, text: "|", value: "|", offset: start };
  }

  /**
   * Scan ! or !=
   */
  private scanBang(start: number): Token {
    this.pos++; // consume !
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 61) {
      // =
      this.pos++;
      return { type: TokenType.NEQ, text: "!=", value: "!=", offset: start };
    }
    return { type: TokenType.NOT, text: "!", value: "!", offset: start };
  }

  /**
   * Scan < or <=
   */
  private scanLessThan(start: number): Token {
    this.pos++; // consume <
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 61) {
      // =
      this.pos++;
      return { type: TokenType.LTE, text: "<=", value: "<=", offset: start };
    }
    return { type: TokenType.LT, text: "<", value: "<", offset: start };
  }

  /**
   * Scan > or >=
   */
  private scanGreaterThan(start: number): Token {
    this.pos++; // consume >
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 61) {
      // =
      this.pos++;
      return { type: TokenType.GTE, text: ">=", value: ">=", offset: start };
    }
    return { type: TokenType.GT, text: ">", value: ">", offset: start };
  }

  /**
   * Scan ==
   */
  private scanEquals(start: number): Token {
    this.pos++; // consume first =
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 61) {
      // =
      this.pos++;
      return { type: TokenType.EQ, text: "==", value: "==", offset: start };
    }
    throw new Error(
      `Unexpected character at position ${start}: expected '==' but got '='`,
    );
  }

  /**
   * Scan &&
   */
  private scanAmpersand(start: number): Token {
    this.pos++; // consume first &
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 38) {
      // &
      this.pos++;
      return { type: TokenType.AND, text: "&&", value: "&&", offset: start };
    }
    throw new Error(
      `Unexpected character at position ${start}: expected '&&' but got '&'`,
    );
  }

  /**
   * Scan raw string: '...'
   * Only handles \' escape
   * Optimized to use slicing for long strings
   */
  private scanRawString(start: number): Token {
    this.pos++; // consume opening '
    const startPos = this.pos;

    // First pass: find end and check for escapes
    let hasEscape = false;
    let endPos = this.pos;

    while (endPos < this.length) {
      const ch = this.input.charCodeAt(endPos);
      if (ch === 39) {
        // Found closing '
        break;
      }
      if (ch === 92) {
        // Backslash - potential escape
        hasEscape = true;
        endPos += 2; // Skip backslash and next char
      } else {
        endPos++;
      }
    }

    if (endPos >= this.length) {
      throw new Error(`Unterminated string at position ${start}`);
    }

    // Fast path: no escapes, just slice
    if (!hasEscape) {
      const value = this.input.slice(startPos, endPos);
      const text = this.input.slice(start, endPos + 1);
      this.pos = endPos + 1;
      return { type: TokenType.RAW_STRING, text, value, offset: start };
    }

    // Slow path: process escapes using chunking
    const chunks: string[] = [];
    let pos = startPos;

    while (pos < endPos) {
      const ch = this.input.charCodeAt(pos);
      if (ch === 92 && pos + 1 < endPos) {
        // Backslash escape
        if (this.input.charCodeAt(pos + 1) === 39) {
          // \' -> '
          chunks.push("'");
          pos += 2;
        } else {
          // Keep backslash and next char
          chunks.push(this.input.slice(pos, pos + 2));
          pos += 2;
        }
      } else {
        // Regular characters - find the chunk end
        const chunkStart = pos;
        while (pos < endPos && this.input.charCodeAt(pos) !== 92) {
          pos++;
        }
        chunks.push(this.input.slice(chunkStart, pos));
      }
    }

    const value = chunks.join("");
    const text = this.input.slice(start, endPos + 1);
    this.pos = endPos + 1;
    return { type: TokenType.RAW_STRING, text, value, offset: start };
  }

  /**
   * Scan quoted string: "..."
   * Handles standard JSON escapes plus backtick (\`)
   */
  private scanQuotedString(start: number): Token {
    this.pos++; // consume opening "

    const end = this.scanQuotedStringEnd();
    const text = this.input.slice(start, end);
    this.pos = end;

    // Parse escape sequences (including backtick which JSON.parse doesn't handle)
    const inner = text.slice(1, -1); // remove quotes
    let value = "";
    let i = 0;

    while (i < inner.length) {
      if (inner[i] === "\\") {
        if (i + 1 >= inner.length) {
          value += "\\";
          i++;
        } else {
          const next = inner[i + 1];
          switch (next) {
            case '"':
              value += '"';
              i += 2;
              break;
            case "\\":
              value += "\\";
              i += 2;
              break;
            case "/":
              value += "/";
              i += 2;
              break;
            case "b":
              value += "\b";
              i += 2;
              break;
            case "f":
              value += "\f";
              i += 2;
              break;
            case "n":
              value += "\n";
              i += 2;
              break;
            case "r":
              value += "\r";
              i += 2;
              break;
            case "t":
              value += "\t";
              i += 2;
              break;
            case "`":
              value += "`";
              i += 2;
              break;
            case "u":
              // Unicode escape: \uXXXX (must have exactly 4 hex digits)
              if (
                i + 5 < inner.length &&
                /[0-9a-fA-F]/.test(inner[i + 2]) &&
                /[0-9a-fA-F]/.test(inner[i + 3]) &&
                /[0-9a-fA-F]/.test(inner[i + 4]) &&
                /[0-9a-fA-F]/.test(inner[i + 5])
              ) {
                const hex = inner.slice(i + 2, i + 6);
                value += String.fromCharCode(parseInt(hex, 16));
                i += 6;
              } else {
                // Invalid unicode escape - this is a syntax error
                throw new Error(
                  `Invalid unicode escape at position ${start + 1 + i}`,
                );
              }
              break;
            default:
              // Unknown escape, keep both chars
              value += "\\" + next;
              i += 2;
              break;
          }
        }
      } else {
        value += inner[i];
        i++;
      }
    }

    return { type: TokenType.QUOTED_STRING, text, value, offset: start };
  }

  /**
   * Find end of quoted string (handles escape sequences)
   * Rejects unescaped backticks (not valid in JSON strings)
   */
  private scanQuotedStringEnd(): number {
    let pos = this.pos;
    while (pos < this.length) {
      const ch = this.input.charCodeAt(pos);
      if (ch === 34) {
        // closing "
        return pos + 1;
      }
      if (ch === 96) {
        // unescaped backtick - not allowed in quoted strings
        throw new Error(`Unescaped backtick in string at position ${pos}`);
      }
      if (ch === 92) {
        // backslash (escape)
        pos += 2; // skip backslash and next char
      } else {
        pos++;
      }
    }
    throw new Error(`Unterminated string at position ${this.pos - 1}`);
  }

  /**
   * Scan number: -?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?
   */
  private scanNumber(start: number): Token {
    // Optional negative sign
    if (this.input.charCodeAt(this.pos) === 45) {
      // -
      this.pos++;
    }

    // Integer part (at least one digit required)
    if (this.pos >= this.length || !isDigit(this.input.charCodeAt(this.pos))) {
      throw new Error(`Invalid number at position ${start}`);
    }

    // Leading zero or digits
    if (this.input.charCodeAt(this.pos) === 48) {
      // 0
      this.pos++;
    } else {
      // 1-9 followed by any digits
      while (
        this.pos < this.length &&
        isDigit(this.input.charCodeAt(this.pos))
      ) {
        this.pos++;
      }
    }

    // Optional decimal part
    if (
      this.pos < this.length &&
      this.input.charCodeAt(this.pos) === 46 && // .
      this.pos + 1 < this.length &&
      isDigit(this.input.charCodeAt(this.pos + 1))
    ) {
      this.pos++; // consume .
      while (
        this.pos < this.length &&
        isDigit(this.input.charCodeAt(this.pos))
      ) {
        this.pos++;
      }
    }

    // Optional exponent part
    if (this.pos < this.length) {
      const ch = this.input.charCodeAt(this.pos);
      if (ch === 101 || ch === 69) {
        // e or E
        this.pos++;
        // Optional sign
        if (this.pos < this.length) {
          const sign = this.input.charCodeAt(this.pos);
          if (sign === 43 || sign === 45) {
            // + or -
            this.pos++;
          }
        }
        // Exponent digits
        if (
          this.pos >= this.length ||
          !isDigit(this.input.charCodeAt(this.pos))
        ) {
          throw new Error(`Invalid number at position ${start}`);
        }
        while (
          this.pos < this.length &&
          isDigit(this.input.charCodeAt(this.pos))
        ) {
          this.pos++;
        }
      }
    }

    const text = this.input.slice(start, this.pos);
    return {
      type: TokenType.NUMBER,
      text,
      value: parseFloat(text),
      offset: start,
    };
  }

  /**
   * Scan identifier or keyword: [a-zA-Z_][a-zA-Z0-9_]*
   */
  private scanIdentifier(start: number): Token {
    this.pos++; // consume first char
    while (
      this.pos < this.length &&
      isIdentChar(this.input.charCodeAt(this.pos))
    ) {
      this.pos++;
    }

    const text = this.input.slice(start, this.pos);

    // Check for keywords
    const keywordType = KEYWORDS[text];
    if (keywordType !== undefined) {
      // Return keyword token with appropriate value
      let value: boolean | null;
      if (keywordType === TokenType.NULL) value = null;
      else if (keywordType === TokenType.TRUE) value = true;
      else value = false; // TokenType.FALSE

      return { type: keywordType, text, value, offset: start };
    }

    return { type: TokenType.IDENTIFIER, text, value: text, offset: start };
  }
}

/**
 * Token stream wrapper (maintains API compatibility)
 */
export class TokenStream {
  private tokens: Token[] = [];
  private pos: number = 0;

  constructor(input: string) {
    const lexer = new Lexer(input);
    let token;
    while ((token = lexer.next()) !== null) {
      this.tokens.push(token);
    }
    this.pos = 0;
  }

  // Advance to next token
  advance(): Token | null {
    if (this.pos < this.tokens.length) {
      this.pos++;
    }
    return this.peek();
  }

  // Peek at current token
  peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  // Check if current token matches type
  is(type: TokenType): boolean {
    return this.peek()?.type === type;
  }

  // Consume current token if it matches type
  consume(type: TokenType): Token {
    const token = this.peek();
    if (!token || token.type !== type) {
      throw new Error(
        `Expected token type ${type} but got ${token ? `token type ${token.type}` : "EOF"} at position ${token?.offset || "end"}`,
      );
    }
    this.advance();
    return token;
  }

  // Try to consume token if it matches type
  tryConsume(type: TokenType): Token | null {
    if (this.is(type)) {
      return this.consume(type);
    }
    return null;
  }

  // Check if at end of input
  eof(): boolean {
    return this.pos >= this.tokens.length;
  }

  // Expose tokens for direct parser access
  getTokens(): Token[] {
    return this.tokens;
  }

  // Allow parser to sync position
  syncPos(pos: number): void {
    this.pos = pos;
  }

  // Allow parser to read position
  getPos(): number {
    return this.pos;
  }

  // Look ahead to determine bracket type
  peekBracketType():
    | "flatten"
    | "filter"
    | "star"
    | "slice"
    | "index"
    | "id"
    | null {
    const current = this.peek();
    if (!current) return null;

    // Check for filter bracket token [?
    if (current.type === TokenType.FILTER_BRACKET) {
      return "filter";
    }

    // Not a bracket at all
    if (current.type !== TokenType.LBRACKET) {
      return null;
    }

    // Look ahead without consuming
    const next1 =
      this.pos + 1 < this.tokens.length ? this.tokens[this.pos + 1] : null;
    if (!next1) return null;

    // Check patterns
    if (next1.type === TokenType.RBRACKET) return "flatten"; // []
    if (next1.type === TokenType.STAR) return "star"; // [*
    if (next1.type === TokenType.COLON) return "slice"; // [:
    if (next1.type === TokenType.RAW_STRING) return "id"; // ['id']
    if (next1.type === TokenType.NUMBER) {
      // Could be [n] or [n:
      const next2 =
        this.pos + 2 < this.tokens.length ? this.tokens[this.pos + 2] : null;
      if (next2 && next2.type === TokenType.COLON) return "slice";
      return "index";
    }

    return null;
  }
}
