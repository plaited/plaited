import { Disconnect } from "./types.js";
type Get<T> = {
  (): T;
  subscribe(cb: (arg: T) => void): Disconnect;
};
type Set<T> = (newStore: T | ((arg: T) => T)) => T;
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
export declare const useStore: <T>(
  initialStore: T,
) => readonly [Get<T>, Set<T>];
export {};
