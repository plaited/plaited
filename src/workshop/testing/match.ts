/**
 * Function type for string pattern matching utility.
 * Creates a curried matcher function for finding patterns in strings.
 *
 * @param str - Source string to search within for matches
 * @returns A curried function that takes a pattern and returns the first matched substring
 *
 * @example Using with a string pattern
 * ```ts
 * const matcher: Match = match('Hello world');
 * const result = matcher('world'); // returns 'world'
 * ```
 *
 * @example Using with a RegExp pattern
 * ```ts
 * const matcher: Match = match('Testing 123');
 * const result = matcher(/\d+/); // returns '123'
 * ```
 *
 * @remarks
 * The returned function is curried, allowing for reuse with different patterns
 * on the same source string. This is particularly useful when you need to search
 * for multiple patterns within the same text.
 */
export type Match = (str: string) => (pattern: string | RegExp) => string

/**
 * Escapes special regular expression characters in a string.
 *
 * @internal
 * @param str - String containing potential RegExp special characters
 * @returns String with all RegExp special characters escaped
 */
const escapeRegex = (str: string) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

/**
 * Creates a pattern matcher for finding text in strings.
 * Supports both literal string and RegExp patterns with safe escaping.
 *
 * @param str - Source string to search within
 * @returns A function that accepts a pattern (string or RegExp) and returns the first matched substring
 *
 * @example Finding simple text patterns
 * ```ts
 * const findInText = match('Hello, world!');
 * findInText('world');  // returns 'world'
 * findInText('foo');    // returns '' (no match)
 * ```
 *
 * @example Using regular expressions
 * ```ts
 * const text = match('user@example.com');
 * text(/\w+@\w+\.\w+/);  // returns 'user@example.com'
 * text(/\d+/);           // returns '' (no match)
 * ```
 *
 * @example Safe handling of special characters
 * ```ts
 * const text = match('price is $25.00');
 * text('$25.00');  // returns '$25.00' (special chars handled automatically)
 * text(/\$\d+\.\d+/);  // returns '$25.00' (using RegExp)
 * ```
 *
 * @remarks
 * Key features:
 * - Returns empty string ('') when no match is found
 * - Automatically escapes special RegExp characters in string patterns
 * - Accepts both string literals and RegExp objects as patterns
 * - Returns only the first match found in the string
 * - Thread-safe and immutable - creates new RegExp for each match
 * - Suitable for user-provided patterns due to automatic escaping
 *
 * Common use cases:
 * - Text extraction and validation
 * - Pattern matching in strings
 * - Safe handling of user-provided search terms
 * - Creating reusable text matchers
 */
export const match: Match = (str: string) => (pattern: string | RegExp) => {
  const RE = new RegExp(typeof pattern === 'string' ? escapeRegex(pattern) : pattern)
  const matched = str.match(RE)
  return matched ? matched[0] : ''
}
