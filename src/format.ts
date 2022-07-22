import { JsonSelector } from "./types";
import { formatIdentifier, formatRawString } from "./util";
import { visitJsonSelector } from "./visitor";

export function formatJsonSelector(selector: JsonSelector): string {
  return visitJsonSelector<string, undefined>(
    selector,
    {
      identifier({ id }) {
        return formatIdentifier(id);
      },
      fieldAccess({ expression, field }, context) {
        const expr = visitJsonSelector(expression, this, context);
        return `${expr}.${formatIdentifier(field)}`;
      },
      idAccess({ expression, id }, context) {
        const expr = visitJsonSelector(expression, this, context);
        return `${expr}[${formatRawString(id)}]`;
      },
      indexAccess({ expression, index }, context) {
        const expr = visitJsonSelector(expression, this, context);
        return `${expr}[${index}]`;
      },
    },
    undefined
  );
}
