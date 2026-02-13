import { Lexer } from "../src/lexer";
import { describeTokenType, Token, TokenType } from "../src/token";

/**
 * Collect all tokens from input (excluding EOF).
 */
function tokens(input: string): Token[] {
  const lexer = new Lexer(input);
  const result: Token[] = [];
  let token = lexer.peek();
  while (token.type !== TokenType.EOF) {
    result.push(token);
    token = lexer.advance();
  }
  return result;
}

/**
 * Get a single token from input (for simple value testing).
 */
function tokenize(input: string): Token {
  const lexer = new Lexer(input);
  return lexer.peek();
}

describe("Lexer", () => {
  describe("single-character tokens", () => {
    const cases: [string, TokenType][] = [
      ["(", TokenType.LPAREN],
      [")", TokenType.RPAREN],
      ["]", TokenType.RBRACKET],
      ["{", TokenType.LBRACE],
      ["}", TokenType.RBRACE],
      [".", TokenType.DOT],
      [",", TokenType.COMMA],
      [":", TokenType.COLON],
      ["@", TokenType.AT],
      ["$", TokenType.DOLLAR],
      ["*", TokenType.STAR],
      ["?", TokenType.QUESTION],
    ];

    test.each(cases)("tokenizes %s", (input, expectedType) => {
      expect(tokenize(input)).toMatchObject({
        type: expectedType,
        text: input,
        offset: 0,
      });
    });
  });

  describe("multi-character operators", () => {
    const cases: [string, TokenType, string][] = [
      ["|", TokenType.PIPE, "|"],
      ["||", TokenType.OR, "||"],
      ["!", TokenType.NOT, "!"],
      ["!=", TokenType.NEQ, "!="],
      ["<", TokenType.LT, "<"],
      ["<=", TokenType.LTE, "<="],
      [">", TokenType.GT, ">"],
      [">=", TokenType.GTE, ">="],
      ["==", TokenType.EQ, "=="],
      ["&&", TokenType.AND, "&&"],
    ];

    test.each(cases)("tokenizes %s", (input, expectedType, expectedText) => {
      expect(tokenize(input)).toMatchObject({
        type: expectedType,
        text: expectedText,
      });
    });

    test("distinguishes | from ||", () => {
      expect(tokens("| ||")).toMatchObject([
        { type: TokenType.PIPE },
        { type: TokenType.OR },
      ]);
    });

    test("distinguishes ! from !=", () => {
      expect(tokens("! !=")).toMatchObject([
        { type: TokenType.NOT },
        { type: TokenType.NEQ },
      ]);
    });

    test("distinguishes < from <=", () => {
      expect(tokens("< <=")).toMatchObject([
        { type: TokenType.LT },
        { type: TokenType.LTE },
      ]);
    });

    test("distinguishes > from >=", () => {
      expect(tokens("> >=")).toMatchObject([
        { type: TokenType.GT },
        { type: TokenType.GTE },
      ]);
    });
  });

  describe("bracket variations", () => {
    test("tokenizes [", () => {
      expect(tokenize("[")).toMatchObject({
        type: TokenType.LBRACKET,
        text: "[",
      });
    });

    test("tokenizes [?", () => {
      expect(tokenize("[?")).toMatchObject({
        type: TokenType.FILTER_BRACKET,
        text: "[?",
      });
    });

    test("tokenizes []", () => {
      expect(tokenize("[]")).toMatchObject({
        type: TokenType.FLATTEN_BRACKET,
        text: "[]",
      });
    });

    test("distinguishes [ from [? from []", () => {
      expect(tokens("[ [? []")).toMatchObject([
        { type: TokenType.LBRACKET },
        { type: TokenType.FILTER_BRACKET },
        { type: TokenType.FLATTEN_BRACKET },
      ]);
    });
  });

  describe("strings", () => {
    describe("raw strings", () => {
      test("tokenizes basic raw string", () => {
        expect(tokenize("'hello'")).toMatchObject({
          type: TokenType.RAW_STRING,
          text: "'hello'",
          value: "hello",
        });
      });

      test("tokenizes raw string with escaped quote", () => {
        expect(tokenize("'it\\'s'")).toMatchObject({
          type: TokenType.RAW_STRING,
          text: "'it\\'s'",
          value: "it's",
        });
      });

      test("tokenizes raw string with multiple escapes", () => {
        expect(tokenize("'a\\'b\\'c'")).toMatchObject({
          type: TokenType.RAW_STRING,
          value: "a'b'c",
        });
      });

      test("tokenizes empty raw string", () => {
        expect(tokenize("''")).toMatchObject({
          type: TokenType.RAW_STRING,
          value: "",
        });
      });

      test("throws on unterminated raw string", () => {
        expect(() => tokenize("'hello")).toThrow(
          "Unterminated string at position 0: expected closing '",
        );
      });

      test("throws on unterminated raw string with escape at end", () => {
        expect(() => tokenize("'hello\\'")).toThrow(
          "Unterminated string at position 0: expected closing '",
        );
      });
    });

    describe("quoted strings", () => {
      test("tokenizes basic quoted string", () => {
        expect(tokenize('"hello"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          text: '"hello"',
          value: "hello",
        });
      });

      test("tokenizes empty quoted string", () => {
        expect(tokenize('""')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "",
        });
      });

      test("handles escaped double quote", () => {
        expect(tokenize('"say \\"hi\\""')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: 'say "hi"',
        });
      });

      test("handles escaped backslash", () => {
        expect(tokenize('"path\\\\to\\\\file"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "path\\to\\file",
        });
      });

      test("handles escaped forward slash", () => {
        expect(tokenize('"a\\/b"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "a/b",
        });
      });

      test("handles escaped backspace", () => {
        expect(tokenize('"a\\bb"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "a\bb",
        });
      });

      test("handles escaped form feed", () => {
        expect(tokenize('"a\\fb"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "a\fb",
        });
      });

      test("handles escaped newline", () => {
        expect(tokenize('"line1\\nline2"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "line1\nline2",
        });
      });

      test("handles escaped carriage return", () => {
        expect(tokenize('"line1\\rline2"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "line1\rline2",
        });
      });

      test("handles escaped tab", () => {
        expect(tokenize('"col1\\tcol2"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "col1\tcol2",
        });
      });

      test("handles escaped backtick", () => {
        expect(tokenize('"code: \\`x\\`"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "code: `x`",
        });
      });

      test("handles unicode escape", () => {
        expect(tokenize('"\\u0041\\u0042\\u0043"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "ABC",
        });
      });

      test("handles unicode escape with lowercase hex", () => {
        expect(tokenize('"\\u00e9"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "é",
        });
      });

      test("handles mixed escapes", () => {
        expect(tokenize('"a\\nb\\tc\\u0044"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "a\nb\tc\u0044",
        });
      });

      test("throws on invalid unicode escape - too short", () => {
        expect(() => tokenize('"\\u00"')).toThrow(
          "Invalid unicode escape at position 1",
        );
      });

      test("throws on invalid unicode escape - non-hex", () => {
        expect(() => tokenize('"\\u00GH"')).toThrow(
          "Invalid unicode escape at position 1",
        );
      });

      test("preserves unknown escape sequences", () => {
        expect(tokenize('"\\x\\y\\z"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "\\x\\y\\z",
        });
      });

      test("handles trailing backslash in content", () => {
        expect(tokenize('"abc\\\\"')).toMatchObject({
          type: TokenType.QUOTED_STRING,
          value: "abc\\",
        });
      });

      test("throws on unescaped backtick", () => {
        expect(() => tokenize('"hello`world"')).toThrow(
          "Unescaped backtick in string at position 6",
        );
      });

      test("throws on unterminated quoted string", () => {
        expect(() => tokenize('"hello')).toThrow(
          'Unterminated string at position 0: expected closing "',
        );
      });
    });

    describe("backtick literals", () => {
      test("tokenizes basic backtick literal", () => {
        expect(tokenize("`123`")).toMatchObject({
          type: TokenType.BACKTICK_LITERAL,
          text: "`123`",
          value: "123",
        });
      });

      test("tokenizes backtick literal with JSON content", () => {
        expect(tokenize('`{"a":1}`')).toMatchObject({
          type: TokenType.BACKTICK_LITERAL,
          value: '{"a":1}',
        });
      });

      test("tokenizes empty backtick literal", () => {
        expect(tokenize("``")).toMatchObject({
          type: TokenType.BACKTICK_LITERAL,
          value: "",
        });
      });

      test("handles escaped backtick", () => {
        expect(tokenize("`code: \\`x\\``")).toMatchObject({
          type: TokenType.BACKTICK_LITERAL,
          value: "code: `x`",
        });
      });

      test("throws on unterminated backtick literal", () => {
        expect(() => tokenize("`hello")).toThrow(
          "Unterminated JSON literal at position 0: expected closing `",
        );
      });
    });
  });

  describe("numbers", () => {
    test("tokenizes positive integer", () => {
      expect(tokenize("42")).toMatchObject({
        type: TokenType.NUMBER,
        text: "42",
        value: 42,
      });
    });

    test("tokenizes zero", () => {
      expect(tokenize("0")).toMatchObject({
        type: TokenType.NUMBER,
        value: 0,
      });
    });

    test("tokenizes negative integer", () => {
      expect(tokenize("-42")).toMatchObject({
        type: TokenType.NUMBER,
        text: "-42",
        value: -42,
      });
    });

    test("tokenizes decimal number", () => {
      expect(tokenize("3.14")).toMatchObject({
        type: TokenType.NUMBER,
        text: "3.14",
        value: 3.14,
      });
    });

    test("tokenizes negative decimal", () => {
      expect(tokenize("-3.14")).toMatchObject({
        type: TokenType.NUMBER,
        value: -3.14,
      });
    });

    test("tokenizes number with lowercase exponent", () => {
      expect(tokenize("1e10")).toMatchObject({
        type: TokenType.NUMBER,
        value: 1e10,
      });
    });

    test("tokenizes number with uppercase exponent", () => {
      expect(tokenize("1E10")).toMatchObject({
        type: TokenType.NUMBER,
        value: 1e10,
      });
    });

    test("tokenizes number with positive exponent", () => {
      expect(tokenize("1e+10")).toMatchObject({
        type: TokenType.NUMBER,
        value: 1e10,
      });
    });

    test("tokenizes number with negative exponent", () => {
      expect(tokenize("1e-10")).toMatchObject({
        type: TokenType.NUMBER,
        value: 1e-10,
      });
    });

    test("tokenizes decimal with exponent", () => {
      expect(tokenize("3.14e2")).toMatchObject({
        type: TokenType.NUMBER,
        value: 314,
      });
    });

    test("tokenizes complex number", () => {
      expect(tokenize("-123.456e-7")).toMatchObject({
        type: TokenType.NUMBER,
        value: -123.456e-7,
      });
    });

    test("stops at dot without following digit", () => {
      expect(tokens("1.foo")).toMatchObject([
        { type: TokenType.NUMBER, value: 1 },
        { type: TokenType.DOT },
        { type: TokenType.IDENTIFIER },
      ]);
    });

    test("throws on invalid digit after negative sign", () => {
      expect(() => tokenize("-x")).toThrow("Invalid digit at position 0: x");
    });

    test("throws on negative sign at end of input", () => {
      expect(() => tokenize("-")).toThrow(
        "Invalid digit at position 0: end of input",
      );
    });

    test("throws on invalid exponent", () => {
      expect(() => tokenize("1e")).toThrow(
        "Invalid number at position 0: end of input",
      );
    });

    test("throws on invalid exponent with sign", () => {
      expect(() => tokenize("1e+")).toThrow(
        "Invalid number at position 0: end of input",
      );
    });

    test("throws on invalid exponent with non-digit", () => {
      expect(() => tokenize("1ex")).toThrow("Invalid number at position 0: x");
    });
  });

  describe("identifiers and keywords", () => {
    test("tokenizes basic identifier", () => {
      expect(tokenize("foo")).toMatchObject({
        type: TokenType.IDENTIFIER,
        text: "foo",
        value: "foo",
      });
    });

    test("tokenizes identifier with underscore", () => {
      expect(tokenize("foo_bar")).toMatchObject({
        type: TokenType.IDENTIFIER,
        value: "foo_bar",
      });
    });

    test("tokenizes identifier starting with underscore", () => {
      expect(tokenize("_private")).toMatchObject({
        type: TokenType.IDENTIFIER,
        value: "_private",
      });
    });

    test("tokenizes identifier with numbers", () => {
      expect(tokenize("foo123")).toMatchObject({
        type: TokenType.IDENTIFIER,
        value: "foo123",
      });
    });

    test("tokenizes uppercase identifier", () => {
      expect(tokenize("FOO")).toMatchObject({
        type: TokenType.IDENTIFIER,
        value: "FOO",
      });
    });

    test("tokenizes mixed case identifier", () => {
      expect(tokenize("FooBar")).toMatchObject({
        type: TokenType.IDENTIFIER,
        value: "FooBar",
      });
    });

    test("tokenizes null keyword", () => {
      expect(tokenize("null")).toMatchObject({
        type: TokenType.NULL,
        text: "null",
        value: null,
      });
    });

    test("tokenizes true keyword", () => {
      expect(tokenize("true")).toMatchObject({
        type: TokenType.TRUE,
        text: "true",
        value: true,
      });
    });

    test("tokenizes false keyword", () => {
      expect(tokenize("false")).toMatchObject({
        type: TokenType.FALSE,
        text: "false",
        value: false,
      });
    });

    test("does not match keyword prefix", () => {
      expect(tokenize("nullable")).toMatchObject({
        type: TokenType.IDENTIFIER,
        value: "nullable",
      });
    });

    test("does not match keyword suffix", () => {
      const token = tokenize("isnull");
      expect(token.type).toBe(TokenType.IDENTIFIER);
    });
  });

  describe("whitespace", () => {
    test("skips leading spaces", () => {
      expect(tokens("   foo")).toMatchObject([
        { type: TokenType.IDENTIFIER, offset: 3 },
      ]);
    });

    test("skips leading tabs", () => {
      expect(tokens("\t\tfoo")).toMatchObject([
        { type: TokenType.IDENTIFIER, offset: 2 },
      ]);
    });

    test("skips leading newlines", () => {
      expect(tokens("\nfoo")).toMatchObject([
        { type: TokenType.IDENTIFIER, offset: 1 },
      ]);
    });

    test("skips leading carriage returns", () => {
      expect(tokens("\r\nfoo")).toMatchObject([
        { type: TokenType.IDENTIFIER, offset: 2 },
      ]);
    });

    test("skips leading mixed whitespace", () => {
      expect(tokens(" \t\n\r foo")).toMatchObject([
        { type: TokenType.IDENTIFIER, offset: 5 },
      ]);
    });

    test("handles whitespace between tokens", () => {
      expect(tokens("foo . bar")).toMatchObject([
        { type: TokenType.IDENTIFIER },
        { type: TokenType.DOT },
        { type: TokenType.IDENTIFIER },
      ]);
    });
  });

  describe("errors", () => {
    test("throws on unexpected character", () => {
      expect(() => tokenize("#")).toThrow(
        "Unexpected character at position 0: #",
      );
    });

    test("throws on single equals", () => {
      expect(() => tokenize("=")).toThrow(
        "Unexpected character at position 0: expected '==' but got '='",
      );
    });

    test("parses single ampersand as AMPERSAND token", () => {
      // Single ampersand is now valid for expression references (&expr)
      expect(tokenize("&")).toMatchObject({
        type: TokenType.AMPERSAND,
        text: "&",
        offset: 0,
      });
    });

    test("reports correct position for error", () => {
      expect(() => tokens("foo #")).toThrow(
        "Unexpected character at position 4: #",
      );
    });
  });

  describe("API methods", () => {
    describe("peek", () => {
      test("returns current token without advancing", () => {
        const lexer = new Lexer("foo bar");
        expect(lexer.peek().text).toBe("foo");
        expect(lexer.peek().text).toBe("foo");
        expect(lexer.peek().text).toBe("foo");
      });
    });

    describe("advance", () => {
      test("advances to next token and returns it", () => {
        const lexer = new Lexer("foo bar");
        expect(lexer.peek().text).toBe("foo");
        const next = lexer.advance();
        expect(next.text).toBe("bar");
        expect(lexer.peek().text).toBe("bar");
      });

      test("returns EOF at end", () => {
        const lexer = new Lexer("foo");
        lexer.advance();
        expect(lexer.peek().type).toBe(TokenType.EOF);
      });
    });

    describe("consume", () => {
      test("consumes matching token", () => {
        const lexer = new Lexer("foo");
        expect(lexer.consume(TokenType.IDENTIFIER)).toMatchObject({
          type: TokenType.IDENTIFIER,
          text: "foo",
        });
        expect(lexer.peek().type).toBe(TokenType.EOF);
      });

      test("throws on non-matching token", () => {
        const lexer = new Lexer("foo");
        expect(() => lexer.consume(TokenType.NUMBER)).toThrow(
          "Expected number but got identifier at position 0",
        );
      });
    });

    describe("tryConsume", () => {
      test("consumes and returns matching token", () => {
        const lexer = new Lexer("foo");
        expect(lexer.tryConsume(TokenType.IDENTIFIER)).toMatchObject({
          text: "foo",
        });
        expect(lexer.peek().type).toBe(TokenType.EOF);
      });

      test("returns null for non-matching token", () => {
        const lexer = new Lexer("foo");
        const token = lexer.tryConsume(TokenType.NUMBER);
        expect(token).toBeNull();
        expect(lexer.peek().text).toBe("foo");
      });
    });
  });

  describe("EOF handling", () => {
    test("returns EOF for empty input", () => {
      expect(tokenize("")).toMatchObject({
        type: TokenType.EOF,
        text: "",
      });
    });

    test("EOF has correct offset", () => {
      const lexer = new Lexer("foo");
      lexer.advance();
      expect(lexer.peek()).toMatchObject({
        type: TokenType.EOF,
        offset: 3,
      });
    });
  });

  describe("token offsets", () => {
    test("tracks offsets correctly", () => {
      const toks = tokens("foo.bar[0]");
      expect(toks.map((t) => t.offset)).toEqual([0, 3, 4, 7, 8, 9]);
    });

    test("tracks offsets with whitespace", () => {
      const toks = tokens("foo . bar");
      expect(toks.map((t) => t.offset)).toEqual([0, 4, 6]);
    });
  });

  describe("describeTokenType", () => {
    test("returns fallback for unknown token type", () => {
      // Intentional bad cast to simulate unknown token type
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      expect(describeTokenType(9999 as TokenType)).toBe("unknown token 9999");
    });
  });

  describe("complex expressions", () => {
    test("tokenizes field access", () => {
      const toks = tokens("foo.bar.baz");
      expect(toks.map((t) => t.text)).toEqual(["foo", ".", "bar", ".", "baz"]);
    });

    test("tokenizes filter expression", () => {
      const toks = tokens("foo[?bar == `1`]");
      expect(toks.map((t) => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.FILTER_BRACKET,
        TokenType.IDENTIFIER,
        TokenType.EQ,
        TokenType.BACKTICK_LITERAL,
        TokenType.RBRACKET,
      ]);
    });

    test("tokenizes slice expression", () => {
      const toks = tokens("foo[1:3]");
      expect(toks.map((t) => t.text)).toEqual(["foo", "[", "1", ":", "3", "]"]);
    });

    test("tokenizes logical expression", () => {
      const toks = tokens("a && b || !c");
      expect(toks.map((t) => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.AND,
        TokenType.IDENTIFIER,
        TokenType.OR,
        TokenType.NOT,
        TokenType.IDENTIFIER,
      ]);
    });

    test("tokenizes comparison", () => {
      const toks = tokens("x < 10 && x >= 0");
      expect(toks.map((t) => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.LT,
        TokenType.NUMBER,
        TokenType.AND,
        TokenType.IDENTIFIER,
        TokenType.GTE,
        TokenType.NUMBER,
      ]);
    });
  });
});
