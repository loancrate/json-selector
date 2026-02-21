import { makeJsonSelectorAccessor } from "../src/access";
import { NUMBER_TYPE } from "../src/functions/datatype";
import { FunctionRegistry } from "../src/functions/registry";
import { arg } from "../src/functions/validation";
import { parseJsonSelector } from "../src/parse";

import { expectAccessorError } from "./access-helpers";

describe("makeJsonSelectorAccessor", () => {
  // Helper to create accessor from expression string
  const accessor = (expr: string) =>
    makeJsonSelectorAccessor(parseJsonSelector(expr));

  // ============================================================
  // Read-only accessors
  // ============================================================
  describe("literal (`value`)", () => {
    test("get returns string value", () => {
      const acc = accessor('`"hello"`');
      expect(acc.get({})).toBe("hello");
    });

    test("get returns number value", () => {
      const acc = accessor("`42`");
      expect(acc.get({})).toBe(42);
    });

    test("get returns boolean true", () => {
      const acc = accessor("`true`");
      expect(acc.get({})).toBe(true);
    });

    test("get returns boolean false", () => {
      const acc = accessor("`false`");
      expect(acc.get({})).toBe(false);
    });

    test("get returns null", () => {
      const acc = accessor("`null`");
      expect(acc.get({})).toBeNull();
    });

    test("get returns array", () => {
      const acc = accessor("`[1,2,3]`");
      expect(acc.get({})).toStrictEqual([1, 2, 3]);
    });

    test("get returns object", () => {
      const acc = accessor('`{"a":1}`');
      expect(acc.get({})).toStrictEqual({ a: 1 });
    });

    test("set is no-op", () => {
      const acc = accessor('`"hello"`');
      const obj = { x: 1 };
      acc.set("changed", obj);
      expect(obj).toStrictEqual({ x: 1 });
      expect(acc.get(obj)).toBe("hello");
    });

    test("delete is no-op", () => {
      const acc = accessor('`"hello"`');
      const obj = { x: 1 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ x: 1 });
      expect(acc.get(obj)).toBe("hello");
    });

    test("isValidContext always returns true", () => {
      const acc = accessor('`"hello"`');
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext(undefined)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
      expect(acc.isValidContext([])).toBe(true);
    });
  });

  describe("current (@)", () => {
    test("get returns context", () => {
      const acc = accessor("@");
      const obj = { a: 1 };
      expect(acc.get(obj)).toBe(obj);
    });

    test("get returns primitive context", () => {
      const acc = accessor("@");
      expect(acc.get(42)).toBe(42);
      expect(acc.get("hello")).toBe("hello");
      expect(acc.get(null)).toBeNull();
    });

    test("set is no-op", () => {
      const acc = accessor("@");
      const obj = { a: 1 };
      acc.set("changed", obj);
      expect(obj).toStrictEqual({ a: 1 });
    });

    test("delete is no-op", () => {
      const acc = accessor("@");
      const obj = { a: 1 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ a: 1 });
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("@");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });
  });

  describe("root ($)", () => {
    test("get returns rootContext when provided", () => {
      const acc = accessor("$");
      const context = { a: 1 };
      const root = { b: 2 };
      expect(acc.get(context, root)).toBe(root);
    });

    test("get returns context when rootContext omitted", () => {
      const acc = accessor("$");
      const context = { a: 1 };
      expect(acc.get(context)).toBe(context);
    });

    test("set is no-op", () => {
      const acc = accessor("$");
      const obj = { a: 1 };
      acc.set("changed", obj);
      expect(obj).toStrictEqual({ a: 1 });
    });

    test("delete is no-op", () => {
      const acc = accessor("$");
      const obj = { a: 1 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ a: 1 });
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("$");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });
  });

  describe("not (!)", () => {
    test("get returns true for null", () => {
      const acc = accessor("!@");
      expect(acc.get(null)).toBe(true);
    });

    test("get returns true for false", () => {
      const acc = accessor("!@");
      expect(acc.get(false)).toBe(true);
    });

    test("get returns true for empty string", () => {
      const acc = accessor("!@");
      expect(acc.get("")).toBe(true);
    });

    test("get returns true for empty array", () => {
      const acc = accessor("!@");
      expect(acc.get([])).toBe(true);
    });

    test("get returns true for empty object", () => {
      const acc = accessor("!@");
      expect(acc.get({})).toBe(true);
    });

    test("get returns false for truthy values", () => {
      const acc = accessor("!@");
      expect(acc.get(true)).toBe(false);
      expect(acc.get(1)).toBe(false);
      expect(acc.get("hello")).toBe(false);
      expect(acc.get([1])).toBe(false);
      expect(acc.get({ a: 1 })).toBe(false);
    });

    test("set is no-op", () => {
      const acc = accessor("!foo");
      const obj = { foo: false };
      acc.set(false, obj);
      expect(obj.foo).toBe(false);
    });

    test("delete is no-op", () => {
      const acc = accessor("!foo");
      const obj = { foo: false };
      acc.delete(obj);
      expect(obj).toStrictEqual({ foo: false });
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("!foo");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });
  });

  describe("compare (==, !=, <, <=, >, >=)", () => {
    test("== with equal values", () => {
      const acc = accessor("foo == `1`");
      expect(acc.get({ foo: 1 })).toBe(true);
      expect(acc.get({ foo: "1" })).toBe(false);
    });

    test("== with different values", () => {
      const acc = accessor("foo == `1`");
      expect(acc.get({ foo: 2 })).toBe(false);
    });

    test("!= opposite", () => {
      const acc = accessor("foo != `1`");
      expect(acc.get({ foo: 1 })).toBe(false);
      expect(acc.get({ foo: 2 })).toBe(true);
    });

    test("< with numbers", () => {
      const acc = accessor("foo < `5`");
      expect(acc.get({ foo: 3 })).toBe(true);
      expect(acc.get({ foo: 5 })).toBe(false);
      expect(acc.get({ foo: 7 })).toBe(false);
    });

    test("<= with numbers", () => {
      const acc = accessor("foo <= `5`");
      expect(acc.get({ foo: 3 })).toBe(true);
      expect(acc.get({ foo: 5 })).toBe(true);
      expect(acc.get({ foo: 7 })).toBe(false);
    });

    test("> with numbers", () => {
      const acc = accessor("foo > `5`");
      expect(acc.get({ foo: 3 })).toBe(false);
      expect(acc.get({ foo: 5 })).toBe(false);
      expect(acc.get({ foo: 7 })).toBe(true);
    });

    test(">= with numbers", () => {
      const acc = accessor("foo >= `5`");
      expect(acc.get({ foo: 3 })).toBe(false);
      expect(acc.get({ foo: 5 })).toBe(true);
      expect(acc.get({ foo: 7 })).toBe(true);
    });

    test("comparison with non-numbers returns null", () => {
      const acc = accessor("foo < `5`");
      expect(acc.get({ foo: "string" })).toBeNull();
      expect(acc.get({ foo: null })).toBeNull();
    });

    test("set is no-op", () => {
      const acc = accessor("foo == `1`");
      const obj = { foo: 1 };
      acc.set(false, obj);
      expect(obj.foo).toBe(1);
    });

    test("delete is no-op", () => {
      const acc = accessor("foo == `1`");
      const obj = { foo: 1 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ foo: 1 });
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("foo == `1`");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });
  });

  describe("arithmetic (+, -, *, /, %, //)", () => {
    test("get computes arithmetic value", () => {
      const acc = accessor("a * b + c");
      expect(acc.get({ a: 2, b: 3, c: 4 })).toBe(10);
    });

    test("unary arithmetic computes value", () => {
      expect(accessor("-a").get({ a: 5 })).toBe(-5);
      expect(accessor("+a").get({ a: 5 })).toBe(5);
    });

    test("set is no-op", () => {
      const acc = accessor("a + b");
      const obj = { a: 1, b: 2 };
      acc.set(100, obj);
      expect(obj).toStrictEqual({ a: 1, b: 2 });
      expect(acc.get(obj)).toBe(3);
    });

    test("delete is no-op", () => {
      const acc = accessor("-a");
      const obj = { a: 2 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ a: 2 });
      expect(acc.get(obj)).toBe(-2);
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("a + b");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });
  });

  describe("and (&&)", () => {
    test("returns lhs if falsy (short-circuit)", () => {
      const acc = accessor("foo && bar");
      expect(acc.get({ foo: null, bar: "value" })).toBeNull();
      expect(acc.get({ foo: false, bar: "value" })).toBe(false);
      expect(acc.get({ foo: [], bar: "value" })).toStrictEqual([]);
    });

    test("returns rhs if lhs truthy", () => {
      const acc = accessor("foo && bar");
      expect(acc.get({ foo: true, bar: "value" })).toBe("value");
      expect(acc.get({ foo: 1, bar: "result" })).toBe("result");
    });

    test("set is no-op", () => {
      const acc = accessor("foo && bar");
      const obj = { foo: true, bar: "value" };
      acc.set("changed", obj);
      expect(obj).toStrictEqual({ foo: true, bar: "value" });
    });

    test("delete is no-op", () => {
      const acc = accessor("foo && bar");
      const obj = { foo: true, bar: "value" };
      acc.delete(obj);
      expect(obj).toStrictEqual({ foo: true, bar: "value" });
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("foo && bar");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });
  });

  describe("or (||)", () => {
    test("returns lhs if truthy (short-circuit)", () => {
      const acc = accessor("foo || bar");
      expect(acc.get({ foo: "value", bar: "other" })).toBe("value");
      expect(acc.get({ foo: 1, bar: 2 })).toBe(1);
    });

    test("returns rhs if lhs falsy", () => {
      const acc = accessor("foo || bar");
      expect(acc.get({ foo: null, bar: "fallback" })).toBe("fallback");
      expect(acc.get({ foo: false, bar: true })).toBe(true);
      expect(acc.get({ foo: [], bar: "default" })).toBe("default");
    });

    test("set is no-op", () => {
      const acc = accessor("foo || bar");
      const obj = { foo: null, bar: "value" };
      acc.set("changed", obj);
      expect(obj).toStrictEqual({ foo: null, bar: "value" });
    });

    test("delete is no-op", () => {
      const acc = accessor("foo || bar");
      const obj = { foo: null, bar: "value" };
      acc.delete(obj);
      expect(obj).toStrictEqual({ foo: null, bar: "value" });
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("foo || bar");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });
  });

  describe("ternary (?:)", () => {
    test("returns consequent when condition is truthy", () => {
      const acc = accessor("cond ? yes : no");
      expect(acc.get({ cond: 1, yes: "selected", no: "fallback" })).toBe(
        "selected",
      );
    });

    test("returns alternate when condition is falsy by JMESPath rules", () => {
      const acc = accessor("cond ? yes : no");
      expect(acc.get({ cond: [], yes: "selected", no: "fallback" })).toBe(
        "fallback",
      );
    });

    test("set is no-op", () => {
      const acc = accessor("cond ? yes : no");
      const obj = { cond: true, yes: "selected", no: "fallback" };
      acc.set("changed", obj);
      expect(obj).toStrictEqual({
        cond: true,
        yes: "selected",
        no: "fallback",
      });
    });

    test("delete is no-op", () => {
      const acc = accessor("cond ? yes : no");
      const obj = { cond: false, yes: "selected", no: "fallback" };
      acc.delete(obj);
      expect(obj).toStrictEqual({
        cond: false,
        yes: "selected",
        no: "fallback",
      });
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("cond ? yes : no");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });
  });

  // ============================================================
  // Mutable accessors
  // ============================================================
  describe("identifier (field)", () => {
    test("get existing field", () => {
      const acc = accessor("foo");
      expect(acc.get({ foo: "bar" })).toBe("bar");
    });

    test("get missing field returns null", () => {
      const acc = accessor("foo");
      expect(acc.get({})).toBeNull();
    });

    test("get from non-object returns null", () => {
      const acc = accessor("foo");
      expect(acc.get(null)).toBeNull();
      expect(acc.get("string")).toBeNull();
      expect(acc.get(42)).toBeNull();
    });

    test("set on object", () => {
      const acc = accessor("foo");
      const obj = { foo: "old" };
      acc.set("new", obj);
      expect(obj.foo).toBe("new");
    });

    test("set on non-object is no-op", () => {
      const acc = accessor("foo");
      const value = "string";
      acc.set("new", value);
      expect(value).toBe("string");
    });

    test("delete existing field", () => {
      const acc = accessor("foo");
      const obj = { foo: "bar", other: 1 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ other: 1 });
    });

    test("delete missing field is no-op", () => {
      const acc = accessor("foo");
      const obj = { other: 1 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ other: 1 });
    });

    test("delete on non-object is no-op", () => {
      const acc = accessor("foo");
      const value = "string";
      acc.delete(value);
      expect(value).toBe("string");
    });

    test("isValidContext returns true for objects", () => {
      const acc = accessor("foo");
      expect(acc.isValidContext({ foo: 1 })).toBe(true);
      expect(acc.isValidContext({})).toBe(true);
    });

    test("isValidContext returns false for non-objects", () => {
      const acc = accessor("foo");
      expect(acc.isValidContext(null)).toBe(false);
      expect(acc.isValidContext("string")).toBe(false);
      expect(acc.isValidContext(42)).toBe(false);
      expect(acc.isValidContext([])).toBe(false);
    });
  });

  describe("fieldAccess (a.b)", () => {
    test("get nested field", () => {
      const acc = accessor("a.b");
      expect(acc.get({ a: { b: "value" } })).toBe("value");
    });

    test("get with null intermediate returns null", () => {
      const acc = accessor("a.b");
      expect(acc.get({ a: null })).toBeNull();
      expect(acc.get({})).toBeNull();
    });

    test("set nested field", () => {
      const acc = accessor("a.b");
      const obj = { a: { b: "old" } };
      acc.set("new", obj);
      expect(obj.a.b).toBe("new");
    });

    test("set with null intermediate is no-op", () => {
      const acc = accessor("a.b");
      const obj = { a: null };
      acc.set("new", obj);
      expect(obj).toStrictEqual({ a: null });
    });

    test("delete nested field", () => {
      const acc = accessor("a.b");
      const obj = { a: { b: "value", c: 1 } };
      acc.delete(obj);
      expect(obj).toStrictEqual({ a: { c: 1 } });
    });

    test("delete with null intermediate is no-op", () => {
      const acc = accessor("a.b");
      const obj = { a: null };
      acc.delete(obj);
      expect(obj).toStrictEqual({ a: null });
    });

    test("isValidContext validates chain", () => {
      const acc = accessor("a.b");
      expect(acc.isValidContext({ a: { b: 1 } })).toBe(true);
      expect(acc.isValidContext({ a: {} })).toBe(true);
      expect(acc.isValidContext({ a: null })).toBe(false);
      expect(acc.isValidContext({})).toBe(false);
    });
  });

  describe("indexAccess (a[0])", () => {
    test("get positive index", () => {
      const acc = accessor("a[1]");
      expect(acc.get({ a: [10, 20, 30] })).toBe(20);
    });

    test("get negative index", () => {
      const acc = accessor("a[-1]");
      expect(acc.get({ a: [10, 20, 30] })).toBe(30);
    });

    test("get out-of-bounds returns null", () => {
      const acc = accessor("a[10]");
      expect(acc.get({ a: [1, 2, 3] })).toBeNull();
    });

    test("get from non-array returns null", () => {
      const acc = accessor("a[0]");
      expect(acc.get({ a: "string" })).toBeNull();
      expect(acc.get({ a: null })).toBeNull();
    });

    test("set existing index", () => {
      const acc = accessor("a[1]");
      const obj = { a: [10, 20, 30] };
      acc.set(99, obj);
      expect(obj.a).toStrictEqual([10, 99, 30]);
    });

    test("set negative index sets from end of array", () => {
      const acc = accessor("a[-1]");
      const obj = { a: [10, 20, 30] };
      acc.set(99, obj);
      expect(obj.a).toStrictEqual([10, 20, 99]);
    });

    test("set on non-array is no-op", () => {
      const acc = accessor("a[0]");
      const obj = { a: "string" };
      acc.set(99, obj);
      expect(obj.a).toBe("string");
    });

    test("delete splices array", () => {
      const acc = accessor("a[1]");
      const obj = { a: [10, 20, 30] };
      acc.delete(obj);
      expect(obj.a).toStrictEqual([10, 30]);
    });

    test("delete on non-array is no-op", () => {
      const acc = accessor("a[0]");
      const obj = { a: "string" };
      acc.delete(obj);
      expect(obj.a).toBe("string");
    });

    test("isValidContext for arrays", () => {
      const acc = accessor("a[0]");
      expect(acc.isValidContext({ a: [1] })).toBe(true);
      expect(acc.isValidContext({ a: [] })).toBe(true);
      expect(acc.isValidContext({ a: "string" })).toBe(false);
      expect(acc.isValidContext({ a: null })).toBe(false);
    });
  });

  describe("idAccess (a['id'])", () => {
    test("get by id found", () => {
      const acc = accessor("items['x']");
      const obj = {
        items: [
          { id: "a", v: 1 },
          { id: "x", v: 2 },
          { id: "b", v: 3 },
        ],
      };
      expect(acc.get(obj)).toStrictEqual({ id: "x", v: 2 });
    });

    test("get by id not found", () => {
      const acc = accessor("items['missing']");
      const obj = {
        items: [
          { id: "a", v: 1 },
          { id: "b", v: 2 },
        ],
      };
      expect(acc.get(obj)).toBeNull();
    });

    test("set replaces when found", () => {
      const acc = accessor("items['x']");
      const obj = {
        items: [
          { id: "a", v: 1 },
          { id: "x", v: 2 },
        ],
      };
      acc.set({ id: "x", v: 99 }, obj);
      expect(obj.items[1]).toStrictEqual({ id: "x", v: 99 });
    });

    test("set when not found is no-op", () => {
      const acc = accessor("items['missing']");
      const obj = {
        items: [{ id: "a", v: 1 }],
      };
      acc.set({ id: "missing", v: 99 }, obj);
      expect(obj.items).toStrictEqual([{ id: "a", v: 1 }]);
    });

    test("set on non-array is no-op", () => {
      const acc = accessor("items['x']");
      const obj = { items: "string" };
      acc.set({ id: "x", v: 1 }, obj);
      expect(obj.items).toBe("string");
    });

    test("delete removes when found", () => {
      const acc = accessor("items['x']");
      const obj = {
        items: [
          { id: "a", v: 1 },
          { id: "x", v: 2 },
          { id: "b", v: 3 },
        ],
      };
      acc.delete(obj);
      expect(obj.items).toStrictEqual([
        { id: "a", v: 1 },
        { id: "b", v: 3 },
      ]);
    });

    test("delete when not found is no-op", () => {
      const acc = accessor("items['missing']");
      const obj = {
        items: [{ id: "a", v: 1 }],
      };
      acc.delete(obj);
      expect(obj.items).toStrictEqual([{ id: "a", v: 1 }]);
    });

    test("delete on non-array is no-op", () => {
      const acc = accessor("items['x']");
      const obj = { items: "string" };
      acc.delete(obj);
      expect(obj.items).toBe("string");
    });

    test("isValidContext true for arrays", () => {
      const acc = accessor("items['x']");
      expect(acc.isValidContext({ items: [] })).toBe(true);
      expect(acc.isValidContext({ items: [{ id: "x" }] })).toBe(true);
      expect(acc.isValidContext({ items: "string" })).toBe(false);
      expect(acc.isValidContext({ items: null })).toBe(false);
    });
  });

  describe("project (a[*] / a[].b)", () => {
    describe("without explicit projection (projection undefined)", () => {
      // Construct AST directly with projection undefined to test lines 239, 251
      test("get returns array elements", () => {
        const acc = makeJsonSelectorAccessor({
          type: "project",
          expression: { type: "identifier", id: "a" },
          // projection is undefined
        });
        expect(acc.get({ a: [1, 2, 3] })).toStrictEqual([1, 2, 3]);
      });

      test("set replaces entire array", () => {
        const acc = makeJsonSelectorAccessor({
          type: "project",
          expression: { type: "identifier", id: "a" },
        });
        const obj = { a: [1, 2, 3] };
        acc.set([10, 20], obj);
        expect(obj.a).toStrictEqual([10, 20]);
      });

      test("set with single value wraps in array", () => {
        const acc = makeJsonSelectorAccessor({
          type: "project",
          expression: { type: "identifier", id: "a" },
        });
        const obj = { a: [1, 2, 3] };
        acc.set(99, obj);
        expect(obj.a).toStrictEqual([99]);
      });

      test("delete clears array", () => {
        const acc = makeJsonSelectorAccessor({
          type: "project",
          expression: { type: "identifier", id: "a" },
        });
        const obj = { a: [1, 2, 3] };
        acc.delete(obj);
        expect(obj.a).toStrictEqual([]);
      });
    });

    describe("with projection (a[*].b)", () => {
      test("get projects field from each element", () => {
        const acc = accessor("a[*].b");
        expect(
          acc.get({
            a: [{ b: 1 }, { b: 2 }, { b: 3 }],
          }),
        ).toStrictEqual([1, 2, 3]);
      });

      test("set applies value to each element", () => {
        const acc = accessor("a[*].b");
        const obj = { a: [{ b: 1 }, { b: 2 }] };
        acc.set(99, obj);
        expect(obj.a).toStrictEqual([{ b: 99 }, { b: 99 }]);
      });

      test("delete removes field from each element", () => {
        const acc = accessor("a[*].b");
        const obj = {
          a: [
            { b: 1, c: 10 },
            { b: 2, c: 20 },
          ],
        };
        acc.delete(obj);
        expect(obj.a).toStrictEqual([{ c: 10 }, { c: 20 }]);
      });
    });

    describe("with current projection (a[*])", () => {
      // a[*] parses to projection: { type: "current" }
      test("get returns array elements", () => {
        const acc = accessor("a[*]");
        expect(acc.get({ a: [1, 2, 3] })).toStrictEqual([1, 2, 3]);
      });

      test("set replaces array contents", () => {
        const acc = accessor("a[*]");
        const obj = { a: [1, 2, 3] };
        acc.set([10, 20], obj);
        expect(obj.a).toStrictEqual([10, 20]);
      });

      test("delete clears array", () => {
        const acc = accessor("a[*]");
        const obj = { a: [1, 2, 3] };
        acc.delete(obj);
        expect(obj.a).toStrictEqual([]);
      });
    });

    test("get on non-array returns null", () => {
      const acc = accessor("a[*]");
      expect(acc.get({ a: "string" })).toBeNull();
    });

    test("set on non-array is no-op", () => {
      const acc = accessor("a[*]");
      const obj = { a: "string" };
      acc.set([1, 2], obj);
      expect(obj.a).toBe("string");
    });

    test("delete on non-array is no-op", () => {
      const acc = accessor("a[*]");
      const obj = { a: "string" };
      acc.delete(obj);
      expect(obj.a).toBe("string");
    });

    test("isValidContext for arrays", () => {
      const acc = accessor("a[*]");
      expect(acc.isValidContext({ a: [] })).toBe(true);
      expect(acc.isValidContext({ a: [1] })).toBe(true);
      expect(acc.isValidContext({ a: "string" })).toBe(false);
      expect(acc.isValidContext({ a: null })).toBe(false);
    });
  });

  describe("objectProject accessor (@.*)", () => {
    describe("without explicit projection (projection undefined)", () => {
      test("get returns object values", () => {
        const acc = makeJsonSelectorAccessor({
          type: "objectProject",
          expression: { type: "current", explicit: true },
          // projection is undefined
        });
        expect(acc.get({ a: 1, b: 2 })).toStrictEqual([1, 2]);
      });

      test("set sets all values", () => {
        const acc = makeJsonSelectorAccessor({
          type: "objectProject",
          expression: { type: "current", explicit: true },
        });
        const obj = { a: 1, b: 2 };
        acc.set(99, obj);
        expect(obj).toStrictEqual({ a: 99, b: 99 });
      });

      test("delete clears all keys", () => {
        const acc = makeJsonSelectorAccessor({
          type: "objectProject",
          expression: { type: "current", explicit: true },
        });
        const obj = { a: 1, b: 2 };
        acc.delete(obj);
        expect(obj).toStrictEqual({});
      });
    });

    describe("with projection (@.*.name)", () => {
      test("get projects field from each value", () => {
        const acc = accessor("@.*.name");
        expect(
          acc.get({ x: { name: "alice" }, y: { name: "bob" } }),
        ).toStrictEqual(["alice", "bob"]);
      });

      test("set applies value to each value", () => {
        const acc = accessor("@.*.name");
        const obj = { x: { name: "alice" }, y: { name: "bob" } };
        acc.set("updated", obj);
        expect(obj).toStrictEqual({
          x: { name: "updated" },
          y: { name: "updated" },
        });
      });

      test("delete removes field from each value", () => {
        const acc = accessor("@.*.name");
        const obj = {
          x: { name: "alice", age: 1 },
          y: { name: "bob", age: 2 },
        };
        acc.delete(obj);
        expect(obj).toStrictEqual({ x: { age: 1 }, y: { age: 2 } });
      });
    });

    describe("with current projection (@.*)", () => {
      test("get returns object values", () => {
        const acc = accessor("@.*");
        expect(acc.get({ a: 1, b: 2 })).toStrictEqual([1, 2]);
      });

      test("get returns values with explicit current AST", () => {
        const acc = makeJsonSelectorAccessor({
          type: "objectProject",
          expression: { type: "current", explicit: true },
          projection: { type: "current" },
        });
        expect(acc.get({ a: 1, b: 2 })).toStrictEqual([1, 2]);
      });

      test("set sets all values", () => {
        const acc = accessor("@.*");
        const obj = { a: 1, b: 2 };
        acc.set(99, obj);
        expect(obj).toStrictEqual({ a: 99, b: 99 });
      });

      test("delete clears all keys", () => {
        const acc = accessor("@.*");
        const obj = { a: 1, b: 2 };
        acc.delete(obj);
        expect(obj).toStrictEqual({});
      });
    });

    test("get on non-object returns null", () => {
      const acc = accessor("@.*");
      expect(acc.get("string")).toBeNull();
      expect(acc.get([1, 2])).toBeNull();
    });

    test("set on non-object is no-op", () => {
      const acc = accessor("@.*");
      const arr = [1, 2];
      acc.set(99, arr);
      expect(arr).toStrictEqual([1, 2]);
    });

    test("delete on non-object is no-op", () => {
      const acc = accessor("@.*");
      const arr = [1, 2];
      acc.delete(arr);
      expect(arr).toStrictEqual([1, 2]);
    });

    test("isValidContext checks for object", () => {
      const acc = accessor("@.*");
      expect(acc.isValidContext(null)).toBe(false);
      expect(acc.isValidContext([1])).toBe(false);
      expect(acc.isValidContext({})).toBe(true);
      expect(acc.isValidContext({ a: 1 })).toBe(true);
    });
  });

  describe("filter (a[?cond])", () => {
    test("get filters results", () => {
      const acc = accessor("items[?active == `true`]");
      const obj = {
        items: [
          { id: 1, active: true },
          { id: 2, active: false },
          { id: 3, active: true },
        ],
      };
      expect(acc.get(obj)).toStrictEqual([
        { id: 1, active: true },
        { id: 3, active: true },
      ]);
    });

    test("get on non-array returns null", () => {
      const acc = accessor("items[?active]");
      expect(acc.get({ items: "string" })).toBeNull();
    });

    test("set preserves non-matching, adds new", () => {
      const acc = accessor("items[?active == `true`]");
      const obj = {
        items: [
          { id: 1, active: true },
          { id: 2, active: false },
        ],
      };
      acc.set([{ id: 99, active: true }], obj);
      expect(obj.items).toStrictEqual([
        { id: 2, active: false },
        { id: 99, active: true },
      ]);
    });

    test("set with single value", () => {
      const acc = accessor("items[?active == `true`]");
      const obj = {
        items: [
          { id: 1, active: true },
          { id: 2, active: false },
        ],
      };
      acc.set({ id: 99, active: true }, obj);
      expect(obj.items).toStrictEqual([
        { id: 2, active: false },
        { id: 99, active: true },
      ]);
    });

    test("set on non-array is no-op", () => {
      const acc = accessor("items[?active]");
      const obj = { items: "string" };
      acc.set([{ active: true }], obj);
      expect(obj.items).toBe("string");
    });

    test("delete keeps only non-matching", () => {
      const acc = accessor("items[?active == `true`]");
      const obj = {
        items: [
          { id: 1, active: true },
          { id: 2, active: false },
          { id: 3, active: true },
        ],
      };
      acc.delete(obj);
      expect(obj.items).toStrictEqual([{ id: 2, active: false }]);
    });

    test("delete on non-array is no-op", () => {
      const acc = accessor("items[?active]");
      const obj = { items: "string" };
      acc.delete(obj);
      expect(obj.items).toBe("string");
    });

    test("isValidContext for arrays", () => {
      const acc = accessor("items[?active]");
      expect(acc.isValidContext({ items: [] })).toBe(true);
      expect(acc.isValidContext({ items: [1] })).toBe(true);
      expect(acc.isValidContext({ items: "string" })).toBe(false);
      expect(acc.isValidContext({ items: null })).toBe(false);
    });
  });

  describe("slice (a[start:end:step])", () => {
    test("get with default params", () => {
      const acc = accessor("a[:]");
      expect(acc.get({ a: [1, 2, 3, 4, 5] })).toStrictEqual([1, 2, 3, 4, 5]);
    });

    test("get with start and end", () => {
      const acc = accessor("a[1:3]");
      expect(acc.get({ a: [1, 2, 3, 4, 5] })).toStrictEqual([2, 3]);
    });

    test("get with step", () => {
      const acc = accessor("a[::2]");
      expect(acc.get({ a: [1, 2, 3, 4, 5] })).toStrictEqual([1, 3, 5]);
    });

    test("get with negative step", () => {
      const acc = accessor("a[::-1]");
      expect(acc.get({ a: [1, 2, 3, 4, 5] })).toStrictEqual([5, 4, 3, 2, 1]);
    });

    test("get with string", () => {
      const acc = accessor("a[1:3]");
      expect(acc.get({ a: "foobar" })).toBe("oo");
    });

    test("get with string step", () => {
      const acc = accessor("a[::2]");
      expect(acc.get({ a: "abcdef" })).toBe("ace");
    });

    test("get with string negative step", () => {
      const acc = accessor("a[::-1]");
      expect(acc.get({ a: "foobar" })).toBe("raboof");
    });

    test("get with unicode string uses code points", () => {
      const acc = accessor("a[1:3]");
      expect(
        acc.get({ a: "\ud83d\ude00\ud83d\ude03\ud83d\ude04\ud83d\ude01" }),
      ).toBe("\ud83d\ude03\ud83d\ude04");
    });

    test("get on non-array/non-string returns null", () => {
      const acc = accessor("a[1:3]");
      expect(acc.get({ a: { value: "string" } })).toBeNull();
    });

    test("set with positive step", () => {
      const acc = accessor("a[1:3]");
      const obj = { a: [1, 2, 3, 4, 5] };
      acc.set([99], obj);
      expect(obj.a).toStrictEqual([1, 4, 5, 99]);
    });

    test("set with step > 1", () => {
      const acc = accessor("a[::2]");
      const obj = { a: [1, 2, 3, 4, 5] };
      acc.set([100, 200], obj);
      expect(obj.a).toStrictEqual([2, 4, 100, 200]);
    });

    test("set with negative step", () => {
      const acc = accessor("a[::-1]");
      const obj = { a: [1, 2, 3] };
      acc.set([99], obj);
      expect(obj.a).toStrictEqual([99]);
    });

    test("set on non-array is no-op", () => {
      const acc = accessor("a[1:3]");
      const obj = { a: "string" };
      acc.set([99], obj);
      expect(obj.a).toBe("string");
    });

    test("delete sliced elements", () => {
      const acc = accessor("a[1:3]");
      const obj = { a: [1, 2, 3, 4, 5] };
      acc.delete(obj);
      expect(obj.a).toStrictEqual([1, 4, 5]);
    });

    test("delete with step", () => {
      const acc = accessor("a[::2]");
      const obj = { a: [1, 2, 3, 4, 5] };
      acc.delete(obj);
      expect(obj.a).toStrictEqual([2, 4]);
    });

    test("delete on non-array is no-op", () => {
      const acc = accessor("a[1:3]");
      const obj = { a: "string" };
      acc.delete(obj);
      expect(obj.a).toBe("string");
    });

    test("isValidContext for arrays and strings", () => {
      const acc = accessor("a[1:3]");
      expect(acc.isValidContext({ a: [] })).toBe(true);
      expect(acc.isValidContext({ a: [1, 2, 3] })).toBe(true);
      expect(acc.isValidContext({ a: "string" })).toBe(true);
      expect(acc.isValidContext({ a: null })).toBe(false);
    });
  });

  describe("flatten (a[])", () => {
    test("get flattens one level", () => {
      const acc = accessor("a[]");
      expect(
        acc.get({
          a: [
            [1, 2],
            [3, 4],
          ],
        }),
      ).toStrictEqual([1, 2, 3, 4]);
    });

    test("get includes non-arrays (flat behavior)", () => {
      const acc = accessor("a[]");
      // Array.flat() includes non-array elements as-is
      expect(acc.get({ a: [[1, 2], "keep", [3, 4]] })).toStrictEqual([
        1,
        2,
        "keep",
        3,
        4,
      ]);
    });

    test("get on non-array returns null", () => {
      const acc = accessor("a[]");
      expect(acc.get({ a: "string" })).toBeNull();
    });

    test("set replaces array", () => {
      const acc = accessor("a[]");
      const obj = { a: [[1], [2]] };
      acc.set([10, 20], obj);
      expect(obj.a).toStrictEqual([10, 20]);
    });

    test("set with single value wraps", () => {
      const acc = accessor("a[]");
      const obj = { a: [[1], [2]] };
      acc.set(99, obj);
      expect(obj.a).toStrictEqual([99]);
    });

    test("set on non-array is no-op", () => {
      const acc = accessor("a[]");
      const obj = { a: "string" };
      acc.set([1], obj);
      expect(obj.a).toBe("string");
    });

    test("delete clears array", () => {
      const acc = accessor("a[]");
      const obj = { a: [[1], [2]] };
      acc.delete(obj);
      expect(obj.a).toStrictEqual([]);
    });

    test("delete on non-array is no-op", () => {
      const acc = accessor("a[]");
      const obj = { a: "string" };
      acc.delete(obj);
      expect(obj.a).toBe("string");
    });

    test("isValidContext for arrays", () => {
      const acc = accessor("a[]");
      expect(acc.isValidContext({ a: [] })).toBe(true);
      expect(acc.isValidContext({ a: [[1]] })).toBe(true);
      expect(acc.isValidContext({ a: "string" })).toBe(false);
      expect(acc.isValidContext({ a: null })).toBe(false);
    });
  });

  describe("pipe (a | b)", () => {
    test("get chains context", () => {
      const acc = accessor("a | b");
      expect(acc.get({ a: { b: "value" } })).toBe("value");
    });

    test("set chains context", () => {
      const acc = accessor("a | b");
      const obj = { a: { b: "old" } };
      acc.set("new", obj);
      expect(obj.a.b).toBe("new");
    });

    test("delete chains context", () => {
      const acc = accessor("a | b");
      const obj = { a: { b: "value", c: 1 } };
      acc.delete(obj);
      expect(obj.a).toStrictEqual({ c: 1 });
    });

    test("isValidContext validates full chain", () => {
      const acc = accessor("a | b");
      expect(acc.isValidContext({ a: { b: 1 } })).toBe(true);
      expect(acc.isValidContext({ a: {} })).toBe(true);
      expect(acc.isValidContext({ a: null })).toBe(false);
      expect(acc.isValidContext({})).toBe(false);
    });

    test("get with null intermediate returns null", () => {
      const acc = accessor("a | b");
      expect(acc.get({ a: null })).toBeNull();
      expect(acc.get({})).toBeNull();
    });
  });

  // ============================================================
  // Read-only accessors
  // ============================================================
  describe("functionCall accessor", () => {
    test("get evaluates function", () => {
      const acc = accessor("length(@)");
      expect(acc.get([1, 2, 3])).toBe(3);
    });

    test("set is no-op", () => {
      const acc = accessor("length(@)");
      const obj = [1, 2, 3];
      acc.set(99, obj);
      expect(obj).toStrictEqual([1, 2, 3]);
    });

    test("delete is no-op", () => {
      const acc = accessor("length(@)");
      const obj = [1, 2, 3];
      acc.delete(obj);
      expect(obj).toStrictEqual([1, 2, 3]);
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("length(@)");
      expect(acc.isValidContext(null)).toBe(true);
      expect(acc.isValidContext([])).toBe(true);
    });
  });

  describe("let/variableRef accessors", () => {
    test("let accessor get evaluates scoped variable references", () => {
      const acc = accessor("let $x = foo in $x");
      expect(acc.get({ foo: "bar" })).toBe("bar");
    });

    test("let accessor set/delete are no-ops", () => {
      const acc = accessor("let $x = foo in $x");
      const obj = { foo: "bar" };
      acc.set("changed", obj);
      acc.delete(obj);
      expect(obj).toStrictEqual({ foo: "bar" });
    });

    test("variableRef accessor get throws when unbound", () => {
      const acc = accessor("$foo");
      expect(() => acc.get({ foo: "bar" })).toThrow("Undefined variable: $foo");
    });

    test("variableRef accessor set/delete are no-ops", () => {
      const acc = accessor("$foo");
      const obj = { foo: "bar" };
      acc.set("changed", obj);
      acc.delete(obj);
      expect(obj).toStrictEqual({ foo: "bar" });
    });

    test("isValidContext always returns true", () => {
      expect(accessor("let $x = foo in $x").isValidContext(null)).toBe(true);
      expect(accessor("$foo").isValidContext({})).toBe(true);
    });
  });

  describe("expressionRef accessor", () => {
    test("get returns null", () => {
      const acc = accessor("&foo");
      expect(acc.get({ foo: "bar" })).toBeNull();
    });

    test("set is no-op", () => {
      const acc = accessor("&foo");
      const obj = { foo: "bar" };
      acc.set("changed", obj);
      expect(obj.foo).toBe("bar");
    });

    test("delete is no-op", () => {
      const acc = accessor("&foo");
      const obj = { foo: "bar" };
      acc.delete(obj);
      expect(obj).toStrictEqual({ foo: "bar" });
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("&foo");
      expect(acc.isValidContext(null)).toBe(true);
    });
  });

  describe("multiSelectList accessor", () => {
    test("get returns array of selected values", () => {
      const acc = accessor("[a, b]");
      expect(acc.get({ a: 1, b: 2, c: 3 })).toStrictEqual([1, 2]);
    });

    test("set is no-op", () => {
      const acc = accessor("[a, b]");
      const obj = { a: 1, b: 2 };
      acc.set([10, 20], obj);
      expect(obj).toStrictEqual({ a: 1, b: 2 });
    });

    test("delete is no-op", () => {
      const acc = accessor("[a, b]");
      const obj = { a: 1, b: 2 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ a: 1, b: 2 });
    });

    test("get returns null for null context", () => {
      const acc = accessor("[a, b]");
      expect(acc.get(null)).toBeNull();
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("[a, b]");
      expect(acc.isValidContext(null)).toBe(true);
    });
  });

  describe("multiSelectHash accessor", () => {
    test("get returns object with selected values", () => {
      const acc = accessor("{x: a, y: b}");
      expect(acc.get({ a: 1, b: 2, c: 3 })).toStrictEqual({ x: 1, y: 2 });
    });

    test("set is no-op", () => {
      const acc = accessor("{x: a, y: b}");
      const obj = { a: 1, b: 2 };
      acc.set({ x: 10, y: 20 }, obj);
      expect(obj).toStrictEqual({ a: 1, b: 2 });
    });

    test("delete is no-op", () => {
      const acc = accessor("{x: a, y: b}");
      const obj = { a: 1, b: 2 };
      acc.delete(obj);
      expect(obj).toStrictEqual({ a: 1, b: 2 });
    });

    test("get returns null for null context", () => {
      const acc = accessor("{x: a, y: b}");
      expect(acc.get(null)).toBeNull();
    });

    test("isValidContext always returns true", () => {
      const acc = accessor("{x: a, y: b}");
      expect(acc.isValidContext(null)).toBe(true);
    });
  });

  describe("getOrThrow", () => {
    describe("read-only selectors delegate to get", () => {
      test.each([
        { expr: "`42`", context: {}, expected: 42 },
        { expr: "@", context: { a: 1 }, expected: { a: 1 } },
        { expr: "$", context: { a: 1 }, expected: { a: 1 } },
        { expr: "!@", context: null, expected: true },
        { expr: "foo == `1`", context: { foo: 1 }, expected: true },
        { expr: "a + b", context: { a: 1, b: 2 }, expected: 3 },
        { expr: "-a", context: { a: 5 }, expected: -5 },
        { expr: "foo && bar", context: { foo: true, bar: "v" }, expected: "v" },
        { expr: "foo || bar", context: { foo: null, bar: "v" }, expected: "v" },
        {
          expr: "cond ? yes : no",
          context: { cond: true, yes: "y", no: "n" },
          expected: "y",
        },
        { expr: "length(@)", context: [1, 2, 3], expected: 3 },
        { expr: "&foo", context: { foo: 1 }, expected: null },
        {
          expr: "let $x = foo in $x",
          context: { foo: "bar" },
          expected: "bar",
        },
        { expr: "[a, b]", context: { a: 1, b: 2 }, expected: [1, 2] },
        {
          expr: "{x: a, y: b}",
          context: { a: 1, b: 2 },
          expected: { x: 1, y: 2 },
        },
      ])(
        "$expr getOrThrow returns same as get",
        ({ expr, context, expected }) => {
          const acc = accessor(expr);
          expect(acc.getOrThrow(context)).toStrictEqual(expected);
        },
      );
    });

    describe("identifier", () => {
      test("TYPE_MISMATCH on non-object", () => {
        const acc = accessor("foo");
        expectAccessorError(
          () => acc.getOrThrow("nope"),
          "TYPE_MISMATCH",
          "get",
          "expected object, got string",
        );
        expectAccessorError(
          () => acc.getOrThrow(null),
          "TYPE_MISMATCH",
          "get",
          "expected object, got null",
        );
      });

      test("returns value on valid object", () => {
        const acc = accessor("foo");
        expect(acc.getOrThrow({ foo: "bar" })).toBe("bar");
      });

      test("returns null for missing field on valid object", () => {
        const acc = accessor("foo");
        expect(acc.getOrThrow({})).toBeNull();
      });
    });

    describe("fieldAccess", () => {
      test("MISSING_PARENT when parent is null/undefined", () => {
        const acc = accessor("a.b");
        expectAccessorError(
          () => acc.getOrThrow({ a: null }),
          "MISSING_PARENT",
          "get",
        );
        expectAccessorError(() => acc.getOrThrow({}), "MISSING_PARENT", "get");
      });

      test("TYPE_MISMATCH when parent is wrong type", () => {
        const acc = accessor("a.b");
        expectAccessorError(
          () => acc.getOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected object, got string",
        );
      });

      test("returns value on valid nested object", () => {
        const acc = accessor("a.b");
        expect(acc.getOrThrow({ a: { b: "value" } })).toBe("value");
      });

      test("returns null for missing field on valid parent", () => {
        const acc = accessor("a.b");
        expect(acc.getOrThrow({ a: {} })).toBeNull();
      });
    });

    describe("indexAccess", () => {
      test("MISSING_PARENT when parent is null/undefined", () => {
        const acc = accessor("a[1]");
        expectAccessorError(
          () => acc.getOrThrow({ a: null }),
          "MISSING_PARENT",
          "get",
        );
      });

      test("TYPE_MISMATCH when parent is wrong type", () => {
        const acc = accessor("a[0]");
        expectAccessorError(
          () => acc.getOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected array, got string",
        );
      });

      test("returns null for out-of-bounds index", () => {
        const acc = accessor("a[10]");
        expect(acc.getOrThrow({ a: [1, 2, 3] })).toBeNull();
      });

      test("returns null for out-of-bounds negative index", () => {
        const acc = accessor("a[-5]");
        expect(acc.getOrThrow({ a: [1, 2, 3] })).toBeNull();
      });

      test("returns value for valid index", () => {
        const acc = accessor("a[1]");
        expect(acc.getOrThrow({ a: [10, 20, 30] })).toBe(20);
      });

      test("returns value for valid negative index", () => {
        const acc = accessor("a[-1]");
        expect(acc.getOrThrow({ a: [10, 20, 30] })).toBe(30);
      });
    });

    describe("idAccess", () => {
      test("MISSING_PARENT when parent is null/undefined", () => {
        const acc = accessor("items['x']");
        expectAccessorError(
          () => acc.getOrThrow({ items: null }),
          "MISSING_PARENT",
          "get",
        );
      });

      test("TYPE_MISMATCH when parent is wrong type", () => {
        const acc = accessor("items['x']");
        expectAccessorError(
          () => acc.getOrThrow({ items: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected array, got string",
        );
      });

      test("returns null for missing id", () => {
        const acc = accessor("items['missing']");
        expect(acc.getOrThrow({ items: [{ id: "a" }] })).toBeNull();
      });

      test("returns value for found id", () => {
        const acc = accessor("items['x']");
        expect(acc.getOrThrow({ items: [{ id: "x", v: 1 }] })).toStrictEqual({
          id: "x",
          v: 1,
        });
      });
    });

    describe("project", () => {
      test("MISSING_PARENT and TYPE_MISMATCH", () => {
        const acc = accessor("a[*]");
        expectAccessorError(
          () => acc.getOrThrow({ a: null }),
          "MISSING_PARENT",
          "get",
        );
        expectAccessorError(
          () => acc.getOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected array, got string",
        );
      });

      test("returns projected values on valid array", () => {
        const acc = accessor("a[*].b");
        expect(acc.getOrThrow({ a: [{ b: 1 }, { b: 2 }] })).toStrictEqual([
          1, 2,
        ]);
      });
    });

    describe("objectProject", () => {
      test("MISSING_PARENT and TYPE_MISMATCH", () => {
        const acc = accessor("@.*");
        expectAccessorError(
          () => acc.getOrThrow(null),
          "MISSING_PARENT",
          "get",
        );
        expectAccessorError(
          () => acc.getOrThrow([1, 2]),
          "TYPE_MISMATCH",
          "get",
          "expected object, got array",
        );
      });

      test("returns projected values on valid object", () => {
        const acc = accessor("@.*.name");
        expect(
          acc.getOrThrow({ x: { name: "a" }, y: { name: "b" } }),
        ).toStrictEqual(["a", "b"]);
      });
    });

    describe("filter", () => {
      test("MISSING_PARENT and TYPE_MISMATCH", () => {
        const acc = accessor("items[?active]");
        expectAccessorError(
          () => acc.getOrThrow({ items: null }),
          "MISSING_PARENT",
          "get",
        );
        expectAccessorError(
          () => acc.getOrThrow({ items: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected array, got string",
        );
      });

      test("returns filtered values on valid array", () => {
        const acc = accessor("items[?active]");
        expect(
          acc.getOrThrow({
            items: [
              { id: 1, active: true },
              { id: 2, active: false },
            ],
          }),
        ).toStrictEqual([{ id: 1, active: true }]);
      });
    });

    describe("slice", () => {
      test("MISSING_PARENT when parent is null/undefined", () => {
        const acc = accessor("a[1:3]");
        expectAccessorError(
          () => acc.getOrThrow({ a: null }),
          "MISSING_PARENT",
          "get",
        );
      });

      test("TYPE_MISMATCH when parent is wrong type", () => {
        const acc = accessor("a[1:3]");
        expectAccessorError(
          () => acc.getOrThrow({ a: 42 }),
          "TYPE_MISMATCH",
          "get",
          "expected array or string, got number",
        );
      });

      test("returns sliced array on valid array", () => {
        const acc = accessor("a[1:3]");
        expect(acc.getOrThrow({ a: [1, 2, 3, 4] })).toStrictEqual([2, 3]);
      });

      test("returns sliced string on valid string", () => {
        const acc = accessor("a[1:3]");
        expect(acc.getOrThrow({ a: "foobar" })).toBe("oo");
      });
    });

    describe("flatten", () => {
      test("MISSING_PARENT and TYPE_MISMATCH", () => {
        const acc = accessor("a[]");
        expectAccessorError(
          () => acc.getOrThrow({ a: null }),
          "MISSING_PARENT",
          "get",
        );
        expectAccessorError(
          () => acc.getOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected array, got string",
        );
      });

      test("returns flattened array on valid array", () => {
        const acc = accessor("a[]");
        expect(acc.getOrThrow({ a: [[1, 2], [3]] })).toStrictEqual([1, 2, 3]);
      });
    });

    describe("pipe", () => {
      test("propagates errors from lhs", () => {
        const acc = accessor("a.b | c");
        expectAccessorError(
          () => acc.getOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected object, got string",
        );
      });

      test("propagates errors from rhs", () => {
        const acc = accessor("a | b.c");
        expectAccessorError(
          () => acc.getOrThrow({ a: { b: "oops" } }),
          "TYPE_MISMATCH",
          "get",
          "expected object, got string",
        );
      });

      test("returns value on valid chain", () => {
        const acc = accessor("a | b");
        expect(acc.getOrThrow({ a: { b: "value" } })).toBe("value");
      });
    });
  });

  describe("setOrThrow / deleteOrThrow", () => {
    describe("read-only selectors", () => {
      test.each([
        { expr: "!foo", construct: "not expression" },
        { expr: "foo == `1`", construct: "comparison" },
        { expr: "foo + `1`", construct: "arithmetic expression" },
        { expr: "-foo", construct: "unary arithmetic expression" },
        { expr: "foo && bar", construct: "and expression" },
        { expr: "foo || bar", construct: "or expression" },
        { expr: "foo ? bar : baz", construct: "ternary expression" },
        { expr: "length(@)", construct: "function call" },
        { expr: "&foo", construct: "expression reference" },
        { expr: "$foo", construct: "variable reference" },
        { expr: "let $x = foo in $x", construct: "let expression" },
        { expr: "[foo, bar]", construct: "multi-select list" },
        { expr: "{x: foo, y: bar}", construct: "multi-select hash" },
        { expr: "`1`", construct: "literal" },
        { expr: "@", construct: "current node reference" },
        { expr: "$", construct: "root reference" },
      ])("$expr setOrThrow/deleteOrThrow produce NOT_WRITABLE", (readOnly) => {
        const acc = accessor(readOnly.expr);
        const context = { foo: 1, bar: 2, baz: 3 };

        expectAccessorError(
          () => acc.setOrThrow("changed", context),
          "NOT_WRITABLE",
          "set",
          `${readOnly.construct} is read-only`,
        );
        expectAccessorError(
          () => acc.deleteOrThrow(context),
          "NOT_WRITABLE",
          "delete",
          `${readOnly.construct} is read-only`,
        );

        const untouched = { foo: 1, bar: 2, baz: 3 };
        acc.set("changed", untouched);
        acc.delete(untouched);
        expect(untouched).toStrictEqual({ foo: 1, bar: 2, baz: 3 });
      });
    });

    describe("deep chain error propagation", () => {
      const deepChainExpressions = [
        "a.b.c",
        "a.b[0]",
        "a.b['x']",
        "a.b[*]",
        "a.b.*",
        "a.b[?active]",
        "a.b[1:3]",
        "a.b[]",
      ];

      test.each(deepChainExpressions)(
        "setOrThrow(%s) reports ancestor TYPE_MISMATCH from getOrThrow",
        (expr) => {
          const acc = accessor(expr);
          const error = expectAccessorError(
            () => acc.setOrThrow("x", { a: "oops" }),
            "TYPE_MISMATCH",
            "get",
            "expected object, got string",
          );
          expect(error.path).toBe("a.b");
        },
      );

      test.each(deepChainExpressions)(
        "deleteOrThrow(%s) reports ancestor TYPE_MISMATCH from getOrThrow",
        (expr) => {
          const acc = accessor(expr);
          const error = expectAccessorError(
            () => acc.deleteOrThrow({ a: "oops" }),
            "TYPE_MISMATCH",
            "get",
            "expected object, got string",
          );
          expect(error.path).toBe("a.b");
        },
      );

      test("pipe setOrThrow propagates strict lhs traversal errors", () => {
        const acc = accessor("a.b | c");
        const error = expectAccessorError(
          () => acc.setOrThrow("x", { a: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected object, got string",
        );
        expect(error.path).toBe("a.b");
      });

      test("pipe deleteOrThrow propagates strict lhs traversal errors", () => {
        const acc = accessor("a.b | c");
        const error = expectAccessorError(
          () => acc.deleteOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "get",
          "expected object, got string",
        );
        expect(error.path).toBe("a.b");
      });
    });

    describe("identifier", () => {
      test("TYPE_MISMATCH on non-object, success on object", () => {
        const acc = accessor("foo");
        expectAccessorError(
          () => acc.setOrThrow("value", "nope"),
          "TYPE_MISMATCH",
          "set",
          "expected object, got string",
        );
        expectAccessorError(
          () => acc.deleteOrThrow("nope"),
          "TYPE_MISMATCH",
          "delete",
          "expected object, got string",
        );

        const obj: { foo?: unknown } = { foo: "old" };
        acc.setOrThrow("new", obj);
        expect(obj.foo).toBe("new");
        acc.deleteOrThrow(obj);
        expect(obj).toStrictEqual({});
      });
    });

    describe("fieldAccess", () => {
      test("MISSING_PARENT, TYPE_MISMATCH, and success paths", () => {
        const acc = accessor("a.b");
        expectAccessorError(
          () => acc.setOrThrow("x", { a: null }),
          "MISSING_PARENT",
          "set",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: null }),
          "MISSING_PARENT",
          "delete",
        );
        expectAccessorError(
          () => acc.setOrThrow("x", { a: "oops" }),
          "TYPE_MISMATCH",
          "set",
          "expected object, got string",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "delete",
          "expected object, got string",
        );

        const obj = { a: { b: "old", c: 1 } };
        acc.setOrThrow("new", obj);
        expect(obj).toStrictEqual({ a: { b: "new", c: 1 } });
        acc.deleteOrThrow(obj);
        expect(obj).toStrictEqual({ a: { c: 1 } });
      });
    });

    describe("indexAccess", () => {
      test("MISSING_PARENT and TYPE_MISMATCH", () => {
        const acc = accessor("a[1]");
        expectAccessorError(
          () => acc.setOrThrow(9, { a: null }),
          "MISSING_PARENT",
          "set",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: null }),
          "MISSING_PARENT",
          "delete",
        );
        expectAccessorError(
          () => acc.setOrThrow(9, { a: "oops" }),
          "TYPE_MISMATCH",
          "set",
          "expected array, got string",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "delete",
          "expected array, got string",
        );
      });

      test("INDEX_OUT_OF_BOUNDS for positive and negative indexes", () => {
        const positive = accessor("a[10]");
        expectAccessorError(
          () => positive.setOrThrow(9, { a: [1, 2, 3] }),
          "INDEX_OUT_OF_BOUNDS",
          "set",
        );
        expectAccessorError(
          () => positive.deleteOrThrow({ a: [1, 2, 3] }),
          "INDEX_OUT_OF_BOUNDS",
          "delete",
        );

        const negative = accessor("a[-5]");
        expectAccessorError(
          () => negative.setOrThrow(9, { a: [1, 2, 3] }),
          "INDEX_OUT_OF_BOUNDS",
          "set",
        );
        expectAccessorError(
          () => negative.deleteOrThrow({ a: [1, 2, 3] }),
          "INDEX_OUT_OF_BOUNDS",
          "delete",
        );
      });

      test("success path", () => {
        const acc = accessor("a[-1]");
        const obj = { a: [1, 2, 3] };
        acc.setOrThrow(9, obj);
        expect(obj.a).toStrictEqual([1, 2, 9]);
        acc.deleteOrThrow(obj);
        expect(obj.a).toStrictEqual([1, 2]);
      });
    });

    describe("idAccess", () => {
      test("MISSING_PARENT and TYPE_MISMATCH", () => {
        const acc = accessor("items['x']");
        expectAccessorError(
          () => acc.setOrThrow({ id: "x" }, { items: null }),
          "MISSING_PARENT",
          "set",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ items: null }),
          "MISSING_PARENT",
          "delete",
        );
        expectAccessorError(
          () => acc.setOrThrow({ id: "x" }, { items: "oops" }),
          "TYPE_MISMATCH",
          "set",
          "expected array, got string",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ items: "oops" }),
          "TYPE_MISMATCH",
          "delete",
          "expected array, got string",
        );
      });

      test("MISSING_ID and success path", () => {
        const missing = accessor("items['x']");
        const missingContext = { items: [{ id: "a", v: 1 }] };
        expectAccessorError(
          () => missing.setOrThrow({ id: "x", v: 9 }, missingContext),
          "MISSING_ID",
          "set",
        );
        expectAccessorError(
          () => missing.deleteOrThrow(missingContext),
          "MISSING_ID",
          "delete",
        );

        const found = accessor("items['x']");
        const obj = {
          items: [
            { id: "a", v: 1 },
            { id: "x", v: 2 },
          ],
        };
        found.setOrThrow({ id: "x", v: 9 }, obj);
        expect(obj.items).toStrictEqual([
          { id: "a", v: 1 },
          { id: "x", v: 9 },
        ]);
        found.deleteOrThrow(obj);
        expect(obj.items).toStrictEqual([{ id: "a", v: 1 }]);
      });
    });

    describe("project", () => {
      test("MISSING_PARENT and TYPE_MISMATCH", () => {
        const acc = accessor("a[*]");
        expectAccessorError(
          () => acc.setOrThrow([1], { a: null }),
          "MISSING_PARENT",
          "set",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: null }),
          "MISSING_PARENT",
          "delete",
        );
        expectAccessorError(
          () => acc.setOrThrow([1], { a: "oops" }),
          "TYPE_MISMATCH",
          "set",
          "expected array, got string",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "delete",
          "expected array, got string",
        );
      });

      test("success path with and without sub-projection", () => {
        const plain = accessor("a[*]");
        const plainObj = { a: [1, 2, 3] };
        plain.setOrThrow([9], plainObj);
        expect(plainObj.a).toStrictEqual([9]);
        plain.deleteOrThrow(plainObj);
        expect(plainObj.a).toStrictEqual([]);

        const projected = accessor("a[*].b");
        const projectedObj = { a: [{ b: 1 }, { b: 2 }] };
        projected.setOrThrow(9, projectedObj);
        expect(projectedObj.a).toStrictEqual([{ b: 9 }, { b: 9 }]);
        projected.deleteOrThrow(projectedObj);
        expect(projectedObj.a).toStrictEqual([{}, {}]);
      });
    });

    describe("objectProject", () => {
      test("MISSING_PARENT and TYPE_MISMATCH", () => {
        const acc = accessor("@.*");
        expectAccessorError(
          () => acc.setOrThrow(1, null),
          "MISSING_PARENT",
          "set",
        );
        expectAccessorError(
          () => acc.deleteOrThrow(null),
          "MISSING_PARENT",
          "delete",
        );
        expectAccessorError(
          () => acc.setOrThrow(1, [1, 2]),
          "TYPE_MISMATCH",
          "set",
          "expected object, got array",
        );
        expectAccessorError(
          () => acc.deleteOrThrow([1, 2]),
          "TYPE_MISMATCH",
          "delete",
          "expected object, got array",
        );
      });

      test("success path with and without sub-projection", () => {
        const plain = accessor("@.*");
        const plainObj = { a: 1, b: 2 };
        plain.setOrThrow(9, plainObj);
        expect(plainObj).toStrictEqual({ a: 9, b: 9 });
        plain.deleteOrThrow(plainObj);
        expect(plainObj).toStrictEqual({});

        const projected = accessor("@.*.name");
        const projectedObj = {
          x: { name: "alice" },
          y: { name: "bob" },
        };
        projected.setOrThrow("updated", projectedObj);
        expect(projectedObj).toStrictEqual({
          x: { name: "updated" },
          y: { name: "updated" },
        });
        projected.deleteOrThrow(projectedObj);
        expect(projectedObj).toStrictEqual({
          x: {},
          y: {},
        });
      });
    });

    describe("filter", () => {
      test("MISSING_PARENT, TYPE_MISMATCH, and success paths", () => {
        const acc = accessor("items[?active]");
        expectAccessorError(
          () => acc.setOrThrow([{ active: true }], { items: null }),
          "MISSING_PARENT",
          "set",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ items: null }),
          "MISSING_PARENT",
          "delete",
        );
        expectAccessorError(
          () => acc.setOrThrow([{ active: true }], { items: "oops" }),
          "TYPE_MISMATCH",
          "set",
          "expected array, got string",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ items: "oops" }),
          "TYPE_MISMATCH",
          "delete",
          "expected array, got string",
        );

        const obj = {
          items: [
            { id: 1, active: true },
            { id: 2, active: false },
          ],
        };
        acc.setOrThrow([{ id: 3, active: true }], obj);
        expect(obj.items).toStrictEqual([
          { id: 2, active: false },
          { id: 3, active: true },
        ]);
        acc.deleteOrThrow(obj);
        expect(obj.items).toStrictEqual([{ id: 2, active: false }]);
      });
    });

    describe("slice", () => {
      test("MISSING_PARENT, TYPE_MISMATCH, and success paths", () => {
        const acc = accessor("a[1:3]");
        expectAccessorError(
          () => acc.setOrThrow([9], { a: null }),
          "MISSING_PARENT",
          "set",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: null }),
          "MISSING_PARENT",
          "delete",
        );
        expectAccessorError(
          () => acc.setOrThrow([9], { a: "abc" }),
          "TYPE_MISMATCH",
          "set",
          "expected array, got string",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: "abc" }),
          "TYPE_MISMATCH",
          "delete",
          "expected array, got string",
        );

        const obj = { a: [1, 2, 3, 4] };
        acc.setOrThrow([9], obj);
        expect(obj.a).toStrictEqual([1, 4, 9]);
        acc.deleteOrThrow(obj);
        expect(obj.a).toStrictEqual([1]);
      });
    });

    describe("flatten", () => {
      test("MISSING_PARENT, TYPE_MISMATCH, and success paths", () => {
        const acc = accessor("a[]");
        expectAccessorError(
          () => acc.setOrThrow([9], { a: null }),
          "MISSING_PARENT",
          "set",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: null }),
          "MISSING_PARENT",
          "delete",
        );
        expectAccessorError(
          () => acc.setOrThrow([9], { a: "oops" }),
          "TYPE_MISMATCH",
          "set",
          "expected array, got string",
        );
        expectAccessorError(
          () => acc.deleteOrThrow({ a: "oops" }),
          "TYPE_MISMATCH",
          "delete",
          "expected array, got string",
        );

        const obj = { a: [[1], [2]] };
        acc.setOrThrow([9], obj);
        expect(obj.a).toStrictEqual([9]);
        acc.deleteOrThrow(obj);
        expect(obj.a).toStrictEqual([]);
      });
    });

    describe("pipe", () => {
      test("delegates RHS errors and success path", () => {
        const acc = accessor("a | b");
        const setError = expectAccessorError(
          () => acc.setOrThrow("x", { a: null }),
          "TYPE_MISMATCH",
          "set",
        );
        expect(setError.path).toBe("b");

        const deleteError = expectAccessorError(
          () => acc.deleteOrThrow({ a: null }),
          "TYPE_MISMATCH",
          "delete",
        );
        expect(deleteError.path).toBe("b");

        const obj = { a: { b: "old", c: 1 } };
        acc.setOrThrow("new", obj);
        expect(obj.a).toStrictEqual({ b: "new", c: 1 });
        acc.deleteOrThrow(obj);
        expect(obj.a).toStrictEqual({ c: 1 });
      });
    });
  });

  // ============================================================
  // Complex integration tests (adapted from original)
  // ============================================================
  describe("complex expressions", () => {
    test("reservations with filter and projection", () => {
      const obj = {
        reservations: [
          {
            instances: [
              { foo: 1, bar: 2 },
              { foo: 1, bar: 3 },
              { foo: 1, bar: 2 },
              { foo: 2, bar: 1 },
            ],
          },
        ],
      };

      const selector = parseJsonSelector(
        "reservations[*].instances[?bar==`1`]",
      );
      const acc = makeJsonSelectorAccessor(selector);
      expect(acc.get(obj)).toStrictEqual([[{ foo: 2, bar: 1 }]]);

      acc.set({ foo: 3, bar: 1 }, obj);
      expect(obj).toStrictEqual({
        reservations: [
          {
            instances: [
              { foo: 1, bar: 2 },
              { foo: 1, bar: 3 },
              { foo: 1, bar: 2 },
              { foo: 3, bar: 1 },
            ],
          },
        ],
      });

      acc.set(
        [
          { foo: 4, bar: 1 },
          { foo: 5, bar: 1 },
        ],
        obj,
      );
      expect(obj).toStrictEqual({
        reservations: [
          {
            instances: [
              { foo: 1, bar: 2 },
              { foo: 1, bar: 3 },
              { foo: 1, bar: 2 },
              { foo: 4, bar: 1 },
              { foo: 5, bar: 1 },
            ],
          },
        ],
      });

      acc.set(null, obj);
      expect(obj).toStrictEqual({
        reservations: [
          {
            instances: [
              { foo: 1, bar: 2 },
              { foo: 1, bar: 3 },
              { foo: 1, bar: 2 },
            ],
          },
        ],
      });

      acc.delete(obj);
      expect(obj).toStrictEqual({
        reservations: [
          {
            instances: [
              { foo: 1, bar: 2 },
              { foo: 1, bar: 3 },
              { foo: 1, bar: 2 },
            ],
          },
        ],
      });
    });

    test("root access in filter", () => {
      const obj = {
        excludeBar: 2,
        reservations: [
          {
            instances: [
              { foo: 1, bar: 2 },
              { foo: 1, bar: 3 },
              { foo: 1, bar: 2 },
              { foo: 2, bar: 1 },
            ],
          },
        ],
      };

      const selector = parseJsonSelector(
        "reservations[*].instances[?bar!=$.excludeBar]",
      );
      const acc = makeJsonSelectorAccessor(selector);
      expect(acc.get(obj)).toStrictEqual([
        [
          { foo: 1, bar: 3 },
          { foo: 2, bar: 1 },
        ],
      ]);

      acc.set({ foo: 3, bar: 1 }, obj);
      expect(obj).toStrictEqual({
        excludeBar: 2,
        reservations: [
          {
            instances: [
              { foo: 1, bar: 2 },
              { foo: 1, bar: 2 },
              { foo: 3, bar: 1 },
            ],
          },
        ],
      });

      acc.delete(obj);
      expect(obj).toStrictEqual({
        excludeBar: 2,
        reservations: [
          {
            instances: [
              { foo: 1, bar: 2 },
              { foo: 1, bar: 2 },
            ],
          },
        ],
      });
    });

    test("ID access with nested path", () => {
      const obj = {
        instances: [
          { id: "1", v: "a" },
          { id: "2", v: "b" },
          { id: "3", v: "c" },
        ],
      };

      const selector = parseJsonSelector("instances['2']");
      const acc = makeJsonSelectorAccessor(selector);
      expect(acc.get(obj)).toStrictEqual({ id: "2", v: "b" });

      acc.set({ id: "2", v: "d" }, obj);
      expect(obj.instances[1].v).toBe("d");

      acc.delete(obj);
      expect(obj).toStrictEqual({
        instances: [
          { id: "1", v: "a" },
          { id: "3", v: "c" },
        ],
      });

      expect(acc.get(obj)).toBeNull();

      const selector2 = parseJsonSelector("instances['1'].v['x']");
      const acc2 = makeJsonSelectorAccessor(selector2);
      expect(acc2.get(obj)).toBeNull();
    });
  });
});

describe("AccessorOptions", () => {
  test("custom function provider is used by accessor", () => {
    const registry = new FunctionRegistry();
    registry.register({
      name: "double",
      signatures: [[arg("value", NUMBER_TYPE)]],
      handler: ({ args }) => Number(args[0]) * 2,
    });

    const selector = parseJsonSelector("double(@)");
    const acc = makeJsonSelectorAccessor(selector, {
      functionProvider: registry,
    });
    expect(acc.get(5)).toBe(10);
  });

  test("accessor defaults to builtins when no options provided", () => {
    const selector = parseJsonSelector("length(@)");
    const acc = makeJsonSelectorAccessor(selector);
    expect(acc.get([1, 2, 3])).toBe(3);
  });
});
