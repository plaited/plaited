/**
 * @internal
 * @module deep-equal
 *
 * Purpose: Comprehensive deep equality comparison for complex data structures
 * Architecture: Recursive comparison with circular reference detection via WeakMap
 * Dependencies: None - uses native JavaScript APIs only
 * Consumers: State management, memoization, test assertions, change detection
 *
 * Maintainer Notes:
 * - This is a critical utility for detecting changes in complex state
 * - WeakMap prevents infinite recursion with circular references
 * - Object.is() handles edge cases like NaN === NaN, +0 !== -0
 * - Special handling for built-in types ensures semantic equality
 * - Reflect API used for symbol property support
 * - Order matters for performance - common cases checked first
 *
 * Common modification scenarios:
 * - Adding custom type support: Add instanceof check before generic object
 * - Performance optimization: Add early exits for common patterns
 * - Shallow comparison mode: Add depth parameter to limit recursion
 * - Custom comparator support: Add optional comparison function parameter
 *
 * Performance considerations:
 * - Recursive algorithm - stack depth limited by structure depth
 * - WeakMap allocation per comparison (cleaned up by GC)
 * - Array/Set conversion creates temporary arrays
 * - Reflect.ownKeys includes symbols - more thorough but slower
 *
 * Known limitations:
 * - Function comparison uses reference equality only
 * - No support for custom equality methods (valueOf, equals)
 * - Set comparison depends on iteration order
 * - Prototype chain differences not detected
 */

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
  /**
   * @internal
   * First-level filtering using Object.is for primitive equality.
   * Handles NaN === NaN (true) and +0 !== -0 (false) correctly.
   */
  if (Object.is(objA, objB)) return true

  /**
   * @internal
   * Special handling for Date and RegExp before generic object check.
   * These types have internal state that requires specific comparison.
   * - Date: Compare timestamps for semantic equality
   * - RegExp: Compare string representation (includes flags)
   */
  if (objA instanceof Date && objB instanceof Date) {
    return objA.getTime() === objB.getTime()
  }
  if (objA instanceof RegExp && objB instanceof RegExp) {
    return objA.toString() === objB.toString()
  }

  /**
   * @internal
   * Guard clause ensures both values are objects.
   * After this point, we know both are non-null objects.
   */
  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false
  }

  /**
   * @internal
   * Circular reference detection using WeakMap.
   * If we've already compared objA to objB, assume equal to break cycle.
   * WeakMap ensures no memory leaks as objects can be GC'd.
   */
  if (map.get(objA) === objB) return true
  map.set(objA, objB)

  /**
   * @internal
   * Array comparison with length check for early exit.
   * Backwards iteration for potential performance benefit.
   */
  if (Array.isArray(objA) && Array.isArray(objB)) {
    if (objA.length !== objB.length) return false
    for (let i = objA.length; i-- !== 0; ) {
      if (!deepEqual(objA[i], objB[i])) return false
    }
    return true
  }

  /**
   * @internal
   * Map comparison requires two passes:
   * 1. Check all keys exist in both maps
   * 2. Deep compare all values
   * Size check provides early exit optimization.
   */
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

  /**
   * @internal
   * Set comparison by converting to arrays.
   * Note: This assumes iteration order is consistent,
   * which is true for Sets in ES6+ but may fail for custom equality.
   */
  if (objA instanceof Set && objB instanceof Set) {
    if (objA.size !== objB.size) return false
    const arrA = [...objA.values()]
    const arrB = [...objB.values()]
    for (let i = arrA.length; i-- !== 0; ) {
      if (!deepEqual(arrA[i], arrB[i])) return false
    }
    return true
  }

  /**
   * @internal
   * ArrayBuffer and TypedArray comparison at byte level.
   * Converts to Int8Array for uniform byte-by-byte comparison.
   * Extra block scope is vestigial but preserved.
   */
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

  /**
   * @internal
   * Generic object comparison using Reflect API.
   * - Reflect.ownKeys includes string keys, numeric keys, and symbols
   * - More thorough than Object.keys which misses symbols
   * - Length check provides early exit
   * - Reflect.has checks for key existence before deep comparison
   */
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
