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
  BACKTICK = 44,
  FILTER_BRACKET = 45,
  FLATTEN_BRACKET = 46,

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

// Base fields shared by all tokens
interface TokenBase {
  offset: number;
}

// String-valued tokens
export interface StringToken extends TokenBase {
  type: TokenType.IDENTIFIER | TokenType.QUOTED_STRING | TokenType.RAW_STRING;
  text: string;
  value: string;
}

// Number-valued token
export interface NumberToken extends TokenBase {
  type: TokenType.NUMBER;
  text: string;
  value: number;
}

// Keyword tokens with literal values
export interface NullToken extends TokenBase {
  type: TokenType.NULL;
  text: "null";
  value: null;
}

export interface TrueToken extends TokenBase {
  type: TokenType.TRUE;
  text: "true";
  value: true;
}

export interface FalseToken extends TokenBase {
  type: TokenType.FALSE;
  text: "false";
  value: false;
}

// Symbol tokens (operators, delimiters) - no meaningful value
export interface SymbolToken extends TokenBase {
  type:
    | TokenType.LPAREN
    | TokenType.RPAREN
    | TokenType.LBRACKET
    | TokenType.RBRACKET
    | TokenType.LBRACE
    | TokenType.RBRACE
    | TokenType.DOT
    | TokenType.COMMA
    | TokenType.COLON
    | TokenType.PIPE
    | TokenType.OR
    | TokenType.AND
    | TokenType.NOT
    | TokenType.EQ
    | TokenType.NEQ
    | TokenType.LT
    | TokenType.LTE
    | TokenType.GT
    | TokenType.GTE
    | TokenType.AT
    | TokenType.DOLLAR
    | TokenType.STAR
    | TokenType.QUESTION
    | TokenType.BACKTICK
    | TokenType.FILTER_BRACKET
    | TokenType.FLATTEN_BRACKET;
  text: string;
}

export type Token =
  | StringToken
  | NumberToken
  | NullToken
  | TrueToken
  | FalseToken
  | SymbolToken;

// Type mapping from TokenType to Token interface
export type TokenTypeMap = {
  [TokenType.IDENTIFIER]: StringToken;
  [TokenType.QUOTED_STRING]: StringToken;
  [TokenType.RAW_STRING]: StringToken;
  [TokenType.NUMBER]: NumberToken;
  [TokenType.NULL]: NullToken;
  [TokenType.TRUE]: TrueToken;
  [TokenType.FALSE]: FalseToken;
  [TokenType.LPAREN]: SymbolToken;
  [TokenType.RPAREN]: SymbolToken;
  [TokenType.LBRACKET]: SymbolToken;
  [TokenType.RBRACKET]: SymbolToken;
  [TokenType.LBRACE]: SymbolToken;
  [TokenType.RBRACE]: SymbolToken;
  [TokenType.DOT]: SymbolToken;
  [TokenType.COMMA]: SymbolToken;
  [TokenType.COLON]: SymbolToken;
  [TokenType.PIPE]: SymbolToken;
  [TokenType.OR]: SymbolToken;
  [TokenType.AND]: SymbolToken;
  [TokenType.NOT]: SymbolToken;
  [TokenType.EQ]: SymbolToken;
  [TokenType.NEQ]: SymbolToken;
  [TokenType.LT]: SymbolToken;
  [TokenType.LTE]: SymbolToken;
  [TokenType.GT]: SymbolToken;
  [TokenType.GTE]: SymbolToken;
  [TokenType.AT]: SymbolToken;
  [TokenType.DOLLAR]: SymbolToken;
  [TokenType.STAR]: SymbolToken;
  [TokenType.QUESTION]: SymbolToken;
  [TokenType.BACKTICK]: SymbolToken;
  [TokenType.FILTER_BRACKET]: SymbolToken;
  [TokenType.FLATTEN_BRACKET]: SymbolToken;
};

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
 * Core lexer class - now exported and used directly by parser
 */
