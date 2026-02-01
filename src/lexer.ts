import moo from "moo";

export const lexer = moo.compile({
  ws: { match: /[ \t\n\r]+/, lineBreaks: true },

  // Operators (order matters for multi-char operators - longer matches first)
  or: "||",
  and: "&&",
  lte: "<=",
  gte: ">=",
  eq: "==",
  neq: "!=",
  pipe: "|",
  lt: "<",
  gt: ">",
  not: "!",

  // Brackets and delimiters (filter bracket must come before lbracket)
  filterBracket: "[?",
  lparen: "(",
  rparen: ")",
  lbracket: "[",
  rbracket: "]",
  lbrace: "{",
  rbrace: "}",
  dot: ".",
  comma: ",",
  colon: ":",
  question: "?",

  // Special symbols
  at: "@",
  dollar: "$",
  star: "*",
  backtick: "`",

  // Strings (before literals so identifiers are checked first)
  rawString: {
    match: /'(?:[^'\\]|\\[^\n])*'/,
    value: (s: string) => {
      // Remove outer quotes and handle escaping
      const inner = s.slice(1, -1);
      return inner.replace(/\\'/g, "'");
    },
  },

  quotedString: {
    match: /"(?:[^"\\`]|\\(?:["\\/bfnrt`]|u[0-9a-fA-F]{4}))*"/,
    value: (s: string) => {
      // Remove outer quotes and parse escape sequences
      const inner = s.slice(1, -1);

      // Process escape sequences left-to-right, one at a time
      // This matches the Peggy grammar's character-by-character processing
      let result = "";
      let i = 0;
      while (i < inner.length) {
        if (inner[i] === "\\") {
          if (i + 1 >= inner.length) {
            // Trailing backslash (shouldn't happen with valid regex)
            result += "\\";
            i++;
          } else {
            const next = inner[i + 1];
            switch (next) {
              case '"':
                result += '"';
                i += 2;
                break;
              case "\\":
                result += "\\";
                i += 2;
                break;
              case "/":
                result += "/";
                i += 2;
                break;
              case "b":
                result += "\b";
                i += 2;
                break;
              case "f":
                result += "\f";
                i += 2;
                break;
              case "n":
                result += "\n";
                i += 2;
                break;
              case "r":
                result += "\r";
                i += 2;
                break;
              case "t":
                result += "\t";
                i += 2;
                break;
              case "`":
                result += "`";
                i += 2;
                break;
              case "u":
                // Check if followed by 4 hex digits
                if (
                  i + 5 < inner.length &&
                  /[0-9a-fA-F]/.test(inner[i + 2]) &&
                  /[0-9a-fA-F]/.test(inner[i + 3]) &&
                  /[0-9a-fA-F]/.test(inner[i + 4]) &&
                  /[0-9a-fA-F]/.test(inner[i + 5])
                ) {
                  const hex = inner.slice(i + 2, i + 6);
                  result += String.fromCharCode(parseInt(hex, 16));
                  i += 6;
                } else {
                  // Not a valid unicode escape, keep backslash-u
                  result += "\\u";
                  i += 2;
                }
                break;
              default:
                // Unknown escape (shouldn't happen with valid regex)
                result += "\\" + next;
                i += 2;
                break;
            }
          }
        } else {
          result += inner[i];
          i++;
        }
      }

      return result;
    },
  },

  // Numbers
  number: /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/,

  // Identifiers (unquoted) - includes keywords which are handled separately
  identifier: {
    match: /[a-zA-Z_][0-9a-zA-Z_]*/,
    type: moo.keywords({
      null: "null",
      true: "true",
      false: "false",
    }),
  },
});

export type Token = moo.Token;

// Streaming token wrapper with auto-whitespace skip
export class TokenStream {
  private tokens: Token[] = [];
  private pos: number = 0;

  constructor(input: string) {
    lexer.reset(input);
    // Pre-filter whitespace tokens
    this.tokens = [];
    let token = lexer.next();
    while (token) {
      if (token.type !== "ws") {
        this.tokens.push(token);
      }
      token = lexer.next();
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
  is(type: string): boolean {
    return this.peek()?.type === type;
  }

  // Consume current token if it matches type
  consume(type: string): Token {
    const token = this.peek();
    if (!token || token.type !== type) {
      throw new Error(
        `Expected ${type} but got ${token?.type || "EOF"} at position ${token?.offset || "end"}`,
      );
    }
    this.advance();
    return token;
  }

  // Try to consume token if it matches type
  tryConsume(type: string): Token | null {
    if (this.is(type)) {
      return this.consume(type);
    }
    return null;
  }

  // Check if at end of input
  eof(): boolean {
    return this.pos >= this.tokens.length;
  }

  // PHASE 1 OPTIMIZATION: Expose tokens for direct parser access
  getTokens(): Token[] {
    return this.tokens;
  }

  // PHASE 1 OPTIMIZATION: Allow parser to sync position
  syncPos(pos: number): void {
    this.pos = pos;
  }

  // PHASE 1 OPTIMIZATION: Allow parser to read position
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
    if (current.type === "filterBracket") {
      return "filter";
    }

    // Not a bracket at all
    if (current.type !== "lbracket") {
      return null;
    }

    // Look ahead without consuming (tokens are already filtered, no WS)
    const next1 =
      this.pos + 1 < this.tokens.length ? this.tokens[this.pos + 1] : null;
    if (!next1) return null;

    // Check patterns
    if (next1.type === "rbracket") return "flatten"; // []
    if (next1.type === "star") return "star"; // [*
    if (next1.type === "colon") return "slice"; // [:
    if (next1.type === "rawString") return "id"; // ['id']
    if (next1.type === "number") {
      // Could be [n] or [n:
      const next2 =
        this.pos + 2 < this.tokens.length ? this.tokens[this.pos + 2] : null;
      if (next2 && next2.type === "colon") return "slice";
      return "index";
    }

    return null;
  }
}
