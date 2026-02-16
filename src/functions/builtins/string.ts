import { InvalidArgumentValueError } from "../../errors";
import { isArray, isObject } from "../../util";
import {
  ANY_ARRAY_TYPE,
  ANY_TYPE,
  NUMBER_TYPE,
  OBJECT_TYPE,
  STRING_ARRAY_TYPE,
  STRING_TYPE,
  unionOf,
} from "../datatype";
import { FunctionDefinition } from "../types";
import {
  arg,
  optArg,
  requireInteger,
  requireNonNegativeInteger,
} from "../validation";

/** Registers all JMESPath string functions. */
export function registerStringFunctions(
  register: (def: FunctionDefinition) => void,
): void {
  // length(string | array | object) -> number
  register({
    name: "length",
    signatures: [
      [arg("subject", unionOf([STRING_TYPE, ANY_ARRAY_TYPE, OBJECT_TYPE]))],
    ],
    handler: ({ args }) => {
      const value = args[0];
      if (typeof value === "string") {
        return codePointLength(value);
      }
      if (isArray(value)) {
        return value.length;
      }
      if (isObject(value)) {
        return Object.keys(value).length;
      }
      return 0;
    },
  });

  // reverse(string | array) -> string | array
  register({
    name: "reverse",
    signatures: [[arg("subject", unionOf([STRING_TYPE, ANY_ARRAY_TYPE]))]],
    handler: ({ args }) => {
      const value = args[0];
      if (typeof value === "string") {
        return [...value].reverse().join("");
      }
      if (isArray(value)) {
        return [...value].reverse();
      }
      return value;
    },
  });

  // starts_with(string, string) -> boolean
  register({
    name: "starts_with",
    signatures: [[arg("subject", STRING_TYPE), arg("prefix", STRING_TYPE)]],
    handler: ({ args }) => {
      const subject = args[0];
      const prefix = args[1];
      if (typeof subject === "string" && typeof prefix === "string") {
        return subject.startsWith(prefix);
      }
      return false;
    },
  });

  // ends_with(string, string) -> boolean
  register({
    name: "ends_with",
    signatures: [[arg("subject", STRING_TYPE), arg("suffix", STRING_TYPE)]],
    handler: ({ args }) => {
      const subject = args[0];
      const suffix = args[1];
      if (typeof subject === "string" && typeof suffix === "string") {
        return subject.endsWith(suffix);
      }
      return false;
    },
  });

  // contains(string | array, any) -> boolean
  register({
    name: "contains",
    signatures: [
      [
        arg("subject", unionOf([STRING_TYPE, ANY_ARRAY_TYPE])),
        arg("search", ANY_TYPE),
      ],
    ],
    handler: ({ args }) => {
      const subject = args[0];
      const search = args[1];
      if (typeof subject === "string" && typeof search === "string") {
        return subject.includes(search);
      }
      if (isArray(subject)) {
        return subject.includes(search);
      }
      return false;
    },
  });

  // join(string, array<string>) -> string
  register({
    name: "join",
    signatures: [[arg("glue", STRING_TYPE), arg("list", STRING_ARRAY_TYPE)]],
    handler: ({ args }) => {
      const glue = args[0];
      const arr = args[1];
      if (typeof glue === "string" && isArray(arr)) {
        return arr.join(glue);
      }
      return "";
    },
  });

  // split(string, string, number?) -> array<string>
  register({
    name: "split",
    signatures: [
      [
        arg("subject", STRING_TYPE),
        arg("delimiter", STRING_TYPE),
        optArg("count", NUMBER_TYPE),
      ],
    ],
    // JMESPath Community JEP-014: count is the maximum number of splits to perform.
    // split("a,b,c", ",", 1) → ["a", "b,c"] (1 split, 2 parts).
    // See https://github.com/jmespath-community/jmespath.spec/blob/main/jep-014-string-functions.md#split
    handler: ({ args }) => {
      const subject = args[0];
      const delimiter = args[1];
      if (typeof subject === "string" && typeof delimiter === "string") {
        if (typeof args[2] === "number") {
          const count = requireNonNegativeInteger("split", "count", args[2]);
          return splitWithCount(subject, delimiter, count);
        }
        return subject.split(delimiter);
      }
      return [];
    },
  });

  // lower(string) -> string
  register({
    name: "lower",
    signatures: [[arg("subject", STRING_TYPE)]],
    handler: ({ args }) => {
      const v = args[0];
      return typeof v === "string" ? v.toLowerCase() : "";
    },
  });

  // upper(string) -> string
  register({
    name: "upper",
    signatures: [[arg("subject", STRING_TYPE)]],
    handler: ({ args }) => {
      const v = args[0];
      return typeof v === "string" ? v.toUpperCase() : "";
    },
  });

  // trim(string, string?) -> string
  register({
    name: "trim",
    signatures: [[arg("subject", STRING_TYPE), optArg("chars", STRING_TYPE)]],
    handler: ({ args }) => {
      const v = args[0];
      if (typeof v === "string") {
        const chars = typeof args[1] === "string" ? args[1] : "";
        return chars
          ? trimChars(v, chars, true, true)
          : trimUnicodeWhitespace(v, true, true);
      }
      return "";
    },
  });

  // trim_left(string, string?) -> string
  register({
    name: "trim_left",
    signatures: [[arg("subject", STRING_TYPE), optArg("chars", STRING_TYPE)]],
    handler: ({ args }) => {
      const v = args[0];
      if (typeof v === "string") {
        const chars = typeof args[1] === "string" ? args[1] : "";
        return chars
          ? trimChars(v, chars, true, false)
          : trimUnicodeWhitespace(v, true, false);
      }
      return "";
    },
  });

  // trim_right(string, string?) -> string
  register({
    name: "trim_right",
    signatures: [[arg("subject", STRING_TYPE), optArg("chars", STRING_TYPE)]],
    handler: ({ args }) => {
      const v = args[0];
      if (typeof v === "string") {
        const chars = typeof args[1] === "string" ? args[1] : "";
        return chars
          ? trimChars(v, chars, false, true)
          : trimUnicodeWhitespace(v, false, true);
      }
      return "";
    },
  });

  // replace(string, string, string, number?) -> string
  register({
    name: "replace",
    signatures: [
      [
        arg("subject", STRING_TYPE),
        arg("old", STRING_TYPE),
        arg("new", STRING_TYPE),
        optArg("count", NUMBER_TYPE),
      ],
    ],
    handler: ({ args }) => {
      const subject = args[0];
      const oldStr = args[1];
      const newStr = args[2];
      if (
        typeof subject === "string" &&
        typeof oldStr === "string" &&
        typeof newStr === "string"
      ) {
        if (typeof args[3] === "number") {
          const count = requireNonNegativeInteger("replace", "count", args[3]);
          if (count === 0) {
            return subject;
          }
          let result = subject;
          for (let i = 0; i < count; i++) {
            const idx = result.indexOf(oldStr);
            if (idx === -1) {
              break;
            }
            result =
              result.slice(0, idx) + newStr + result.slice(idx + oldStr.length);
          }
          return result;
        }
        return subject.split(oldStr).join(newStr);
      }
      return "";
    },
  });

  // pad_left(string, number, string?) -> string
  register({
    name: "pad_left",
    signatures: [
      [
        arg("subject", STRING_TYPE),
        arg("width", NUMBER_TYPE),
        optArg("pad", STRING_TYPE),
      ],
    ],
    handler: ({ args }) => {
      const subject = args[0];
      const width = args[1];
      if (typeof subject === "string" && typeof width === "number") {
        requireNonNegativeInteger("pad_left", "width", width);
        const pad = typeof args[2] === "string" ? args[2] : " ";
        if (pad.length !== 1) {
          throw new InvalidArgumentValueError(
            "pad_left",
            "pad",
            `pad string must be length 1, got ${pad.length}`,
          );
        }
        return subject.padStart(width, pad);
      }
      return "";
    },
  });

  // pad_right(string, number, string?) -> string
  register({
    name: "pad_right",
    signatures: [
      [
        arg("subject", STRING_TYPE),
        arg("width", NUMBER_TYPE),
        optArg("pad", STRING_TYPE),
      ],
    ],
    handler: ({ args }) => {
      const subject = args[0];
      const width = args[1];
      if (typeof subject === "string" && typeof width === "number") {
        requireNonNegativeInteger("pad_right", "width", width);
        const pad = typeof args[2] === "string" ? args[2] : " ";
        if (pad.length !== 1) {
          throw new InvalidArgumentValueError(
            "pad_right",
            "pad",
            `pad string must be length 1, got ${pad.length}`,
          );
        }
        return subject.padEnd(width, pad);
      }
      return "";
    },
  });

  // find_first(string, string, number?, number?) -> number | null
  register({
    name: "find_first",
    signatures: [
      [
        arg("subject", STRING_TYPE),
        arg("search", STRING_TYPE),
        optArg("start", NUMBER_TYPE),
        optArg("end", NUMBER_TYPE),
      ],
    ],
    handler: ({ args }) => {
      const subject = args[0];
      const search = args[1];
      if (typeof subject === "string" && typeof search === "string") {
        if (search === "") {
          return null;
        }
        let start =
          typeof args[2] === "number"
            ? requireInteger("find_first", "start", args[2])
            : 0;
        let end =
          typeof args[3] === "number"
            ? requireInteger("find_first", "end", args[3])
            : subject.length;
        if (start < 0) {
          start = Math.max(0, subject.length + start);
        }
        if (end < 0) {
          end = Math.max(0, subject.length + end);
        }
        const searchArea = subject.slice(start, end);
        const idx = searchArea.indexOf(search);
        return idx === -1 ? null : idx + start;
      }
      return null;
    },
  });

  // find_last(string, string, number?, number?) -> number | null
  register({
    name: "find_last",
    signatures: [
      [
        arg("subject", STRING_TYPE),
        arg("search", STRING_TYPE),
        optArg("start", NUMBER_TYPE),
        optArg("end", NUMBER_TYPE),
      ],
    ],
    handler: ({ args }) => {
      const subject = args[0];
      const search = args[1];
      if (typeof subject === "string" && typeof search === "string") {
        if (search === "") {
          return null;
        }
        let start =
          typeof args[2] === "number"
            ? requireInteger("find_last", "start", args[2])
            : 0;
        let end =
          typeof args[3] === "number"
            ? requireInteger("find_last", "end", args[3])
            : subject.length;
        if (start < 0) {
          start = Math.max(0, subject.length + start);
        }
        if (end < 0) {
          end = Math.max(0, subject.length + end);
        }
        const searchArea = subject.slice(start, end);
        const idx = searchArea.lastIndexOf(search);
        return idx === -1 ? null : idx + start;
      }
      return null;
    },
  });
}

