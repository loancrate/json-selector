export type JsonSelectorNodeType = JsonSelector["type"];

export interface JsonSelectorIdentifier {
  type: "identifier";
  id: string;
}

export interface JsonSelectorFieldAccess {
  type: "fieldAccess";
  expression: JsonSelector;
  field: string;
}

export interface JsonSelectorIdAccess {
  type: "idAccess";
  expression: JsonSelector;
  id: string;
}

export interface JsonSelectorIndexAccess {
  type: "indexAccess";
  expression: JsonSelector;
  index: number;
}

export type JsonSelector =
  | JsonSelectorIdentifier
  | JsonSelectorFieldAccess
  | JsonSelectorIdAccess
  | JsonSelectorIndexAccess;
