import {
  ANY_ARRAY_TYPE,
  ANY_TYPE,
  BOOLEAN_TYPE,
  EXPREF_TYPE,
  formatType,
  getDataType,
  getDataTypeKind,
  getExpressionRef,
  makeExpressionRef,
  matchesType,
  NULL_TYPE,
  NUMBER_ARRAY_TYPE,
  NUMBER_TYPE,
  STRING_ARRAY_TYPE,
  STRING_TYPE,
} from "../../src/functions/datatype";

describe("type system", () => {
  test("getDataTypeKind handles undefined as null", () => {
    expect(getDataTypeKind(undefined)).toBe("null");
  });

  test("getDataType returns array types", () => {
    expect(getDataType([1, 2, 3])).toStrictEqual(NUMBER_ARRAY_TYPE);
    expect(getDataType(["a", "b"])).toStrictEqual(STRING_ARRAY_TYPE);
    expect(getDataType([1, "mixed"])).toStrictEqual({
      kind: "array",
      elementType: { kind: "union", types: [NUMBER_TYPE, STRING_TYPE] },
    });
    expect(getDataType([])).toStrictEqual(ANY_ARRAY_TYPE);
    expect(getDataType([true, false])).toStrictEqual({
      kind: "array",
      elementType: BOOLEAN_TYPE,
    });
    expect(getDataType([null])).toStrictEqual({
      kind: "array",
      elementType: NULL_TYPE,
    });
  });

  test("matchesType for array-number with non-array", () => {
    expect(matchesType("not-array", NUMBER_ARRAY_TYPE)).toBe(false);
  });

  test("matchesType for array-string with non-array", () => {
    expect(matchesType("not-array", STRING_ARRAY_TYPE)).toBe(false);
  });

  test("formatType with union type", () => {
    expect(
      formatType({ kind: "union", types: [NUMBER_TYPE, STRING_TYPE] }),
    ).toBe("number | string");
  });

  test("formatType with union array element type", () => {
    expect(
      formatType({
        kind: "array",
        elementType: { kind: "union", types: [NUMBER_TYPE, STRING_TYPE] },
      }),
    ).toBe("(number | string)[]");
  });

  test("getDataTypeKind returns any for non-standard types", () => {
    expect(getDataTypeKind(Symbol())).toBe("any");
  });

  test("getDataType returns EXPREF_TYPE for expression refs", () => {
    const ref = makeExpressionRef({ type: "current" as const });
    expect(getDataType(ref)).toBe(EXPREF_TYPE);
  });

  test("getDataType returns NULL_TYPE for undefined", () => {
    expect(getDataType(undefined)).toStrictEqual(NULL_TYPE);
  });

  test("getDataType returns ANY_TYPE for non-standard types", () => {
    expect(getDataType(Symbol())).toBe(ANY_TYPE);
  });

  test("matchesType with union type", () => {
    const unionType = {
      kind: "union" as const,
      types: [NUMBER_TYPE, STRING_TYPE],
    };
    expect(matchesType(42, unionType)).toBe(true);
    expect(matchesType("hello", unionType)).toBe(true);
    expect(matchesType(true, unionType)).toBe(false);
  });

  test("asExpressionRef returns null for non-expref values", () => {
    expect(getExpressionRef(null)).toBeNull();
    expect(getExpressionRef(42)).toBeNull();
    expect(getExpressionRef("string")).toBeNull();
    expect(getExpressionRef({ type: "other" })).toBeNull();
    expect(getExpressionRef({})).toBeNull();
  });

  test("asExpressionRef extracts expression from expref", () => {
    const expression = { type: "current" as const };
    expect(getExpressionRef(makeExpressionRef(expression))).toBe(expression);
  });
});
