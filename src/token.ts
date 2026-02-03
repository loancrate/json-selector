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

  // Special symbols
  AT,
  DOLLAR,
  STAR,
  QUESTION,
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

export function describeTokenType(type: TokenType): string {
  switch (type) {
    case TokenType.EOF:
      return "end of input";
    case TokenType.LPAREN:
      return "'('";
    case TokenType.RPAREN:
      return "')'";
    case TokenType.LBRACKET:
      return "'['";
    case TokenType.RBRACKET:
      return "']'";
    case TokenType.LBRACE:
      return "'{'";
    case TokenType.RBRACE:
      return "'}'";
    case TokenType.DOT:
      return "'.'";
    case TokenType.COMMA:
      return "','";
    case TokenType.COLON:
      return "':'";
    case TokenType.PIPE:
      return "'|'";
    case TokenType.OR:
      return "'||'";
    case TokenType.AND:
      return "'&&'";
    case TokenType.NOT:
      return "'!'";
    case TokenType.EQ:
      return "'=='";
    case TokenType.NEQ:
      return "'!='";
    case TokenType.LT:
      return "'<'";
    case TokenType.LTE:
      return "'<='";
    case TokenType.GT:
      return "'>'";
    case TokenType.GTE:
      return "'>='";
    case TokenType.AT:
      return "'@'";
    case TokenType.DOLLAR:
      return "'$'";
    case TokenType.STAR:
      return "'*'";
    case TokenType.QUESTION:
      return "'?'";
    case TokenType.FILTER_BRACKET:
      return "'[?'";
    case TokenType.FLATTEN_BRACKET:
      return "'[]'";
    case TokenType.IDENTIFIER:
      return "identifier";
    case TokenType.QUOTED_STRING:
      return "quoted string";
    case TokenType.RAW_STRING:
      return "raw string";
    case TokenType.BACKTICK_LITERAL:
      return "backtick literal";
    case TokenType.NUMBER:
      return "number";
    case TokenType.NULL:
      return "'null'";
    case TokenType.TRUE:
      return "'true'";
    case TokenType.FALSE:
      return "'false'";
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      return `unknown token ${type}`;
  }
}
