import sinon from "sinon";
import { callAll } from "../index.js";

test("callAll()", () => {
  const expected = "string";
  const firstSpy = sinon.spy();
  const secondSpy = sinon.spy();
  callAll(firstSpy, secondSpy)(expected);
  expect(firstSpy.calledWith(expected)).toBeTruthy();
  expect(secondSpy.calledWith(expected)).toBeTruthy();
});
