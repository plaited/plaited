/** get the true type of an object returned back to you as a string */
export const trueTypeOf = (obj) =>
  Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
