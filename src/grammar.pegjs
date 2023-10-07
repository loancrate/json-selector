// Based on https://jmespath.org/specification.html#grammar

{
  function binaryExpression(type, head, tail) {
    return tail.reduce((lhs, rhs) => (
      {
        type,
        lhs,
        rhs
      }
    ), head);
  }

  function reduceProjection(lhs, rhs) {
    return rhs.reduce((result, fn) => fn(result), lhs);
  }

  function maybeProject(expression, pfns) {
    return !pfns.length ? expression : (
      {
        type: "project",
        expression: unwrapTrivialProjection(expression),
        projection: pfns.reduce((result, pfn) => pfn(result), { type: "current" })
      });
  }

  function unwrapTrivialProjection(expression) {
    const { type, projection } = expression;
    return type === "project" && (!projection || projection.type === "current") ? expression.expression : expression;
  }
}

selector = ws @pipe_expression ws

pipe_expression = head:or_expression tail:(ws "|" ws @or_expression)*
{ return binaryExpression("pipe", head, tail); }

or_expression = head:and_expression tail:(ws "||" ws @and_expression)*
{ return binaryExpression("or", head, tail); }

and_expression = head:compare_expression tail:(ws "&&" ws @compare_expression)*
{ return binaryExpression("and", head, tail); }

compare_expression = head:not_expression tail:(ws @("<=" / ">=" / "<" / ">" / "==" / "!=") ws @not_expression)*
{
  return tail.reduce((result, [operator, rhs]) => (
    {
      type: "compare",
      operator,
      lhs: result,
      rhs
    }
  ), head);
}

not_expression =
    "!" expression:not_expression { return { type: "not", expression }; }
  / flatten_expression

flatten_expression = lhs:flatten_lhs rhs:flatten_rhs* { return reduceProjection(lhs, rhs); }

flatten_lhs =
    flatten:flatten { return flatten({ type: "current" }); }
  / filter_expression

flatten_rhs =
    flatten:flatten pfns:filter_rhs* { return (expression) => maybeProject(flatten(expression), pfns); }
  / filter_rhs

flatten = ws "[]" { return (expression) => ({ type: "flatten", expression }); }

filter_expression = lhs:filter_lhs rhs:filter_rhs* { return reduceProjection(lhs, rhs); }

filter_lhs =
    filter:filter { return filter({ type: "current" }); }
  / projection_expression

filter_rhs = 
    filter:filter pfns:filter_rhs* { return (expression) => maybeProject(filter(expression), pfns); }
  / projection_rhs
  / dot_rhs

filter = ws "[?" condition:selector "]" { return (expression) => ({ type: "filter", expression, condition }); }

projection_expression = lhs:projection_lhs rhs:projection_rhs* { return reduceProjection(lhs, rhs); }

projection_lhs =
    projection:projection { return projection({ type: "current" }); }
  / index_expression

projection_rhs =
    projection:projection pfns:filter_rhs* { return (expression) => maybeProject(projection(expression), pfns); }
  / index_rhs

projection =
    ws "[" ws "*" ws "]" { return (expression) => ({ type: "project", expression, projection: { type: "current" } }); }
  / ws "[" ws @slice ws "]"

slice = start:number? ws ":" ws end:number? ws ":"? ws step:number?
{
  return (expression) => ({
    type: "slice",
    expression,
    start: start ?? undefined,
    end: end ?? undefined,
    step: step ?? undefined,
  });
}

index_expression = lhs:index_lhs rhs:index_rhs* { return reduceProjection(lhs, rhs); }

index_lhs =
    index:index_rhs { return index({ type: "current" }); }
  / member_expression

index_rhs =
    ws "[" ws index:number ws "]" { return (expression) => ({ type: "indexAccess", expression, index }); }
  / ws "[" ws id:raw_string ws "]" { return (expression) => ({ type: "idAccess", expression, id }); }

dot_rhs = ws "." ws field:identifier
{ return (expression) => ({ type: "fieldAccess", expression, field }); }

member_expression = lhs:primary_expression rhs:dot_rhs* { return reduceProjection(lhs, rhs); }

primary_expression =
    id:identifier { return { type: "identifier", id }; }
  / "@" { return { type: "current" }; }
  / "$" { return { type: "root" }; }
  / literal
  / value:raw_string { return { type: "literal", value }; }
  / "(" @selector ")"

literal = "`" ws value:(json_value / unquoted_json_string) ws "`"
{ return { type: "literal", value }; }

// Identifiers and double-quoted strings

identifier = unquoted_string / quoted_string

unquoted_string = head:[a-z_]i tail:[0-9a-z_]i* { return head + tail.join(""); }

quoted_string = '"' chars:char* '"' { return chars.join(""); }

char = unescaped_char / escaped_char

unescaped_char = [^\0-\x1F"\\]

escaped_char = "\\" @(
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

HEXDIG = [0-9a-f]i

// Raw strings (single-quoted)

raw_string = "'" chars:raw_string_char* "'" { return chars.join(""); }

raw_string_char = unescaped_raw_string_char / preserved_escape / raw_string_escape

// Despite what the specification says, JMESPath implementations accept control characters
unescaped_raw_string_char = [^'\\]

preserved_escape = "\\" [^'] { return text(); }

raw_string_escape = "\\" @"'"

// Numbers

number = int { return parseInt(text()); }

int = "-"? ("0" / ([1-9] [0-9]*))

// JSON

json_value =
    "null" { return null; }
  / "false" { return false; }
  / "true" { return true; }
  / json_number
  / json_string
  / json_object
  / json_array

json_number = int ("." [0-9]+)? ([eE] [+-]? [0-9]+)? { return parseFloat(text()); }

json_string = '"' @unquoted_json_string '"'

unquoted_json_string = chars:(unescaped_literal / escaped_literal)* { return chars.join(""); }

unescaped_literal = [^\0-\x1F"\\`]

escaped_literal = escaped_char / "\\" @"`"

json_object =
  "{" ws members:(
    head:json_member
    tail:(ws "," ws @json_member)*
    { return [head].concat(tail); }
  )?
  ws "}"
  { return Object.fromEntries(members ?? []); }

json_member = name:json_string ws ":" ws value:json_value
{ return [name, value]; }

json_array =
  "[" ws values:(
    head:json_value
    tail:(ws "," ws @json_value)*
    { return [head].concat(tail); }
  )? ws "]"
  { return values ?? []; }

// Whitespace

ws "whitespace" = [ \t\n\r]*
