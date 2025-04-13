/**
 * Returns the precise type of any JavaScript value.
 * More accurate than typeof operator, especially for built-in objects and null.
 *
 * Returns types like:
 * - 'string' for strings
 * - 'number' for numbers
 * - 'array' for arrays
 * - 'object' for objects
 * - 'null' for null
 * - 'undefined' for undefined
 * - 'date' for Date objects
 * - 'regexp' for RegExp objects
 * - 'map' for Map objects
 * - 'set' for Set objects
 *
 * @param obj Any JavaScript value
 * @returns Lowercase string representing the true type
 *
 * @example
 * trueTypeOf('hello')     // 'string'
 * trueTypeOf([1,2,3])     // 'array'
 * trueTypeOf(null)        // 'null'
 * trueTypeOf(new Date())  // 'date'
 *
 * @remarks
 * Uses Object.prototype.toString for accurate type detection,
 * avoiding the limitations of the typeof operator
 */
export const trueTypeOf = (obj?: unknown): string => Object.prototype.toString.call(obj).slice(8, -1).toLowerCase()
