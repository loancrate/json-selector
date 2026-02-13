import assert from "node:assert/strict";
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
      const token = tokenize(input);
      expect(token.type).toBe(expectedType);
      expect(token.text).toBe(input);
      expect(token.offset).toBe(0);
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
      const token = tokenize(input);
      expect(token.type).toBe(expectedType);
      expect(token.text).toBe(expectedText);
    });

    test("distinguishes | from ||", () => {
      const toks = tokens("| ||");
      expect(toks).toHaveLength(2);
      expect(toks[0].type).toBe(TokenType.PIPE);
      expect(toks[1].type).toBe(TokenType.OR);
    });

    test("distinguishes ! from !=", () => {
      const toks = tokens("! !=");
      expect(toks).toHaveLength(2);
      expect(toks[0].type).toBe(TokenType.NOT);
      expect(toks[1].type).toBe(TokenType.NEQ);
    });

    test("distinguishes < from <=", () => {
      const toks = tokens("< <=");
      expect(toks).toHaveLength(2);
      expect(toks[0].type).toBe(TokenType.LT);
      expect(toks[1].type).toBe(TokenType.LTE);
    });

    test("distinguishes > from >=", () => {
      const toks = tokens("> >=");
      expect(toks).toHaveLength(2);
      expect(toks[0].type).toBe(TokenType.GT);
      expect(toks[1].type).toBe(TokenType.GTE);
    });
  });

  describe("bracket variations", () => {
    test("tokenizes [", () => {
      const token = tokenize("[");
      expect(token.type).toBe(TokenType.LBRACKET);
      expect(token.text).toBe("[");
    });

    test("tokenizes [?", () => {
      const token = tokenize("[?");
      expect(token.type).toBe(TokenType.FILTER_BRACKET);
      expect(token.text).toBe("[?");
    });

    test("tokenizes []", () => {
      const token = tokenize("[]");
      expect(token.type).toBe(TokenType.FLATTEN_BRACKET);
      expect(token.text).toBe("[]");
    });

    test("distinguishes [ from [? from []", () => {
      const toks = tokens("[ [? []");
      expect(toks).toHaveLength(3);
      expect(toks[0].type).toBe(TokenType.LBRACKET);
      expect(toks[1].type).toBe(TokenType.FILTER_BRACKET);
      expect(toks[2].type).toBe(TokenType.FLATTEN_BRACKET);
    });
  });

  describe("strings", () => {
    describe("raw strings", () => {
      test("tokenizes basic raw string", () => {
        const token = tokenize("'hello'");
        assert(token.type === TokenType.RAW_STRING);
        expect(token.text).toBe("'hello'");
        expect(token.value).toBe("hello");
      });

      test("tokenizes raw string with escaped quote", () => {
        const token = tokenize("'it\\'s'");
        assert(token.type === TokenType.RAW_STRING);
        expect(token.text).toBe("'it\\'s'");
        expect(token.value).toBe("it's");
      });

      test("tokenizes raw string with multiple escapes", () => {
        const token = tokenize("'a\\'b\\'c'");
        assert(token.type === TokenType.RAW_STRING);
        expect(token.value).toBe("a'b'c");
      });

      test("tokenizes empty raw string", () => {
        const token = tokenize("''");
        assert(token.type === TokenType.RAW_STRING);
        expect(token.value).toBe("");
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
        const token = tokenize('"hello"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.text).toBe('"hello"');
        expect(token.value).toBe("hello");
      });

      test("tokenizes empty quoted string", () => {
        const token = tokenize('""');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("");
      });

      test("handles escaped double quote", () => {
        const token = tokenize('"say \\"hi\\""');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe('say "hi"');
      });

      test("handles escaped backslash", () => {
        const token = tokenize('"path\\\\to\\\\file"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("path\\to\\file");
      });

      test("handles escaped forward slash", () => {
        const token = tokenize('"a\\/b"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("a/b");
      });

      test("handles escaped backspace", () => {
        const token = tokenize('"a\\bb"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("a\bb");
      });

      test("handles escaped form feed", () => {
        const token = tokenize('"a\\fb"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("a\fb");
      });

      test("handles escaped newline", () => {
        const token = tokenize('"line1\\nline2"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("line1\nline2");
      });

      test("handles escaped carriage return", () => {
        const token = tokenize('"line1\\rline2"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("line1\rline2");
      });

      test("handles escaped tab", () => {
        const token = tokenize('"col1\\tcol2"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("col1\tcol2");
      });

      test("handles escaped backtick", () => {
        const token = tokenize('"code: \\`x\\`"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("code: `x`");
      });

      test("handles unicode escape", () => {
        const token = tokenize('"\\u0041\\u0042\\u0043"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("ABC");
      });

      test("handles unicode escape with lowercase hex", () => {
        const token = tokenize('"\\u00e9"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("é");
      });

      test("handles mixed escapes", () => {
        const token = tokenize('"a\\nb\\tc\\u0044"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("a\nb\tc\u0044");
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
        const token = tokenize('"\\x\\y\\z"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("\\x\\y\\z");
      });

      test("handles trailing backslash in content", () => {
        const token = tokenize('"abc\\\\"');
        assert(token.type === TokenType.QUOTED_STRING);
        expect(token.value).toBe("abc\\");
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
        const token = tokenize("`123`");
        assert(token.type === TokenType.BACKTICK_LITERAL);
        expect(token.text).toBe("`123`");
        expect(token.value).toBe("123");
      });

      test("tokenizes backtick literal with JSON content", () => {
        const token = tokenize('`{"a":1}`');
        assert(token.type === TokenType.BACKTICK_LITERAL);
        expect(token.value).toBe('{"a":1}');
      });

      test("tokenizes empty backtick literal", () => {
        const token = tokenize("``");
        assert(token.type === TokenType.BACKTICK_LITERAL);
        expect(token.value).toBe("");
      });

      test("handles escaped backtick", () => {
        const token = tokenize("`code: \\`x\\``");
        assert(token.type === TokenType.BACKTICK_LITERAL);
        expect(token.value).toBe("code: `x`");
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
      const token = tokenize("42");
      assert(token.type === TokenType.NUMBER);
      expect(token.text).toBe("42");
      expect(token.value).toBe(42);
    });

    test("tokenizes zero", () => {
      const token = tokenize("0");
      assert(token.type === TokenType.NUMBER);
      expect(token.value).toBe(0);
    });

    test("tokenizes negative integer", () => {
      const token = tokenize("-42");
      assert(token.type === TokenType.NUMBER);
      expect(token.text).toBe("-42");
      expect(token.value).toBe(-42);
    });

    test("tokenizes decimal number", () => {
      const token = tokenize("3.14");
      assert(token.type === TokenType.NUMBER);
      expect(token.text).toBe("3.14");
      expect(token.value).toBe(3.14);
    });

    test("tokenizes negative decimal", () => {
      const token = tokenize("-3.14");
      assert(token.type === TokenType.NUMBER);
      expect(token.value).toBe(-3.14);
    });

    test("tokenizes number with lowercase exponent", () => {
      const token = tokenize("1e10");
      assert(token.type === TokenType.NUMBER);
      expect(token.value).toBe(1e10);
    });

    test("tokenizes number with uppercase exponent", () => {
      const token = tokenize("1E10");
      assert(token.type === TokenType.NUMBER);
      expect(token.value).toBe(1e10);
    });

    test("tokenizes number with positive exponent", () => {
      const token = tokenize("1e+10");
      assert(token.type === TokenType.NUMBER);
      expect(token.value).toBe(1e10);
    });

    test("tokenizes number with negative exponent", () => {
      const token = tokenize("1e-10");
      assert(token.type === TokenType.NUMBER);
      expect(token.value).toBe(1e-10);
    });

    test("tokenizes decimal with exponent", () => {
      const token = tokenize("3.14e2");
      assert(token.type === TokenType.NUMBER);
      expect(token.value).toBe(314);
    });

    test("tokenizes complex number", () => {
      const token = tokenize("-123.456e-7");
      assert(token.type === TokenType.NUMBER);
      expect(token.value).toBe(-123.456e-7);
    });

    test("stops at dot without following digit", () => {
      const toks = tokens("1.foo");
      expect(toks).toHaveLength(3);
      assert(toks[0].type === TokenType.NUMBER);
      expect(toks[0].value).toBe(1);
      expect(toks[1].type).toBe(TokenType.DOT);
      expect(toks[2].type).toBe(TokenType.IDENTIFIER);
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
      const token = tokenize("foo");
      assert(token.type === TokenType.IDENTIFIER);
      expect(token.text).toBe("foo");
      expect(token.value).toBe("foo");
    });

    test("tokenizes identifier with underscore", () => {
      const token = tokenize("foo_bar");
      assert(token.type === TokenType.IDENTIFIER);
      expect(token.value).toBe("foo_bar");
    });

    test("tokenizes identifier starting with underscore", () => {
      const token = tokenize("_private");
      assert(token.type === TokenType.IDENTIFIER);
      expect(token.value).toBe("_private");
    });

    test("tokenizes identifier with numbers", () => {
      const token = tokenize("foo123");
      assert(token.type === TokenType.IDENTIFIER);
      expect(token.value).toBe("foo123");
    });

    test("tokenizes uppercase identifier", () => {
      const token = tokenize("FOO");
      assert(token.type === TokenType.IDENTIFIER);
      expect(token.value).toBe("FOO");
    });

    test("tokenizes mixed case identifier", () => {
      const token = tokenize("FooBar");
      assert(token.type === TokenType.IDENTIFIER);
      expect(token.value).toBe("FooBar");
    });

    test("tokenizes null keyword", () => {
      const token = tokenize("null");
      assert(token.type === TokenType.NULL);
      expect(token.text).toBe("null");
      expect(token.value).toBeNull();
    });

    test("tokenizes true keyword", () => {
      const token = tokenize("true");
      assert(token.type === TokenType.TRUE);
      expect(token.text).toBe("true");
      expect(token.value).toBe(true);
    });

    test("tokenizes false keyword", () => {
      const token = tokenize("false");
      assert(token.type === TokenType.FALSE);
      expect(token.text).toBe("false");
      expect(token.value).toBe(false);
    });

    test("does not match keyword prefix", () => {
      const token = tokenize("nullable");
      assert(token.type === TokenType.IDENTIFIER);
      expect(token.value).toBe("nullable");
    });

    test("does not match keyword suffix", () => {
      const token = tokenize("isnull");
      expect(token.type).toBe(TokenType.IDENTIFIER);
    });
  });

  describe("whitespace", () => {
    test("skips leading spaces", () => {
      const toks = tokens("   foo");
      expect(toks).toHaveLength(1);
      expect(toks[0].type).toBe(TokenType.IDENTIFIER);
      expect(toks[0].offset).toBe(3);
    });

    test("skips leading tabs", () => {
      const toks = tokens("\t\tfoo");
      expect(toks).toHaveLength(1);
      expect(toks[0].type).toBe(TokenType.IDENTIFIER);
      expect(toks[0].offset).toBe(2);
    });

    test("skips leading newlines", () => {
      const toks = tokens("\nfoo");
      expect(toks).toHaveLength(1);
      expect(toks[0].type).toBe(TokenType.IDENTIFIER);
      expect(toks[0].offset).toBe(1);
    });

    test("skips leading carriage returns", () => {
      const toks = tokens("\r\nfoo");
      expect(toks).toHaveLength(1);
      expect(toks[0].type).toBe(TokenType.IDENTIFIER);
      expect(toks[0].offset).toBe(2);
    });

    test("skips leading mixed whitespace", () => {
      const toks = tokens(" \t\n\r foo");
      expect(toks).toHaveLength(1);
      expect(toks[0].type).toBe(TokenType.IDENTIFIER);
      expect(toks[0].offset).toBe(5);
    });

    test("handles whitespace between tokens", () => {
      const toks = tokens("foo . bar");
      expect(toks).toHaveLength(3);
      expect(toks[0].type).toBe(TokenType.IDENTIFIER);
      expect(toks[1].type).toBe(TokenType.DOT);
      expect(toks[2].type).toBe(TokenType.IDENTIFIER);
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
      const result = tokenize("&");
      expect(result.type).toBe(TokenType.AMPERSAND);
      expect(result.text).toBe("&");
      expect(result.offset).toBe(0);
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
        const token = lexer.consume(TokenType.IDENTIFIER);
        expect(token.type).toBe(TokenType.IDENTIFIER);
        expect(token.text).toBe("foo");
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
        const token = lexer.tryConsume(TokenType.IDENTIFIER);
        assert(token !== null);
        expect(token.text).toBe("foo");
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
      const token = tokenize("");
      expect(token.type).toBe(TokenType.EOF);
      expect(token.text).toBe("");
    });

    test("EOF has correct offset", () => {
      const lexer = new Lexer("foo");
      lexer.advance();
      expect(lexer.peek().type).toBe(TokenType.EOF);
      expect(lexer.peek().offset).toBe(3);
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
