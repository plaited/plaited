import { trueTypeOf } from '@plaited/utils';
import { createIDB } from './create-idb.js';
/** asynchronously get and set indexed db values */
export const useIndexedDB = async (
/** key for stored value */
key, 
/** initial value can be null */
initialValue, 
/** you can actually pass it an reference to another indexedDB */
option) => {
    const databaseName = option?.databaseName ?? 'USE_INDEXED_DB';
    const storeName = option?.storeName ?? 'STORE';
    const db = createIDB(databaseName, storeName);
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`);
    const overwriteStore = (newValue) => db('readwrite', store => store.put(newValue, key));
    // If initial value provided overwrite store
    initialValue !== undefined && await overwriteStore(initialValue);
    const updateStore = (newValue) => db('readwrite', store => {
        const req = store.openCursor(key);
        req.onsuccess = function getAndPutOnSuccess() {
            const cursor = this.result;
            if (cursor) {
                const { value } = cursor;
                cursor.update(newValue(value));
                return;
            }
            else {
                console.error(`cursor's value missing`);
            }
        };
    });
    const get = () => {
        let req;
        return db('readonly', store => {
            req = store.get(key);
        }).then(() => req.result);
    };
    const set = async (newValue) => {
        await trueTypeOf(newValue) === 'function'
            ? updateStore(newValue)
            : overwriteStore(newValue);
        const next = await get();
        channel.postMessage(next);
        return next;
    };
    get.subscribe = (cb) => {
        const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`);
        const handler = (event) => {
            cb(event.data);
        };
        channel.addEventListener('message', handler);
        return () => channel.removeEventListener('message', handler);
    };
    return Object.freeze([get, set]);
};
