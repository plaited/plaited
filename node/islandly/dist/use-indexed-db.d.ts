import { Disconnect } from './types.js';
type UpdateStoreArg<T = unknown> = (arg: T) => T;
interface Get<T> {
    (): Promise<T>;
    subscribe: (cb: (arg: T) => void) => Disconnect;
}
type Set<T> = (newValue: T | UpdateStoreArg<T>) => Promise<T>;
/** asynchronously get and set indexed db values */
export declare const useIndexedDB: <T = unknown>(key: string, initialValue?: T | undefined, option?: {
    databaseName: string;
    storeName: string;
}) => Promise<readonly [Get<T>, Set<T>]>;
export {};
