/**
 * Implements the djb2 string hashing algorithm for generating consistent hash values from strings.
 *
 * @param str - Input string to hash. Can be any length.
 * @returns A 32-bit integer hash value, or null if input string is empty
 *
 * @remarks
 * Algorithm Details:
 * - Name: djb2 (Daniel J. Bernstein, v2)
 * - Formula: hash = ((hash << 5) + hash) + char
 * - Initial value: 5381
 * - Time complexity: O(n) where n is string length
 *
 * Key Features:
 * - Deterministic: Same input always produces same output
 * - Fast computation: Simple bitwise operations
 * - Good distribution: Minimizes collisions
 * - Integer output: 32-bit number (or null for empty string)
 * - Non-cryptographic: Not suitable for security purposes
 *
 * Common Use Cases:
 * - Generating keys for caching
 * - Quick string comparison
 * - Hash tables/maps
 * - Content change detection
 *
 * @example
 * Basic Usage
 * ```ts
 * hashString('hello')        // Returns consistent number
 * hashString('')            // Returns null
 * ```
 *
 * @example
 * Comparison Usage
 * ```ts
 * // Same strings = same hash
 * hashString('test') === hashString('test')    // true
 *
 * // Different strings = different hash
 * hashString('test') !== hashString('test2')   // true
 * ```
 *
 * @example
 * Change Detection
 * ```ts
 * const original = hashString(content);
 * // ... later
 * const changed = hashString(newContent);
 * if (original !== changed) {
 *   // Content has changed
 * }
 * ```
 *
 * @example
 * Caching Key Generation
 * ```ts
 * const cacheKey = hashString(complexData);
 * cache.set(cacheKey, processedResult);
 * ```
 *
 * Limitations:
 * - Not cryptographically secure
 * - Possible (but rare) collisions
 * - Limited to 32-bit integer range
 * - Returns null for empty strings
 */
export const hashString = (str: string) => {
  const hash = [...str].reduce<number>((acc, cur) => (acc << 5) + acc + cur.charCodeAt(0), 5381)
  return hash === 5381 ? null : hash
}
