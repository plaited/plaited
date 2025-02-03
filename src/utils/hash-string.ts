/**
 * Implements the djb2 string hashing algorithm.
 *
 * Features:
 * - Fast and simple string hashing
 * - Good distribution for string keys
 * - Returns a 32-bit integer hash value
 * - Non-cryptographic hash function
 *
 * Algorithm:
 * hash = ((hash << 5) + hash) + char
 * Initial hash value: 5381
 *
 * @param str String to be hashed
 * @returns 32-bit integer hash value
 *
 * @example
 * hashString('hello') // Returns consistent hash value
 * hashString('hello') === hashString('hello') // Always true
 * hashString('hello') !== hashString('hello!') // Different strings = different hashes
 *
 * @remarks
 * - Created by Dan Bernstein
 * - Widely used for hash tables
 * - Not suitable for cryptographic purposes
 * - Provides good performance and distribution for general use
 */
export const hashString = (str: string) => {
  const hash = [...str].reduce<number>((acc, cur) => (acc << 5) + acc + cur.charCodeAt(0), 5381)
  return hash === 5381 ? null : hash
}
