import { publisher, trueTypeOf } from "@plaited/utils";
/**
 * @description
 * a simple utility function for safely getting and setting values you need to persist during run.
 * When using the callback feature userStore passes a structured clone of the currently stored value
 * as a parameter.
 *
 * @example
 *  const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 })
 *  setStore((prev) => {
 *    if (typeof prev !== 'number') prev.b = 2
 *    return prev
 *  })
 *  store() //=> { a: 1, b: 2 }
 *  setStore(3)
 *  store() // => 3
 */
export const useStore = (initialStore) => {
  let store = initialStore;
  let pub;
  const get = () => store;
  get.subscribe = (cb) => {
    pub = pub ?? publisher();
    return pub.subscribe(cb);
  };
  const set = (newStore) => {
    store = trueTypeOf(newStore) === "function"
      ? newStore(structuredClone(store))
      : newStore;
    pub && pub(store);
    return store;
  };
  return Object.freeze([
    get,
    set,
  ]);
};
