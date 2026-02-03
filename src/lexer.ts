import {
  describeTokenType,
  FalseToken,
  NullToken,
  NumberToken,
  StringToken,
  SymbolToken,
  Token,
  TokenType,
  TokenTypeMap,
  TrueToken,
} from "./token";

const KEYWORDS: Record<string, TokenType> = {
  null: TokenType.NULL,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
};

// Escape sequence lookup for quoted strings
const ESCAPE_CHARS: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  "`": "`",
};

/**
 * Hand-written lexer for JSON Selector expressions providing single token
 * lookahead.
 */
export class Lexer {
  private input: string;
  private length: number;
  private pos: number = 0;
  private current: Token;

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
    this.current = this.scanNext();
  }

  /**
   * Peek at current token without consuming.
   */
  peek(): Token {
    return this.current;
  }

  /**
   * Advance to next token and return it.
   */
  advance(): Token {
    this.current = this.scanNext();
    return this.current;
  }

  /**
   * Consume current token if it matches type, throw otherwise.
   */
  consume<T extends TokenType>(type: T): TokenTypeMap[T] {
    const token = this.peek();
    if (token.type !== type) {
      const expected = describeTokenType(type);
      const actual = describeTokenType(token.type);
      throw new Error(
        `Expected ${expected} but got ${actual} at position ${token.offset}`,
      );
    }
    this.advance();
    // Type assertion is safe due to the type check above
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return token as TokenTypeMap[T];
  }

  /**
   * Try to consume token if it matches type, return null otherwise.
   */
  tryConsume<T extends TokenType>(type: T): TokenTypeMap[T] | null {
    const token = this.peek();
    if (token.type !== type) {
      return null;
    }
    this.advance();
    // Type assertion is safe due to the type check above
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return token as TokenTypeMap[T];
  }

  /**
   * Get next token (EOF token at end of input)
   */
  private scanNext(): Token {
    let ch = -1;
    while (this.pos < this.length) {
      ch = this.input.charCodeAt(this.pos);
      if (!isWhitespace(ch)) {
        break;
      }
      this.pos++;
    }

    const start = this.pos;
    let singleType = 0;
    switch (ch) {
      case -1:
        return { type: TokenType.EOF, text: "", offset: this.length };
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
      case 34: // "
        return this.scanQuotedString(start);
      case 39: // '
        return this.scanRawString(start);
      case 96: // `
        return this.scanBacktickLiteral(start);
      case 45: // - (negative number)
        // Always delegate to scanNumber which will produce a better error
        // message if not followed by a digit (e.g., "Invalid digit: 'x'" instead
        // of "Unexpected character: '-'")
        return this.scanNumber(start);
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
    const ch = this.advanceCharCode();
    if (ch === 63) {
      // ?
      this.pos++;
      return {
        type: TokenType.FILTER_BRACKET,
        text: "[?",
        offset: start,
      };
    }
    if (ch === 93) {
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
    const ch = this.advanceCharCode(); // consume |
    if (ch === 124) {
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
    const ch = this.advanceCharCode(); // consume !
    if (ch === 61) {
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
    const ch = this.advanceCharCode(); // consume <
    if (ch === 61) {
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
    const ch = this.advanceCharCode(); // consume >
    if (ch === 61) {
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
    const ch = this.advanceCharCode(); // consume first =
    if (ch === 61) {
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
    const ch = this.advanceCharCode(); // consume &
    if (ch === 38) {
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
      throw new Error(
        `Unterminated string at position ${start}: expected closing '`,
      );
    }

    const text = this.input.slice(start, endPos + 1);
    let value = this.input.slice(startPos, endPos);

    if (hasEscape) {
      value = value.replace(/\\'/g, "'");
    }

    this.pos = endPos + 1;
    return { type: TokenType.RAW_STRING, text, value, offset: start };
  }

  /**
   * Scan backtick literal: `...`
   * Extracts content between backticks, handles \` escape (JMESPath extension)
   * Returns raw content for JSON.parse() in parser
   */
  private scanBacktickLiteral(start: number): StringToken {
    this.pos++; // consume opening `
    const startPos = this.pos;

    // Find end and handle \` escapes
    let endPos = this.pos;
    let hasEscape = false;

    while (endPos < this.length) {
      const ch = this.input.charCodeAt(endPos);
      if (ch === 96) {
        // Found closing `
        break;
      }
      if (
        ch === 92 &&
        endPos + 1 < this.length &&
        this.input.charCodeAt(endPos + 1) === 96
      ) {
        // \` escape
        hasEscape = true;
        endPos += 2;
      } else {
        endPos++;
      }
    }

    if (endPos >= this.length) {
      throw new Error(
        `Unterminated JSON literal at position ${start}: expected closing \``,
      );
    }

    const text = this.input.slice(start, endPos + 1);
    let value = this.input.slice(startPos, endPos);

    if (hasEscape) {
      value = value.replace(/\\`/g, "`");
    }

    this.pos = endPos + 1;
    return { type: TokenType.BACKTICK_LITERAL, text, value, offset: start };
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

          if (next === "u") {
            // Unicode escape: \uXXXX (must have exactly 4 hex digits)
            const hex = inner.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              value += String.fromCharCode(parseInt(hex, 16));
              i += 6;
            } else {
              throw new Error(
                `Invalid unicode escape at position ${start + 1 + i}`,
              );
            }
          } else if (next in ESCAPE_CHARS) {
            value += ESCAPE_CHARS[next];
            i += 2;
          } else {
            // Unknown escape, keep both chars
            value += "\\" + next;
            i += 2;
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
    throw new Error(
      `Unterminated string at position ${this.pos - 1}: expected closing "`,
    );
  }

  /**
   * Scan number: -?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?
   */
  private scanNumber(start: number): NumberToken {
    let ch = this.peekCharCode();

    // Optional negative sign
    if (ch === 45) {
      ch = this.advanceCharCode();
    }

    // Integer part (at least one digit required)
    if (!isDigit(ch)) {
      const digit = this.input[this.pos] ?? "end of input";
      throw new Error(`Invalid digit at position ${start}: ${digit}`);
    }

    // Leading zero or digits
    if (ch === 48) {
      ch = this.advanceCharCode();
    } else {
      // 1-9 followed by any digits
      while (isDigit(ch)) {
        ch = this.advanceCharCode();
      }
    }

    // Optional decimal part
    if (
      ch === 46 && // .
      this.pos + 1 < this.length &&
      isDigit(this.input.charCodeAt(this.pos + 1))
    ) {
      ch = this.advanceCharCode();
      while (isDigit(ch)) {
        ch = this.advanceCharCode();
      }
    }

    // Optional exponent part: e or E
    if (ch === 101 || ch === 69) {
      ch = this.advanceCharCode();
      // Optional sign: + or -
      if (ch === 43 || ch === 45) {
        ch = this.advanceCharCode();
      }
      // Exponent digits
      if (!isDigit(ch)) {
        const digit = this.input[this.pos] ?? "end of input";
        throw new Error(`Invalid number at position ${start}: ${digit}`);
      }
      while (isDigit(ch)) {
        ch = this.advanceCharCode();
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
    let ch = this.advanceCharCode();
    while (isIdentChar(ch)) {
      ch = this.advanceCharCode();
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

  private peekCharCode(): number {
    return this.pos < this.length ? this.input.charCodeAt(this.pos) : -1;
  }

  private advanceCharCode(): number {
    return ++this.pos < this.length ? this.input.charCodeAt(this.pos) : -1;
  }
}

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
    ch === 95 // _
  );
}

function isIdentChar(ch: number): boolean {
  return (
    (ch >= 48 && ch <= 57) || // 0-9
    (ch >= 65 && ch <= 90) || // A-Z
    (ch >= 97 && ch <= 122) || // a-z
    ch === 95 // _
  );
}
