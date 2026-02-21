import { makeJsonSelectorAccessor } from "../src/access";
import { accessWithJsonSelector, bindJsonSelectorAccessor } from "../src/bind";
import { NUMBER_TYPE } from "../src/functions/datatype";
import { FunctionRegistry } from "../src/functions/registry";
import { arg } from "../src/functions/validation";
import { parseJsonSelector } from "../src/parse";

import { expectAccessorError } from "./access-helpers";

describe("bindJsonSelectorAccessor / accessWithJsonSelector", () => {
  test("accessWithJsonSelector returns accessor with valid, path, get, set, delete", () => {
    const obj = { foo: "bar" };
    const acc = accessWithJsonSelector(parseJsonSelector("foo"), obj);

    expect(acc).toMatchObject({ valid: true, path: "foo" });
    expect(acc.get()).toBe("bar");

    acc.set("baz");
    expect(obj.foo).toBe("baz");

    acc.delete();
    expect(obj).toStrictEqual({});
  });

  test("bindJsonSelectorAccessor works with unbound accessor", () => {
    const obj = { x: 1 };
    const unbound = makeJsonSelectorAccessor(parseJsonSelector("x"));
    const bound = bindJsonSelectorAccessor(unbound, obj);

    expect(bound).toMatchObject({
      selector: { type: "identifier", id: "x" },
      valid: true,
      path: "x",
    });
    expect(bound.get()).toBe(1);

    bound.set(2);
    expect(obj.x).toBe(2);

    bound.delete();
    expect(obj).toStrictEqual({});
  });

  test("valid is false for invalid context", () => {
    const acc = accessWithJsonSelector(parseJsonSelector("foo[0]"), {
      foo: "not an array",
    });
    expect(acc.valid).toBe(false);
  });

  describe("getOrThrow", () => {
    test("accessWithJsonSelector exposes getOrThrow", () => {
      const obj = { foo: "bar" };
      const acc = accessWithJsonSelector(parseJsonSelector("foo"), obj);
      expect(acc.getOrThrow()).toBe("bar");
    });

    test("bound getOrThrow throws on invalid context", () => {
      const acc = accessWithJsonSelector(
        parseJsonSelector("foo"),
        "not-an-object",
      );
      expectAccessorError(() => acc.getOrThrow(), "TYPE_MISMATCH", "get");
    });

    test("bindJsonSelectorAccessor exposes getOrThrow", () => {
      const obj = { x: 1 };
      const unbound = makeJsonSelectorAccessor(parseJsonSelector("x"));
      const bound = bindJsonSelectorAccessor(unbound, obj);
      expect(bound.getOrThrow()).toBe(1);
    });
  });

  describe("setOrThrow / deleteOrThrow", () => {
    test("accessWithJsonSelector exposes and delegates setOrThrow/deleteOrThrow", () => {
      const obj = { foo: 1 };
      const acc = accessWithJsonSelector(parseJsonSelector("foo"), obj);
      acc.setOrThrow(2);
      expect(obj).toStrictEqual({ foo: 2 });
      acc.deleteOrThrow();
      expect(obj).toStrictEqual({});
    });

    test("bindJsonSelectorAccessor exposes and delegates setOrThrow/deleteOrThrow", () => {
      const obj = { foo: 1 };
      const unbound = makeJsonSelectorAccessor(parseJsonSelector("foo"));
      const bound = bindJsonSelectorAccessor(unbound, obj);
      bound.setOrThrow(2);
      expect(obj).toStrictEqual({ foo: 2 });
      bound.deleteOrThrow();
      expect(obj).toStrictEqual({});
    });
  });

  test("custom function provider works with accessWithJsonSelector", () => {
    const registry = new FunctionRegistry();
    registry.register({
      name: "double",
      signatures: [[arg("value", NUMBER_TYPE)]],
      handler: ({ args }) => Number(args[0]) * 2,
    });

    const selector = parseJsonSelector("double(@)");
    const acc = accessWithJsonSelector(selector, 7, 7, {
      functionProvider: registry,
    });
    expect(acc.get()).toBe(14);
  });
});
