/**
 * @internal
 * @module escape
 *
 * Purpose: HTML escaping utilities for XSS prevention in string-based content
 * Architecture: Optimized regex-based escaping using cached function references
 * Dependencies: None - pure JavaScript implementation
 * Consumers: Components handling user input, template rendering, dynamic content
 *
 * Maintainer Notes:
 * - This module provides critical XSS protection for string-based HTML generation
 * - Based on battle-tested html-escaper library patterns
 * - Uses numeric entities for quotes to ensure compatibility
 * - Function reference caching (`const { replace } = ''`) improves performance
 * - Regex patterns are precompiled for efficiency
 * - Handles both named and numeric HTML entities
 *
 * Common modification scenarios:
 * - Adding more entities: Update regex patterns and key-value maps
 * - Supporting Unicode: Consider full entity encoding
 * - Performance tuning: Consider state machine for very long strings
 * - Framework integration: Add framework-specific wrappers
 *
 * Performance considerations:
 * - Regex replace is O(n) where n is string length
 * - Function reference avoids prototype lookup on each call
 * - Object lookups are O(1) for entity mapping
 * - No string concatenation - single pass replacement
 *
 * Known limitations:
 * - Only escapes the 5 critical HTML characters
 * - Does not handle Unicode or extended entities
 * - Not suitable for escaping within script/style tags
 * - Cannot be used for attribute name escaping
 *
 * Security notes:
 * - Always escape user input before rendering
 * - This prevents XSS but not other injection types
 * - Use with setHTMLUnsafe or innerHTML only
 * - For attributes, ensure quotes are properly handled
 */

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

/**
 * @internal
 * Precompiled regex for finding characters that need HTML escaping.
 * Global flag enables replacing all occurrences in one pass.
 */
const escapeRegex = /[&<>'"]/g

/**
 * @internal
 * Precompiled regex for finding HTML entities to unescape.
 * Matches both named entities (amp, lt, etc.) and numeric (&#38;, etc.).
 * Non-capturing group (?:) for performance.
 */
const unescapeRegex = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g

/**
 * @internal
 * Lookup table for escape replacements.
 * Uses numeric entities for quotes for maximum compatibility.
 */
const escapeKeyValues = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}

/**
 * @internal
 * Lookup table for unescape replacements.
 * Handles both named and numeric entity forms.
 * apos is included for XHTML compatibility.
 */
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

/**
 * @internal
 * Cached reference to String.prototype.replace.
 * Avoids prototype chain lookup on every escape/unescape call.
 */
const { replace } = ''

/**
 * @internal
 * Callback for escape regex replacement.
 * Type assertion is safe - regex only matches keys in escapeKeyValues.
 */
const getEscapeValue = (key: string) => escapeKeyValues[key as keyof typeof escapeKeyValues]

/**
 * @internal
 * Callback for unescape regex replacement.
 * Type assertion is safe - regex only matches keys in unescapeKeyValues.
 */
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
