/**
 * (c) Andrea Giammarchi - MIT
 * {@see https://github.com/WebReflection/html-escaper}
 */

const reEscape = /[&<>'"]/g
const reUnescape = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g
const escapeObj = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}
const unescapeObj = {
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
const cape = (key: string) => escapeObj[key as keyof typeof escapeObj]
const ucape = (key: string) => unescapeObj[key as keyof typeof unescapeObj]

/**
 * escapes a string
 * @example
 * escape('&<>\'"') => '&amp;&lt;&gt;&#39;&quot;'
 */
export const escape = (sub: string) => replace.call(sub, reEscape, cape)

/**
 * unescapes an escaped a string
 * @example
 * unescape('&amp;&lt;&gt;&#39;&quot;') => '&<>\'"'
 */
export const unescape = (sub: string) => replace.call(sub, reUnescape, ucape)
