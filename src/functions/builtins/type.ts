import { isArray } from "../../util";
import { ANY_TYPE, getDataTypeKind } from "../datatype";
import { FunctionDefinition } from "../types";
import { arg } from "../validation";

/** Registers JMESPath type introspection and type conversion functions. */
export function registerTypeFunctions(
  register: (def: FunctionDefinition) => void,
): void {
  // type(any) -> string
  register({
    name: "type",
    signatures: [[arg("value", ANY_TYPE)]],
    handler: ({ args }) => getDataTypeKind(args[0]),
  });

  // to_string(any) -> string
  register({
    name: "to_string",
    signatures: [[arg("value", ANY_TYPE)]],
    handler: ({ args }) => {
      const value = args[0];
      if (typeof value === "string") {
        return value;
      }
      return JSON.stringify(value);
    },
  });

  // to_number(any) -> number | null
  register({
    name: "to_number",
    signatures: [[arg("value", ANY_TYPE)]],
    handler: ({ args }) => {
      const value = args[0];
      if (typeof value === "number") {
        return value;
      }
      // JMESPath spec says only strings conforming to the json-number production
      // are supported. Empty/whitespace strings are not valid json-numbers, but
      // JavaScript's Number("") returns 0, so we guard against that here.
      if (typeof value === "string") {
        if (value.trim() === "") {
          return null;
        }
        const num = Number(value);
        return isNaN(num) ? null : num;
      }
      return null;
    },
  });

  // to_array(any) -> array
  register({
    name: "to_array",
    signatures: [[arg("value", ANY_TYPE)]],
    handler: ({ args }) => {
      const value = args[0];
      if (isArray(value)) {
        return value;
      }
      return [value];
    },
  });
}
