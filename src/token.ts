// Token type enum
export const enum TokenType {
  // Special
  EOF,

  // Delimiters
  LPAREN,
  RPAREN,
  LBRACKET,
  RBRACKET,
  LBRACE,
  RBRACE,
  DOT,
  COMMA,
  COLON,

  // Operators
  PIPE,
  OR,
  AND,
  NOT,
  EQ,
  NEQ,
  LT,
  LTE,
  GT,
  GTE,

  // Arithmetic operators
  PLUS, // "+" (addition, unary plus)
  MINUS, // "-" (subtraction, unary minus; also Unicode "−")
  MULTIPLY, // "×" (Unicode U+00D7 multiplication sign only)
  DIVIDE, // "/" or "÷" (Unicode U+00F7)
  MODULO, // "%"
  INT_DIVIDE, // "//"

  // Special symbols
  AT,
  DOLLAR,
  STAR,
  QUESTION, // Ternary operator
  AMPERSAND,
  FILTER_BRACKET,
  FLATTEN_BRACKET,

  // Values
  IDENTIFIER,
  QUOTED_STRING,
  RAW_STRING,
  BACKTICK_LITERAL,
  NUMBER,

  // Keywords
  NULL,
  TRUE,
  FALSE,
}

export const TOKEN_LIMIT = TokenType.FALSE + 1;

// Base fields shared by all tokens
interface TokenBase {
  offset: number;
}

type StringTokenTypes =
  | TokenType.IDENTIFIER
  | TokenType.QUOTED_STRING
  | TokenType.RAW_STRING
  | TokenType.BACKTICK_LITERAL;

// String-valued tokens
export interface StringToken extends TokenBase {
  type: StringTokenTypes;
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

type ValueTokenTypes =
  | StringTokenTypes
  | TokenType.NUMBER
  | TokenType.NULL
  | TokenType.TRUE
  | TokenType.FALSE;

type SymbolTokenTypes = Exclude<TokenType, ValueTokenTypes>;

// Symbol tokens (operators, delimiters) - no meaningful value
export interface SymbolToken extends TokenBase {
  type: SymbolTokenTypes;
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
  [K in TokenType]: K extends StringTokenTypes
    ? StringToken
    : K extends TokenType.NUMBER
      ? NumberToken
      : K extends TokenType.NULL
        ? NullToken
        : K extends TokenType.TRUE
          ? TrueToken
          : K extends TokenType.FALSE
            ? FalseToken
            : SymbolToken;
};

const TOKEN_DESCRIPTIONS: Record<TokenType, string> = {
  [TokenType.EOF]: "end of input",
  [TokenType.LPAREN]: "'('",
  [TokenType.RPAREN]: "')'",
  [TokenType.LBRACKET]: "'['",
  [TokenType.RBRACKET]: "']'",
  [TokenType.LBRACE]: "'{'",
  [TokenType.RBRACE]: "'}'",
  [TokenType.DOT]: "'.'",
  [TokenType.COMMA]: "','",
  [TokenType.COLON]: "':'",
  [TokenType.PIPE]: "'|'",
  [TokenType.OR]: "'||'",
  [TokenType.AND]: "'&&'",
  [TokenType.NOT]: "'!'",
  [TokenType.EQ]: "'=='",
  [TokenType.NEQ]: "'!='",
  [TokenType.LT]: "'<'",
  [TokenType.LTE]: "'<='",
  [TokenType.GT]: "'>'",
  [TokenType.GTE]: "'>='",
  [TokenType.PLUS]: "'+'",
  [TokenType.MINUS]: "'-'",
  [TokenType.MULTIPLY]: "'\u00D7'",
  [TokenType.DIVIDE]: "'/'",
  [TokenType.MODULO]: "'%'",
  [TokenType.INT_DIVIDE]: "'//'",
  [TokenType.AT]: "'@'",
  [TokenType.DOLLAR]: "'$'",
  [TokenType.STAR]: "'*'",
  [TokenType.QUESTION]: "'?'",
  [TokenType.AMPERSAND]: "'&'",
  [TokenType.FILTER_BRACKET]: "'[?'",
  [TokenType.FLATTEN_BRACKET]: "'[]'",
  [TokenType.IDENTIFIER]: "identifier",
  [TokenType.QUOTED_STRING]: "quoted string",
  [TokenType.RAW_STRING]: "raw string",
  [TokenType.BACKTICK_LITERAL]: "backtick literal",
  [TokenType.NUMBER]: "number",
  [TokenType.NULL]: "'null'",
  [TokenType.TRUE]: "'true'",
  [TokenType.FALSE]: "'false'",
};

export function describeTokenType(type: TokenType): string {
  return TOKEN_DESCRIPTIONS[type] ?? `unknown token ${type}`;
}
