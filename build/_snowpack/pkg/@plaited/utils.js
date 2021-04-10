const trueTypeOf = obj =>
  Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();

const useStore = initialStore => {
  let store = initialStore;
  const get = () => store;
  const set = newStore => {
    store = trueTypeOf(newStore) === 'function' ? newStore(store) : newStore;
  };
  return Object.freeze([get, set])
};

export { trueTypeOf, useStore };
