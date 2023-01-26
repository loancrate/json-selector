import { accessWithJsonSelector, parseJsonSelector } from "../src/index";

test("formatJsonSelector", () => {
  const console = { log: jest.fn() };

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

  expect(console.log.mock.calls).toEqual([[1], [1], [2], [undefined]]);
});
