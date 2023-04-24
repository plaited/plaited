/// <reference lib="dom" />
type CreateIDBCallback = (arg: IDBObjectStore) => void;
export type IDB = (type: IDBTransactionMode, callback: CreateIDBCallback) => Promise<void>;
export declare const createIDB: (dbName: string, storeName: string) => (type: IDBTransactionMode, callback: CreateIDBCallback) => Promise<void>;
export {};
