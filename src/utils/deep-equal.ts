/**
 * Performs a deep equality comparison between two values of any type.
 * Handles primitive values, objects, arrays, and built-in JavaScript objects.
 *
 * @param objA - First value to compare
 * @param objB - Second value to compare
 * @param map - Internal WeakMap used for circular reference detection
 * @returns `true` if values are deeply equal, `false` otherwise
 *
 * @remarks
 * Supports comparison of:
 * - Primitive values (string, number, boolean, null, undefined)
 * - Objects and nested objects
 * - Arrays and nested arrays
 * - Dates
 * - RegExp objects
 * - Map objects
 * - Set objects
 * - ArrayBuffer and TypedArrays
 * - Handles circular references
 *
 * @example
 * Basic Usage
 * ```ts
 * // Primitive values
 * deepEqual(42, 42)                    // true
 * deepEqual('hello', 'hello')          // true
 *
 * // Arrays
 * deepEqual([1, 2, 3], [1, 2, 3])     // true
 * deepEqual([1, [2, 3]], [1, [2, 3]]) // true
 *
 * // Objects
 * deepEqual({a: 1, b: 2}, {a: 1, b: 2}) // true
 * ```
 *
 * @example
 * Complex Types
 * ```ts
 * // Dates
 * deepEqual(new Date('2023'), new Date('2023'))  // true
 *
 * // Sets
 * deepEqual(new Set([1, 2]), new Set([1, 2]))    // true
 *
 * // Maps
 * deepEqual(
 *   new Map([['a', 1], ['b', 2]]),
 *   new Map([['a', 1], ['b', 2]])
 * )  // true
 *
 * // RegExp
 * deepEqual(/test/gi, /test/gi)  // true
 * ```
 *
 * @example
 * Edge Cases
 * ```ts
 * // Circular references
 * const obj1 = { a: 1 }
 * const obj2 = { a: 1 }
 * obj1.self = obj1
 * obj2.self = obj2
 * deepEqual(obj1, obj2)  // true
 *
 * // TypedArrays
 * deepEqual(
 *   new Int8Array([1, 2, 3]),
 *   new Int8Array([1, 2, 3])
 * )  // true
 *
 * // Different types
 * deepEqual([1, 2, 3], "1,2,3")  // false
 * ```
 *
 * @throws {Error} Will not throw errors, but may have unexpected results if
 * comparing objects with custom prototype chains or non-standard object types
 */
export const deepEqual = (objA: unknown, objB: unknown, map = new WeakMap()) => {
  //  First-level filtering
  if (Object.is(objA, objB)) return true

  //  Special handling is required for Date and RegExp
  if (objA instanceof Date && objB instanceof Date) {
    return objA.getTime() === objB.getTime()
  }
  if (objA instanceof RegExp && objB instanceof RegExp) {
    return objA.toString() === objB.toString()
  }

  //  Make sure both are objects and return false if either is not.
  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false
  }

  // Use WeakMap as a hash table to solve the circular reference problem
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
    {
      if (objA.byteLength != objB.byteLength) return false
      const dv1 = new Int8Array(objA as ArrayBuffer)
      const dv2 = new Int8Array(objB as ArrayBuffer)
      for (let i = 0; i != objA.byteLength; i++) {
        if (dv1[i] != dv2[i]) return false
      }
      return true
    }
  }

  // It's probably an object use reflect to get all keys then loop
  const keysA = Reflect.ownKeys(objA)
  const keysB = Reflect.ownKeys(objB)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (let i = 0; i < keysA.length; i++) {
    if (
      !Reflect.has(objB, keysA[i]) ||
      !deepEqual(objA[keysA[i] as keyof typeof objA], objB[keysA[i] as keyof typeof objB], map)
    ) {
      return false
    }
  }

  return true
}
