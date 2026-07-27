/**
 * HTML escaping utilities for XSS prevention.
 * Based on html-escaper library patterns.
 *
 * ⚠️ **Security**: Always escape user input before rendering HTML.
 *
 * @remarks
 * Character mappings:
 * - & → &amp;
 * - < → &lt;
 * - > → &gt;
 * - ' → &#39;
 * - " → &quot;
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
 * Escapes HTML special characters to prevent XSS.
 *
 * @param sub - String to escape
 * @returns Escaped string with HTML entities
 *
 * @remarks
 * Converts special characters to their HTML entity equivalents:
 * - `&` → `&amp;`
 * - `<` → `&lt;`
 * - `>` → `&gt;`
 * - `'` → `&#39;` (numeric for compatibility)
 * - `"` → `&quot;`
 *
 * Always escape user input before rendering to prevent XSS attacks.
 *
 * @see {@link htmlUnescape} for reverse operation
 */
export const htmlEscape = (sub: string) => replace.call(sub, escapeRegex, getEscapeValue)

/**
 * Converts HTML entities back to original characters.
 *
 * @param sub - String with HTML entities
 * @returns Unescaped string
 *
 * @remarks
 * Handles both named and numeric entity forms:
 * - `&amp;` or `&#38;` → `&`
 * - `&lt;` or `&#60;` → `<`
 * - `&gt;` or `&#62;` → `>`
 * - `&apos;` or `&#39;` → `'` (apos for XHTML compatibility)
 * - `&quot;` or `&#34;` → `"`
 *
 * @see {@link htmlEscape} for escaping HTML
 */
export const htmlUnescape = (sub: string) => replace.call(sub, unescapeRegex, getUnescapeValue)
