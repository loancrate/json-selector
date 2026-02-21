import { invertedSlice } from "../src/access-util";

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
