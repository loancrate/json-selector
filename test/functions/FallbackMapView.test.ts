import { FallbackMapView } from "../../src/functions/FallbackMapView";

describe("FallbackMapView", () => {
  const primary = new Map([
    ["a", 1],
    ["b", 2],
  ]);
  const fallback = new Map([
    ["b", 20],
    ["c", 3],
  ]);

  test("size counts unique keys across primary and fallback", () => {
    const view = new FallbackMapView(primary, fallback);
    expect(view.size).toBe(3); // a, b, c (b is shared)
  });

  test("get returns primary value, falls back, or undefined", () => {
    const view = new FallbackMapView(primary, fallback);
    expect(view.get("a")).toBe(1); // primary only
    expect(view.get("b")).toBe(2); // primary wins over fallback
    expect(view.get("c")).toBe(3); // fallback only
    expect(view.get("z")).toBeUndefined(); // neither
  });

  test("has checks primary then fallback", () => {
    const view = new FallbackMapView(primary, fallback);
    expect(view.has("a")).toBe(true);
    expect(view.has("c")).toBe(true);
    expect(view.has("z")).toBe(false);
  });

  test("size without fallback", () => {
    const view = new FallbackMapView(primary);
    expect(view.size).toBe(2);
  });

  test("get without fallback", () => {
    const view = new FallbackMapView(primary);
    expect(view.get("a")).toBe(1);
    expect(view.get("z")).toBeUndefined();
  });

  test("has without fallback", () => {
    const view = new FallbackMapView(primary);
    expect(view.has("a")).toBe(true);
    expect(view.has("z")).toBe(false);
  });

  test("entries without fallback", () => {
    const view = new FallbackMapView(primary);
    expect([...view.entries()]).toStrictEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  test("entries yields primary first, then fallback-only", () => {
    const view = new FallbackMapView(primary, fallback);
    expect([...view.entries()]).toStrictEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  test("keys iterates all unique keys", () => {
    const view = new FallbackMapView(primary, fallback);
    expect([...view.keys()]).toStrictEqual(["a", "b", "c"]);
  });

  test("values iterates values (primary wins on overlap)", () => {
    const view = new FallbackMapView(primary, fallback);
    expect([...view.values()]).toStrictEqual([1, 2, 3]);
  });

  test("forEach calls back for each entry", () => {
    const view = new FallbackMapView(primary, fallback);
    const entries: [string, number][] = [];
    view.forEach((value, key) => {
      entries.push([key, value]);
    });
    expect(entries).toStrictEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  test("Symbol.iterator works with spread", () => {
    const view = new FallbackMapView(primary, fallback);
    expect([...view]).toStrictEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });
});
