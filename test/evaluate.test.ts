import { evaluateJsonSelector } from "../src/evaluate";
import { parseJsonSelector } from "../src/parse";

describe("evaluateJsonSelector", () => {
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
    expect(evaluateJsonSelector(selector, obj)).toStrictEqual([
      [{ foo: 2, bar: 1 }],
    ]);

    const selector2 = parseJsonSelector("reservations[*]");
    expect(evaluateJsonSelector(selector2, obj)).toStrictEqual(
      obj.reservations
    );
  });
});
