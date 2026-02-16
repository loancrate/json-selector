import { isArray } from "../../util";
import {
  NUMBER_ARRAY_TYPE,
  NUMBER_TYPE,
  STRING_ARRAY_TYPE,
  unionOf,
} from "../datatype";
import { FunctionDefinition } from "../types";
import { arg } from "../validation";

/** Registers all JMESPath numeric functions. */
export function registerMathFunctions(
  register: (def: FunctionDefinition) => void,
): void {
  // abs(number) -> number
  register({
    name: "abs",
    signatures: [[arg("value", NUMBER_TYPE)]],
    handler: ({ args }) => {
      const v = args[0];
      return typeof v === "number" ? Math.abs(v) : 0;
    },
  });

  // ceil(number) -> number
  register({
    name: "ceil",
    signatures: [[arg("value", NUMBER_TYPE)]],
    handler: ({ args }) => {
      const v = args[0];
      return typeof v === "number" ? Math.ceil(v) : 0;
    },
  });

  // floor(number) -> number
  register({
    name: "floor",
    signatures: [[arg("value", NUMBER_TYPE)]],
    handler: ({ args }) => {
      const v = args[0];
      return typeof v === "number" ? Math.floor(v) : 0;
    },
  });

  // sum(array<number>) -> number
  register({
    name: "sum",
    signatures: [[arg("list", NUMBER_ARRAY_TYPE)]],
    handler: ({ args }) => {
      if (isArray(args[0])) {
        let sum = 0;
        for (const el of args[0]) {
          if (typeof el === "number") {
            sum += el;
          }
        }
        return sum;
      }
      return 0;
    },
  });

  // avg(array<number>) -> number | null
  register({
    name: "avg",
    signatures: [[arg("list", NUMBER_ARRAY_TYPE)]],
    handler: ({ args }) => {
      if (isArray(args[0])) {
        const arr = args[0];
        if (arr.length === 0) {
          return null;
        }
        let sum = 0;
        for (const el of arr) {
          if (typeof el === "number") {
            sum += el;
          }
        }
        return sum / arr.length;
      }
      return null;
    },
  });

  // min(array<number> | array<string>) -> number | string | null
  register({
    name: "min",
    signatures: [
      [arg("list", unionOf([NUMBER_ARRAY_TYPE, STRING_ARRAY_TYPE]))],
    ],
    handler: ({ args }) => {
      if (isArray(args[0]) && args[0].length > 0) {
        const arr = args[0];
        let min = arr[0];
        for (let i = 1; i < arr.length; i++) {
          const el = arr[i];
          if (typeof min === "number" && typeof el === "number") {
            if (el < min) {
              min = el;
            }
          } else if (typeof min === "string" && typeof el === "string") {
            if (el < min) {
              min = el;
            }
          }
        }
        return min;
      }
      return null;
    },
  });

  // max(array<number> | array<string>) -> number | string | null
  register({
    name: "max",
    signatures: [
      [arg("list", unionOf([NUMBER_ARRAY_TYPE, STRING_ARRAY_TYPE]))],
    ],
    handler: ({ args }) => {
      if (isArray(args[0]) && args[0].length > 0) {
        const arr = args[0];
        let max = arr[0];
        for (let i = 1; i < arr.length; i++) {
          const el = arr[i];
          if (typeof max === "number" && typeof el === "number") {
            if (el > max) {
              max = el;
            }
          } else if (typeof max === "string" && typeof el === "string") {
            if (el > max) {
              max = el;
            }
          }
        }
        return max;
      }
      return null;
    },
  });
}
