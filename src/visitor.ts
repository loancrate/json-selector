import {
  JsonSelector,
  JsonSelectorFieldAccess,
  JsonSelectorIdAccess,
  JsonSelectorIdentifier,
  JsonSelectorIndexAccess,
} from "./types.js";

export interface Visitor<R, C> {
  identifier(node: JsonSelectorIdentifier, context: C): R;
  fieldAccess(node: JsonSelectorFieldAccess, context: C): R;
  idAccess(node: JsonSelectorIdAccess, context: C): R;
  indexAccess(node: JsonSelectorIndexAccess, context: C): R;
}

export function visitJsonSelector<R, C>(
  selector: JsonSelector,
  visitor: Visitor<R, C>,
  context: C
): R {
  switch (selector.type) {
    case "identifier": {
      return visitor.identifier(selector, context);
    }
    case "fieldAccess": {
      return visitor.fieldAccess(selector, context);
    }
    case "idAccess": {
      return visitor.idAccess(selector, context);
    }
    case "indexAccess": {
      return visitor.indexAccess(selector, context);
    }
  }
}
