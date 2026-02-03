import {
  makeJsonSelectorAccessor,
  accessWithJsonSelector,
  bindJsonSelectorAccessor,
  invertedSlice,
} from "../src/access";
import { parseJsonSelector } from "../src/parse";

describe("makeJsonSelectorAccessor", () => {
  // Helper to create accessor from expression string
  const accessor = (expr: string) =>
    makeJsonSelectorAccessor(parseJsonSelector(expr));

  // ============================================================
  // Utility functions
  // ============================================================
  describe("accessWithJsonSelector / bindJsonSelectorAccessor", () => {
    test("returns accessor with valid, path, get, set, delete", () => {
      const obj = { foo: "bar" };
      const acc = accessWithJsonSelector(parseJsonSelector("foo"), obj);

      expect(acc.valid).toBe(true);
      expect(acc.path).toBe("foo");
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

      expect(bound.selector).toEqual({ type: "identifier", id: "x" });
      expect(bound.valid).toBe(true);
      expect(bound.path).toBe("x");
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
  });

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
      // Note: arrays are objects in JS, so isObject returns true for them
      expect(acc.isValidContext([])).toBe(true);
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

      test("set applies to each element (no-op for current)", () => {
        const acc = accessor("a[*]");
        const obj = { a: [1, 2, 3] };
        // When projection is @, set on @ is a no-op
        acc.set(99, obj);
        expect(obj.a).toStrictEqual([1, 2, 3]);
      });

      test("delete on each element (no-op for current)", () => {
        const acc = accessor("a[*]");
        const obj = { a: [1, 2, 3] };
        // When projection is @, delete on @ is a no-op
        acc.delete(obj);
        expect(obj.a).toStrictEqual([1, 2, 3]);
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

    test("get on non-array returns null", () => {
      const acc = accessor("a[1:3]");
      expect(acc.get({ a: "string" })).toBeNull();
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

    test("isValidContext for arrays", () => {
      const acc = accessor("a[1:3]");
      expect(acc.isValidContext({ a: [] })).toBe(true);
      expect(acc.isValidContext({ a: [1, 2, 3] })).toBe(true);
      expect(acc.isValidContext({ a: "string" })).toBe(false);
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

describe("invertedSlice", () => {
  test("positive step: returns elements outside [start, end)", () => {
    // [0,1,2,3,4], slice [1:3] = [1,2], inverted = [0,3,4]
    expect(invertedSlice([0, 1, 2, 3, 4], 1, 3)).toStrictEqual([0, 3, 4]);
  });

  test("positive step: start >= end returns original", () => {
    expect(invertedSlice([0, 1, 2, 3, 4], 3, 1)).toStrictEqual([0, 1, 2, 3, 4]);
    expect(invertedSlice([0, 1, 2, 3, 4], 2, 2)).toStrictEqual([0, 1, 2, 3, 4]);
  });

  test("positive step with step > 1", () => {
    // [0,1,2,3,4,5], slice [::2] = [0,2,4], inverted = [1,3,5]
    expect(invertedSlice([0, 1, 2, 3, 4, 5], 0, 6, 2)).toStrictEqual([1, 3, 5]);
  });

  test("negative step: returns elements outside (end, start]", () => {
    // [0,1,2,3,4], slice [3:0:-1] = [3,2,1], inverted = [4,0] (reversed order)
    expect(invertedSlice([0, 1, 2, 3, 4], 3, 0, -1)).toStrictEqual([4, 0]);
  });

  test("negative step: start <= end returns original", () => {
    expect(invertedSlice([0, 1, 2, 3, 4], 1, 3, -1)).toStrictEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(invertedSlice([0, 1, 2, 3, 4], 2, 2, -1)).toStrictEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  test("negative step with |step| > 1", () => {
    // [0,1,2,3,4,5], slice [::-2] starting at 5, gets [5,3,1]
    // inverted = [0,2,4] but collected in reverse order
    const result = invertedSlice([0, 1, 2, 3, 4, 5], undefined, undefined, -2);
    expect(result).toStrictEqual([4, 2, 0]);
  });

  test("empty array", () => {
    expect(invertedSlice([], 0, 5)).toStrictEqual([]);
  });

  test("slice entire array leaves nothing", () => {
    expect(invertedSlice([0, 1, 2], 0, 3)).toStrictEqual([]);
  });

  test("slice nothing leaves everything", () => {
    expect(invertedSlice([0, 1, 2], 0, 0)).toStrictEqual([0, 1, 2]);
  });
});
