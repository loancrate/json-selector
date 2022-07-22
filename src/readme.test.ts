/* eslint-disable no-console */
import { accessWithJsonSelector, parseJsonSelector } from "./index";

test("formatJsonSelector", () => {
  const obj = {
    foo: {
      bar: [
        {
          id: "x",
          value: 1,
        },
      ],
    },
  };
  const selector = parseJsonSelector("foo.bar['x'].value");
  const accessor = accessWithJsonSelector(selector, obj);
  console.log(accessor.get()); // 1
  console.log(obj.foo.bar[0].value); // 1
  accessor.set(2);
  console.log(obj.foo.bar[0].value); // 2
  accessor.delete();
  console.log(obj.foo.bar[0].value); // undefined
});
