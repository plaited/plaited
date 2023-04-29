import { trueTypeOf } from "./true-type-of.js";
/** Call all function passed in with the same arguments when invoked */
export const callAll = (...fns) => (...args) => {
  return fns.forEach((fn) => {
    if (trueTypeOf(fn) === "function") {
      fn(...args);
    }
  });
};
