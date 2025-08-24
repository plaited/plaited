/**
 * Fast non-cryptographic string hashing using djb2 algorithm.
 * Returns consistent 32-bit hash for caching and comparison.
 *
 * @param str - String to hash
 * @returns 32-bit hash or null for empty string
 *
 * @example Basic usage
 * ```ts
 * hashString('hello');  // Consistent number
 * hashString('');       // null
 * ```
 *
 * @example Change detection
 * ```ts
 * const original = hashString(content);
 * const updated = hashString(newContent);
 * if (original !== updated) {
 *   // Content changed
 * }
 * ```
 *
 * @example Cache keys
 * ```ts
 * const key = hashString(JSON.stringify(data));
 * cache.set(key, processedResult);
 * ```
 *
 * @remarks
 * Algorithm: djb2 (hash = ((hash << 5) + hash) + char)
 * Not cryptographically secure.
 * Deterministic and fast.
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
