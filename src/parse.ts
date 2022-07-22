import { JsonSelector } from "./types";
import { parse } from "./__generated__/parser";

export function parseJsonSelector(selectorExpression: string): JsonSelector {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return parse(selectorExpression);
}
