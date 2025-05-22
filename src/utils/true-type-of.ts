/**
 * Returns the precise type of any JavaScript value as a lowercase string.
 * Provides more accurate type detection than the typeof operator.
 *
 * @param obj - Any JavaScript value to check
 * @returns Lowercase string representing the true type
 *
 * Supported Return Types:
 * - 'string' - String primitives and objects
 * - 'number' - Numbers and Number objects
 * - 'boolean' - Boolean values and objects
 * - 'undefined' - undefined
 * - 'null' - null
 * - 'symbol' - Symbol primitives
 * - 'bigint' - BigInt values
 * - 'array' - Array instances
 * - 'object' - Plain objects
 * - 'date' - Date instances
 * - 'regexp' - RegExp instances
 * - 'map' - Map instances
 * - 'set' - Set instances
 * - 'function' - Functions
 * - 'asyncfunction' - Async functions
 * - 'generatorfunction' - Generator functions
 *
 * @example
 * Basic Types
 * ```ts
 * trueTypeOf('hello')           // 'string'
 * trueTypeOf(42)               // 'number'
 * trueTypeOf(true)            // 'boolean'
 * trueTypeOf(undefined)       // 'undefined'
 * trueTypeOf(null)           // 'null'
 * ```
 *
 * @example
 * Objects and Collections
 * ```ts
 * trueTypeOf({})              // 'object'
 * trueTypeOf([])              // 'array'
 * trueTypeOf(new Map())       // 'map'
 * trueTypeOf(new Set())       // 'set'
 * ```
 *
 * @example
 * Special Objects
 * ```ts
 * trueTypeOf(new Date())      // 'date'
 * trueTypeOf(/regex/)         // 'regexp'
 * trueTypeOf(() => {})        // 'function'
 * trueTypeOf(async () => {})  // 'asyncfunction'
 * ```
 *
 * @example
 * Type Checking Pattern
 * ```ts
 * function processValue(value: unknown) {
 *   switch (trueTypeOf(value)) {
 *     case 'string':
 *       return value.toLowerCase();
 *     case 'array':
 *       return value.length;
 *     case 'date':
 *       return value.toISOString();
 *     default:
 *       throw new Error(`Unsupported type: ${trueTypeOf(value)}`);
 *   }
 * }
 * ```
 *
 * @remarks
 * Implementation Details:
 * - Uses Object.prototype.toString for reliable type detection
 * - Always returns lowercase string for consistency
 * - Works with primitives and objects
 * - Handles null and undefined correctly
 * - More precise than typeof operator
 *
 * Common Use Cases:
 * - Type validation
 * - Switch statement type handling
 * - API data validation
 * - Debug logging
 * - Type-based processing
 */
export const trueTypeOf = (obj?: unknown): string => Object.prototype.toString.call(obj).slice(8, -1).toLowerCase()
