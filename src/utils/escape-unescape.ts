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

/**
 * @desription escapes a string
 * @example
 * escape('&<>\'"') => '&amp;&lt;&gt;&#39;&quot;'
 */
export const escape = (sub:string) => replace.call(
  sub,
  reEscape,
  key => escapeObj[key as keyof typeof escapeObj]
)
/**
 * @desription unescapes an escaped a string
 * @example
 * unescape('&amp;&lt;&gt;&#39;&quot;') => '&<>\'"'
 */
export const unescape = (sub: string) => replace.call(
  sub,
  reUnescape,
  key => unescapeObj[key as keyof typeof unescapeObj]
)
