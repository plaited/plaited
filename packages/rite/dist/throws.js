/* eslint-disable @typescript-eslint/no-explicit-any */
import { noop } from '@plaited/utils';
const isPromise = (x) => x && typeof x.then === 'function';
const catchAndReturn = (x) => x.catch(y => y);
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
