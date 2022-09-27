import { JsonValue } from "type-fest";

export type JsonSelectorNodeType = JsonSelector["type"];

export interface JsonSelectorCurrent {
  type: "current";
}

export interface JsonSelectorLiteral {
  type: "literal";
  value: JsonValue;
}

export interface JsonSelectorIdentifier {
  type: "identifier";
  id: string;
}

export interface JsonSelectorFieldAccess {
  type: "fieldAccess";
  expression: JsonSelector;
  field: string;
}

export interface JsonSelectorIndexAccess {
  type: "indexAccess";
  expression: JsonSelector;
  index: number;
}

export interface JsonSelectorIdAccess {
  type: "idAccess";
  expression: JsonSelector;
  id: string;
}

export interface JsonSelectorProject {
  type: "project";
  expression: JsonSelector;
  projection?: JsonSelector;
}

export interface JsonSelectorFilter {
  type: "filter";
  expression: JsonSelector;
  condition: JsonSelector;
}

export interface JsonSelectorSlice {
  type: "slice";
  expression: JsonSelector;
  start?: number;
  end?: number;
  step?: number;
}

export interface JsonSelectorFlatten {
  type: "flatten";
  expression: JsonSelector;
}

export interface JsonSelectorNot {
  type: "not";
  expression: JsonSelector;
}

export type JsonSelectorCompareOperator = "<" | "<=" | "==" | ">=" | ">" | "!=";

export interface JsonSelectorCompare {
  type: "compare";
  operator: JsonSelectorCompareOperator;
  lhs: JsonSelector;
  rhs: JsonSelector;
}

export interface JsonSelectorAnd {
  type: "and";
  lhs: JsonSelector;
  rhs: JsonSelector;
}

export interface JsonSelectorOr {
  type: "or";
  lhs: JsonSelector;
  rhs: JsonSelector;
}

export interface JsonSelectorPipe {
  type: "pipe";
  lhs: JsonSelector;
  rhs: JsonSelector;
}

export type JsonSelector =
  | JsonSelectorCurrent
  | JsonSelectorLiteral
  | JsonSelectorIdentifier
  | JsonSelectorFieldAccess
  | JsonSelectorIndexAccess
  | JsonSelectorIdAccess
  | JsonSelectorProject
  | JsonSelectorFilter
  | JsonSelectorSlice
  | JsonSelectorFlatten
  | JsonSelectorNot
  | JsonSelectorCompare
  | JsonSelectorAnd
  | JsonSelectorOr
  | JsonSelectorPipe;
