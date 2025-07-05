/**
 * @internal
 * @module hash-string
 *
 * Purpose: Fast non-cryptographic string hashing for internal caching and comparison
 * Architecture: djb2 algorithm implementation using functional reduce pattern
 * Dependencies: None - pure JavaScript implementation
 * Consumers: CSS-in-JS system, caching layers, content change detection
 *
 * Maintainer Notes:
 * - djb2 is chosen for speed and good distribution properties
 * - Magic number 5381 is prime and has been empirically proven effective
 * - Bit shift by 5 is equivalent to multiply by 33 (faster)
 * - Spread operator converts string to array for functional approach
 * - Returns null for empty string to distinguish from hash of '0'
 * - 32-bit integer result due to JavaScript bitwise operations
 *
 * Common modification scenarios:
 * - Switching algorithms: Replace reduce logic with new hash function
 * - 64-bit hashing: Use BigInt operations but impacts performance
 * - Salt support: Add optional salt parameter to reduce
 * - Collision handling: Return string representation to avoid overflows
 *
 * Performance considerations:
 * - String spread creates temporary array (memory overhead)
 * - Reduce prevents early exit but enables functional style
 * - Bitwise operations force 32-bit integer conversion
 * - No caching of results - consider memoization for hot paths
 *
 * Known limitations:
 * - Not suitable for cryptographic purposes
 * - 32-bit range limits unique values (~4 billion)
 * - Collisions possible with large datasets
 * - No Unicode normalization before hashing
 */

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
  /**
   * @internal
   * djb2 algorithm implementation:
   * - [...str] spreads string into character array
   * - reduce iterates each character with accumulator
   * - (acc << 5) + acc equals acc * 33 (but faster)
   * - charCodeAt(0) gets numeric Unicode value
   * - 5381 is the djb2 magic seed value
   */
  const hash = [...str].reduce<number>((acc, cur) => (acc << 5) + acc + cur.charCodeAt(0), 5381)

  /**
   * @internal
   * Return null for empty strings to differentiate from valid hashes.
   * 5381 is only returned if no characters were processed.
   */
  return hash === 5381 ? null : hash
}
