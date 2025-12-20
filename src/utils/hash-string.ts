/**
 * Fast non-cryptographic string hashing using djb2 algorithm.
 * Returns consistent 32-bit hash for caching and comparison.
 *
 * @param str - String to hash
 * @returns 32-bit hash or null for empty string
 *
 * @remarks
 * **Algorithm Details:**
 * - Uses djb2: `hash = ((hash << 5) + hash) + char`
 * - Seed value: 5381 (djb2 magic constant)
 * - Returns null for empty strings to differentiate from valid hashes
 *
 * **Characteristics:**
 * - Deterministic: same input always produces same output
 * - Fast: O(n) where n is string length
 * - Not cryptographically secure
 *
 * **Common Use Cases:**
 * - CSS class name generation
 * - Cache key generation
 * - Content change detection
 * - Quick equality checks for large strings
 *
 * @see {@link createStyles} for CSS hash usage
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
