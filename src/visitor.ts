import {
  JsonSelector,
  JsonSelectorAnd,
  JsonSelectorCompare,
  JsonSelectorCurrent,
  JsonSelectorFieldAccess,
  JsonSelectorFilter,
  JsonSelectorFlatten,
  JsonSelectorIdAccess,
  JsonSelectorIdentifier,
  JsonSelectorIndexAccess,
  JsonSelectorLiteral,
  JsonSelectorNot,
  JsonSelectorOr,
  JsonSelectorPipe,
  JsonSelectorProject,
  JsonSelectorSlice,
} from "./ast";

export interface Visitor<R, C> {
  current(node: JsonSelectorCurrent, context: C): R;
  literal(node: JsonSelectorLiteral, context: C): R;
  identifier(node: JsonSelectorIdentifier, context: C): R;
  fieldAccess(node: JsonSelectorFieldAccess, context: C): R;
  indexAccess(node: JsonSelectorIndexAccess, context: C): R;
  idAccess(node: JsonSelectorIdAccess, context: C): R;
  project(node: JsonSelectorProject, context: C): R;
  filter(node: JsonSelectorFilter, context: C): R;
  slice(node: JsonSelectorSlice, context: C): R;
  flatten(node: JsonSelectorFlatten, context: C): R;
  not(node: JsonSelectorNot, context: C): R;
  compare(node: JsonSelectorCompare, context: C): R;
  and(node: JsonSelectorAnd, context: C): R;
  or(node: JsonSelectorOr, context: C): R;
  pipe(node: JsonSelectorPipe, context: C): R;
}

export function visitJsonSelector<R, C>(
  selector: JsonSelector,
  visitor: Visitor<R, C>,
  context: C
): R {
  switch (selector.type) {
    case "current":
      return visitor.current(selector, context);
    case "literal":
      return visitor.literal(selector, context);
    case "identifier":
      return visitor.identifier(selector, context);
    case "fieldAccess":
      return visitor.fieldAccess(selector, context);
    case "indexAccess":
      return visitor.indexAccess(selector, context);
    case "idAccess":
      return visitor.idAccess(selector, context);
    case "project":
      return visitor.project(selector, context);
    case "filter":
      return visitor.filter(selector, context);
    case "slice":
      return visitor.slice(selector, context);
    case "flatten":
      return visitor.flatten(selector, context);
    case "not":
      return visitor.not(selector, context);
    case "compare":
      return visitor.compare(selector, context);
    case "and":
      return visitor.and(selector, context);
    case "or":
      return visitor.or(selector, context);
    case "pipe":
      return visitor.pipe(selector, context);
  }
}
