/**
 * Function type for string pattern matching utility.
 * Creates a curried matcher function for finding patterns in strings.
 *
 * @param str Source string to search within
 * @returns Function that accepts pattern and returns matched string
 *
 * @example
 * ```ts
 * const matcher: Match = (str) => (pattern) => // ...
 * ```
 */
export type Match = (str: string) => (pattern: string | RegExp) => string

const escapeRegex = (str: string) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
/**
 * Creates a pattern matcher for finding text in strings.
 * Supports both literal string and RegExp patterns with safe escaping.
 *
 * @param str Source string to search within
 * @returns Curried function that accepts pattern and returns matched string
 *
 * @example
 * ```ts
 * // With string pattern
 * const findInText = match('Hello, world!');
 * findInText('world');  // returns 'world'
 * findInText('foo');    // returns ''
 *
 * // With RegExp
 * const findDigits = match('abc123def');
 * findDigits(/\d+/);    // returns '123'
 *
 * // Special characters are escaped automatically
 * const findDot = match('hello.world');
 * findDot('.');         // returns '.'
 * ```
 *
 * @remarks
 * - Returns empty string if no match found
 * - Automatically escapes special characters in string patterns
 * - Returns first match only
 * - Preserves RegExp patterns without escaping
 * - Safe for use with user-provided patterns
 */
export const match: Match = (str: string) => (pattern: string | RegExp) => {
  const RE = new RegExp(typeof pattern === 'string' ? escapeRegex(pattern) : pattern)
  const matched = str.match(RE)
  return matched ? matched[0] : ''
}
