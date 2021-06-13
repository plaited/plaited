import {trueTypeOf} from '../utils'
import {createIDB} from './createIDB.js'

/** @param {string} key @param {*} initialValue @param {string} dbName @param {string} storeName */
export const useIndexedDB = async (key, initialValue, idb) => {
  const db = idb || createIDB('USE_INDEXED_DB', 'STORE')
  initialValue &&
    (await (function setInitialValue() {
      return db('readwrite', store => {
        store.put(initialValue, key)
      })
    })())

  const updateStore = newValue =>
    db('readwrite', store => {
      const req = store.openCursor(key)
      req.onsuccess = function getAndPutOnSuccess() {
        const cursor = this.result
        if (!cursor) {
          store.put(newValue(), key)
          return
        }
        const {value} = cursor
        cursor.update(newValue(value))
      }
    })

  const overwriteStore = newValue =>
    db('readwrite', store => store.put(newValue, key))

  const set = newValue =>
    trueTypeOf(newValue) === 'function'
      ? updateStore(newValue)
      : overwriteStore(newValue)

  const get = () => {
    let req
    return db('readonly', store => {
      req = store.get(key)
    }).then(() => req.result)
  }
  return Object.freeze([get, set])
}
