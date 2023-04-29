import { deepEqual } from "../index.js";

test("deepEqual()", () => {
  /** Primitive values */
  expect(deepEqual("string", "string")).toBeTruthy();
  expect(deepEqual("string", "different string")).toBeFalsy();
  expect(deepEqual(1, 1)).toBeTruthy();
  expect(deepEqual(1, 0o1)).toBeTruthy();
  expect(deepEqual(1, 0)).toBeFalsy();
  expect(deepEqual(/test/i, /test/i)).toBeTruthy();
  expect(deepEqual(/test/i, /test/)).toBeFalsy();
  expect(deepEqual(RegExp("foo*"), RegExp("foo*"))).toBeTruthy();
  expect(deepEqual(RegExp("foo*"), RegExp("foo*", "g"))).toBeFalsy();

  /** handles falsey */
  expect(deepEqual(false, false)).toBeTruthy();
  expect(deepEqual(null, null)).toBeTruthy();
  expect(deepEqual(undefined, undefined)).toBeTruthy();
  expect(deepEqual(null, false)).toBeFalsy();
  expect(deepEqual(null, undefined)).toBeFalsy();
  expect(deepEqual(false, undefined)).toBeFalsy();

  /** Arrays */
  expect(deepEqual(["array"], ["array"])).toBeTruthy();
  expect(deepEqual(["array"], ["nope"])).toBeFalsy();

  /** Maps, sets and objects */
  expect(deepEqual(new Set(["set"]), new Set(["set"]))).toBeTruthy();
  expect(deepEqual(new Set(["set"]), new Set(["nope"]))).toBeFalsy();
  expect(deepEqual(new Map([["key", "value"]]), new Map([["key", "value"]])))
    .toBeTruthy();
  expect(
    deepEqual(new Map([["key", "value"]]), new Map([["key", "nope"]])),
  ).toBeFalsy();

  const func = () => {
    console.error("function");
  };
  const symbolKey = Symbol("symbolKey");

  const original = {
    num: 0,
    str: "",
    boolean: true,
    unf: void 0,
    nul: null,
    obj: { name: "object", id: 1 },
    arr: [0, 1, 2],
    func,
    date: new Date(0),
    reg: new RegExp("/regexp/ig"),
    [symbolKey]: "symbol",
  };

  const clone = {
    num: 0,
    str: "",
    boolean: true,
    unf: void 0,
    nul: null,
    obj: { name: "object", id: 1 },
    arr: [0, 1, 2],
    func,
    date: new Date(0),
    reg: new RegExp("/regexp/ig"),
    [symbolKey]: "symbol",
  };
  expect(deepEqual(original, clone)).toBeTruthy();
  expect(deepEqual(original, {
    ...clone,
    obj: {
      name: "color",
    },
  })).toBeFalsy();
});
