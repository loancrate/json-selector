import { compile as tsJmespathCompile } from "@jmespath-community/jmespath";
import * as jmespath from "jmespath";

import { parseJsonSelector } from "../src";

import type { LibraryId } from "./types";

// Extend jmespath types - @types/jmespath is incomplete
declare module "jmespath" {
  export function compile(expression: string): unknown;
}

export type ParseFn = (expression: string) => unknown;

export function getParser(library: LibraryId): ParseFn {
  switch (library) {
    case "json-selector":
      return parseJsonSelector;
    case "jmespath":
      return jmespath.compile;
    case "typescript-jmespath":
      return tsJmespathCompile;
  }
}

export function getLibraryDisplayName(library: LibraryId): string {
  switch (library) {
    case "jmespath":
      return "jmespath.js";
    case "typescript-jmespath":
      return "@jmespath-community/jmespath";
    default:
      return library;
  }
}
