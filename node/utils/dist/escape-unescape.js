/**
 * (c) Andrea Giammarchi - MIT
 * {@see https://github.com/WebReflection/html-escaper}
 */
const reEscape = /[&<>'"]/g;
const reUnescape = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g;
const escapeObj = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\'': '&#39;',
    '"': '&quot;',
};
const unescapeObj = {
    '&amp;': '&',
    '&#38;': '&',
    '&lt;': '<',
    '&#60;': '<',
    '&gt;': '>',
    '&#62;': '>',
    '&apos;': '\'',
    '&#39;': '\'',
    '&quot;': '"',
    '&#34;': '"',
};
const { replace } = '';
const cape = (key) => escapeObj[key];
const ucape = (key) => unescapeObj[key];
/**
 * @desription escapes a string
 * @example
 * escape('&<>\'"') => '&amp;&lt;&gt;&#39;&quot;'
 */
export const escape = (sub) => replace.call(sub, reEscape, cape);
/**
 * @desription unescapes an escaped a string
 * @example
 * unescape('&amp;&lt;&gt;&#39;&quot;') => '&<>\'"'
 */
export const unescape = (sub) => replace.call(sub, reUnescape, ucape);
