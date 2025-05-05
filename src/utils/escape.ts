/**
 * HTML string escaping utilities based on html-escaper.
 * Provides functions to safely escape and unescape HTML special characters.
 *
 *
 * @remarks
 * Character mappings:
 * - & → &amp;
 * - < → &lt;
 * - > → &gt;
 * - ' → &#39;
 * - " → &quot;
 *
 * Also handles numeric character references:
 * - &#38; → &
 * - &#60; → <
 * - &#62; → >
 * - &#39; → '
 * - &#34; → "
 */

const escapeRegex = /[&<>'"]/g
const unescapeRegex = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g
const escapeKeyValues = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}
const unescapeKeyValues = {
  '&amp;': '&',
  '&#38;': '&',
  '&lt;': '<',
  '&#60;': '<',
  '&gt;': '>',
  '&#62;': '>',
  '&apos;': "'",
  '&#39;': "'",
  '&quot;': '"',
  '&#34;': '"',
}

const { replace } = ''
const getEscapeValue = (key: string) => escapeKeyValues[key as keyof typeof escapeKeyValues]
const getUnescapeValue = (key: string) => unescapeKeyValues[key as keyof typeof unescapeKeyValues]

/**
 * Escapes special HTML characters in a string to prevent XSS attacks.
 *
 * @param sub - The string to escape
 * @returns The escaped string with HTML entities
 *
 * @example
 * Basic Usage
 * ```ts
 * escape('<div class="test">')
 * // Returns: '&lt;div class=&quot;test&quot;&gt;'
 * ```
 *
 * @example
 * Multiple Characters
 * ```ts
 * escape('Hello & Goodbye')
 * // Returns: 'Hello &amp; Goodbye'
 * ```
 */
export const escape = (sub: string) => replace.call(sub, escapeRegex, getEscapeValue)

/**
 * Converts HTML entities back to their original characters.
 *
 * @param sub - The string containing HTML entities to unescape
 * @returns The unescaped string with original characters
 *
 * @example
 * Basic Usage
 * ```ts
 * unescape('&lt;div&gt;')
 * // Returns: '<div>'
 * ```
 *
 * @example
 * Mixed Entities
 * ```ts
 * unescape('&amp;quot;Hello&amp;quot;')
 * // Returns: '"Hello"'
 * ```
 *
 * @example
 * Numeric References
 * ```ts
 * unescape('&#39;Single Quote&#39;')
 * // Returns: "'Single Quote'"
 * ```
 */
export const unescape = (sub: string) => replace.call(sub, unescapeRegex, getUnescapeValue)
