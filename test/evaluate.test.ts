import { evaluateJsonSelector, project } from "../src/evaluate";
import { parseJsonSelector } from "../src/parse";

describe("evaluateJsonSelector", () => {
  test("projection with nested filter", () => {
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
    expect(evaluateJsonSelector(selector, obj)).toStrictEqual([
      [{ foo: 2, bar: 1 }],
    ]);

    const selector2 = parseJsonSelector("reservations[*]");
    expect(evaluateJsonSelector(selector2, obj)).toStrictEqual(
      obj.reservations,
    );
  });

  test("idAccess", () => {
    const data = {
      items: [
        { id: "first", value: 1 },
        { id: "second", value: 2 },
        { id: "third", value: 3 },
      ],
    };
    const selector = parseJsonSelector("items['second']");
    expect(evaluateJsonSelector(selector, data)).toStrictEqual({
      id: "second",
      value: 2,
    });
  });

  test("project without projection", () => {
    const data = { arr: [1, 2, 3] };
    const selector = parseJsonSelector("arr[*]");
    expect(evaluateJsonSelector(selector, data)).toStrictEqual([1, 2, 3]);
  });
});

describe("project", () => {
  test("returns array as-is when projection is undefined", () => {
    expect(project([1, 2, 3], undefined, {})).toStrictEqual([1, 2, 3]);
  });
});
