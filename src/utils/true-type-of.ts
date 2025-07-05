/**
 * @internal
 * @module true-type-of
 *
 * Purpose: Enhanced JavaScript type detection beyond typeof operator limitations
 * Architecture: Uses [[Class]] internal property via Object.prototype.toString
 * Dependencies: None - uses native JavaScript prototype methods
 * Consumers: Type guards, validation utilities, debugging tools, serialization
 *
 * Maintainer Notes:
 * - Provides accurate type detection where typeof falls short
 * - toString.call bypasses custom toString overrides on objects
 * - slice(8, -1) extracts type from "[object Type]" format
 * - toLowerCase ensures consistent return format
 * - Handles all ES6+ types including Symbol, BigInt, async functions
 * - Critical for runtime type checking in dynamic systems
 *
 * Common modification scenarios:
 * - Adding custom type detection: Extend with instanceof checks
 * - TypeScript integration: Create type predicate overloads
 * - Performance optimization: Add result caching for repeated checks
 * - Custom object support: Check for toStringTag symbol
 *
 * Performance considerations:
 * - Function call overhead for each type check
 * - String operations (slice, toLowerCase) on each call
 * - No caching - consider memoization for hot paths
 * - toString.call is slower than typeof but more accurate
 *
 * Known limitations:
 * - Cannot distinguish between different error types
 * - All typed arrays return their specific type (not generic 'typedarray')
 * - Custom toStringTag can be spoofed
 * - Cross-realm objects may have unexpected results
 */

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
export const trueTypeOf = (obj?: unknown): string => {
  /**
   * @internal
   * Uses Object.prototype.toString to get [[Class]] internal property.
   * - .call(obj) ensures we use Object's toString, not obj's override
   * - Returns format: "[object Type]"
   * - .slice(8, -1) extracts "Type" from "[object Type]"
   * - .toLowerCase() normalizes to lowercase for consistent comparison
   *
   * This technique works because Object.prototype.toString accesses
   * the [[Class]] internal property which cannot be overridden.
   */
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase()
}
