/**
 * Deep equality comparison for any JavaScript values.
 * Handles circular references and all built-in types.
 *
 * @param objA - First value to compare
 * @param objB - Second value to compare
 * @param map - Internal WeakMap for circular reference detection
 * @returns true if values are deeply equal
 *
 * @remarks
 * Supports: primitives, objects, arrays, Date, RegExp, Map, Set, TypedArrays.
 * Uses Object.is() for NaN and +0/-0 handling.
 */
export const deepEqual = (objA: unknown, objB: unknown, map = new WeakMap()) => {
  if (Object.is(objA, objB)) return true

  if (objA instanceof Date && objB instanceof Date) {
    return objA.getTime() === objB.getTime()
  }
  if (objA instanceof RegExp && objB instanceof RegExp) {
    return objA.toString() === objB.toString()
  }

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false
  }

  if (map.get(objA) === objB) return true
  map.set(objA, objB)

  if (Array.isArray(objA) && Array.isArray(objB)) {
    if (objA.length !== objB.length) return false
    for (let i = objA.length; i-- !== 0; ) {
      if (!deepEqual(objA[i], objB[i])) return false
    }
    return true
  }

  if (objA instanceof Map && objB instanceof Map) {
    if (objA.size !== objB.size) return false
    for (const i of objA.entries()) {
      if (!objB.has(i[0])) return false
    }
    for (const i of objA.entries()) {
      if (!deepEqual(i[1], objB.get(i[0]))) return false
    }
    return true
  }

  if (objA instanceof Set && objB instanceof Set) {
    if (objA.size !== objB.size) return false
    const arrA = [...objA.values()]
    const arrB = [...objB.values()]
    for (let i = arrA.length; i-- !== 0; ) {
      if (!deepEqual(arrA[i], arrB[i])) return false
    }
    return true
  }

  if (
    (objA instanceof ArrayBuffer && objB instanceof ArrayBuffer) ||
    (ArrayBuffer.isView(objA) && ArrayBuffer.isView(objB))
  ) {
    if (objA.byteLength !== objB.byteLength) return false
    const dv1 = new Int8Array(objA as ArrayBuffer)
    const dv2 = new Int8Array(objB as ArrayBuffer)
    for (let i = 0; i !== objA.byteLength; i++) {
      if (dv1[i] !== dv2[i]) return false
    }
    return true
  }

  const keysA = Reflect.ownKeys(objA)
  const keysB = Reflect.ownKeys(objB)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (let i = 0; i < keysA.length; i++) {
    if (
      !Reflect.has(objB, keysA[i]!) ||
      !deepEqual(objA[keysA[i] as keyof typeof objA], objB[keysA[i] as keyof typeof objB], map)
    ) {
      return false
    }
  }

  return true
}
