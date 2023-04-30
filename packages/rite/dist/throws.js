import { noop } from '@plaited/utils';
// deno-lint-ignore no-explicit-any
const isPromise = (x) => x && typeof x.then === 'function';
const catchAndReturn = (x) => x.catch(y => y);
// deno-lint-ignore no-explicit-any
const catchPromise = (x) => (isPromise(x) ? catchAndReturn(x) : x);
export const throws = (
//@ts-ignore: noop
fn = noop, ...args) => {
    try {
        return catchPromise(fn(...args));
    }
    catch (err) {
        return err.toString();
    }
};
