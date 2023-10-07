import { makeJsonSelectorAccessor } from "../src";
import { parseJsonSelector } from "../src/parse";

describe("makeJsonSelectorAccessor", () => {
  test("reservations", () => {
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

    const selector = parseJsonSelector("reservations[*].instances[?bar==`1`]");
    const accessor = makeJsonSelectorAccessor(selector);
    expect(accessor.get(obj)).toStrictEqual([[{ foo: 2, bar: 1 }]]);

    accessor.set({ foo: 3, bar: 1 }, obj);
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

    accessor.set(
      [
        { foo: 4, bar: 1 },
        { foo: 5, bar: 1 },
      ],
      obj
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

    accessor.set(null, obj);
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

    accessor.delete(obj);
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

  test("root access", () => {
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
      "reservations[*].instances[?bar!=$.excludeBar]"
    );
    const accessor = makeJsonSelectorAccessor(selector);
    expect(accessor.get(obj)).toStrictEqual([
      [
        { foo: 1, bar: 3 },
        { foo: 2, bar: 1 },
      ],
    ]);

    accessor.set({ foo: 3, bar: 1 }, obj);
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

    accessor.delete(obj);
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

  test("ID access", () => {
    const obj = {
      instances: [
        { id: "1", v: "a" },
        { id: "2", v: "b" },
        { id: "3", v: "c" },
      ],
    };

    const selector = parseJsonSelector("instances['2']");
    const accessor = makeJsonSelectorAccessor(selector);
    expect(accessor.get(obj)).toStrictEqual({ id: "2", v: "b" });

    accessor.set({ id: "2", v: "d" }, obj);
    expect(obj.instances[1].v).toBe("d");

    accessor.delete(obj);
    expect(obj).toStrictEqual({
      instances: [
        { id: "1", v: "a" },
        { id: "3", v: "c" },
      ],
    });

    expect(accessor.get(obj)).toBeNull();

    const selector2 = parseJsonSelector("instances['1'].v['x']");
    const accessor2 = makeJsonSelectorAccessor(selector2);
    expect(accessor2.get(obj)).toBeNull();
  });
});