export class Lexer {
  private input: string;
  private length: number;
  private pos: number = 0;
  private current: Token | null;

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
    this.current = this.scanNext();
  }

  /**
   * Peek at current token without consuming
   */
  peek(): Token | null {
    return this.current;
  }

  /**
   * Advance to next token and return it
   */
  advance(): Token | null {
    this.current = this.scanNext();
    return this.current;
  }

  /**
   * Check if current token matches type
   */
  is(type: TokenType): boolean {
    return this.peek()?.type === type;
  }

  /**
   * Consume current token if it matches type, throw otherwise
   */
  consume<T extends TokenType>(type: T): TokenTypeMap[T] {
    const token = this.peek();
    if (!token || token.type !== type) {
      throw new Error(
        `Expected token type ${type} but got ${token ? `token type ${token.type}` : "EOF"} at position ${token?.offset || "end"}`,
      );
    }
    this.advance();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return token as TokenTypeMap[T];
  }

  /**
   * Try to consume token if it matches type, return null otherwise
   */
  tryConsume<T extends TokenType>(type: T): TokenTypeMap[T] | null {
    if (this.is(type)) {
      return this.consume(type);
    }
    return null;
  }

  /**
   * Check if at end of input
   */
  eof(): boolean {
    return this.peek() === null;
  }

  /**
   * Get next token (null at EOF) - renamed from next() to scanNext()
   */
  private scanNext(): Token | null {
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
        offset: start,
      } satisfies SymbolToken;
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
   * Scan [, [?, or []
   */
  private scanBracket(start: number): Token {
    this.pos++; // consume [
    const nextCh =
      this.pos < this.length ? this.input.charCodeAt(this.pos) : -1;

    if (nextCh === 63) {
      // ?
      this.pos++;
      return {
        type: TokenType.FILTER_BRACKET,
        text: "[?",
        offset: start,
      };
    }
    if (nextCh === 93) {
      // ]
      this.pos++;
      return {
        type: TokenType.FLATTEN_BRACKET,
        text: "[]",
        offset: start,
      };
    }
    return {
      type: TokenType.LBRACKET,
      text: "[",
      offset: start,
    };
  }

  /**
   * Scan | or ||
   */
  private scanPipe(start: number): SymbolToken {
    this.pos++; // consume |
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 124) {
      // |
      this.pos++;
      return { type: TokenType.OR, text: "||", offset: start };
    }
    return { type: TokenType.PIPE, text: "|", offset: start };
  }

  /**
   * Scan ! or !=
   */
  private scanBang(start: number): SymbolToken {
    this.pos++; // consume !
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 61) {
      // =
      this.pos++;
      return { type: TokenType.NEQ, text: "!=", offset: start };
    }
    return { type: TokenType.NOT, text: "!", offset: start };
  }

  /**
   * Scan < or <=
   */
  private scanLessThan(start: number): SymbolToken {
    this.pos++; // consume <
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 61) {
      // =
      this.pos++;
      return { type: TokenType.LTE, text: "<=", offset: start };
    }
    return { type: TokenType.LT, text: "<", offset: start };
  }

  /**
   * Scan > or >=
   */
  private scanGreaterThan(start: number): SymbolToken {
    this.pos++; // consume >
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 61) {
      // =
      this.pos++;
      return { type: TokenType.GTE, text: ">=", offset: start };
    }
    return { type: TokenType.GT, text: ">", offset: start };
  }

  /**
   * Scan ==
   */
  private scanEquals(start: number): SymbolToken {
    this.pos++; // consume first =
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 61) {
      // =
      this.pos++;
      return { type: TokenType.EQ, text: "==", offset: start };
    }
    throw new Error(
      `Unexpected character at position ${start}: expected '==' but got '='`,
    );
  }

  /**
   * Scan &&
   */
  private scanAmpersand(start: number): SymbolToken {
    this.pos++; // consume first &
    if (this.pos < this.length && this.input.charCodeAt(this.pos) === 38) {
      // &
      this.pos++;
      return { type: TokenType.AND, text: "&&", offset: start };
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
  private scanRawString(start: number): StringToken {
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
  private scanQuotedString(start: number): StringToken {
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
  private scanNumber(start: number): NumberToken {
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
  private scanIdentifier(
    start: number,
  ): StringToken | NullToken | TrueToken | FalseToken {
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
      if (keywordType === TokenType.NULL) {
        return {
          type: TokenType.NULL,
          text: "null",
          value: null,
          offset: start,
        };
      } else if (keywordType === TokenType.TRUE) {
        return {
          type: TokenType.TRUE,
          text: "true",
          value: true,
          offset: start,
        };
      } else {
        return {
          type: TokenType.FALSE,
          text: "false",
          value: false,
          offset: start,
        };
      }
    }

    return { type: TokenType.IDENTIFIER, text, value: text, offset: start };
  }
}