/**
 * Count Unicode code points in a string (not UTF-16 code units).
 * This manual scan is significantly faster than both Array.from(s).length
 * and a for...of counter in local benchmarks.
 */
function codePointLength(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++, count++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        i++;
      }
    }
  }
  return count;
}

/**
 * Split a string by a delimiter, performing at most `count` splits.
 * The remainder of the string is appended as the final element.
 */
function splitWithCount(
  subject: string,
  delimiter: string,
  count: number,
): string[] {
  if (count === 0) {
    return [subject];
  }
  if (delimiter === "") {
    const chars = [...subject];
    if (count >= chars.length) {
      return chars;
    }
    return [...chars.slice(0, count), chars.slice(count).join("")];
  }
  const result: string[] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const idx = subject.indexOf(delimiter, start);
    if (idx === -1) {
      break;
    }
    result.push(subject.slice(start, idx));
    start = idx + delimiter.length;
  }
  result.push(subject.slice(start));
  return result;
}

/**
 * Strip characters from a set from the start and/or end of a string.
 */
function trimChars(
  s: string,
  chars: string,
  left: boolean,
  right: boolean,
): string {
  const charSet = new Set(chars);
  let start = 0;
  let end = s.length;
  if (left) {
    while (start < end && charSet.has(s[start])) {
      ++start;
    }
  }
  if (right) {
    while (end > start && charSet.has(s[end - 1])) {
      --end;
    }
  }
  return s.slice(start, end);
}

const TRIM_START_RE = /^[\s\u0085]+/;
const TRIM_END_RE = /[\s\u0085]+$/;

function trimUnicodeWhitespace(
  s: string,
  left: boolean,
  right: boolean,
): string {
  if (left) {
    s = s.replace(TRIM_START_RE, "");
  }
  if (right) {
    s = s.replace(TRIM_END_RE, "");
  }
  return s;
}
