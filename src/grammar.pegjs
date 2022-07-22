// Based on https://jmespath.org/specification.html#grammar

selector = ws @member_expression ws

member_expression
  = head:identifier
    tail:(
        ws "[" ws @bracket_index ws "]"
      / ws "." ws field:identifier { return { type: "fieldAccess", field }; }
    )*
    {
      return tail.reduce((result, element) => {
        return {
          ...element,
          expression: result
        }
      }, { type: "identifier", id: head });
    }

bracket_index = 
    index:number { return { type: "indexAccess", index }; }
  / id:raw_string { return { type: "idAccess", id }; }

// Numbers

number "number" = "-"? ("0" / ([1-9] [0-9]*)) { return parseInt(text()); }

// Raw strings (single-quoted)

raw_string = "'" chars:raw_string_char* "'" { return chars.join(""); }

raw_string_char = unescaped_raw_string_char / preserved_escape / raw_string_escape

unescaped_raw_string_char = [^\0-\x1F\x27\x5C]

preserved_escape = "\\" unescaped_raw_string_char

raw_string_escape = "\\" ("'" / "\\")

// Identifiers and double-quoted strings

identifier = id:(unquoted_string / quoted_string)

unquoted_string "identifier" = head:[a-z_]i tail:[0-9a-z_]i* { return head + tail.join(""); }

quoted_string "string" = '"' chars:char* '"' { return chars.join(""); }

char = unescaped_char / escaped_char

unescaped_char = [^\0-\x1F\x22\x5C]

escaped_char = "\\" sequence:(
      '"'
    / "\\"
    / "/"
    / "b" { return "\b"; }
    / "f" { return "\f"; }
    / "n" { return "\n"; }
    / "r" { return "\r"; }
    / "t" { return "\t"; }
    / "u" digits:$(HEXDIG HEXDIG HEXDIG HEXDIG) {
        return String.fromCharCode(parseInt(digits, 16));
      }
  )
  { return sequence; }

HEXDIG = [0-9a-f]i

// Whitespace

ws "whitespace" = [ \t\n\r]*
