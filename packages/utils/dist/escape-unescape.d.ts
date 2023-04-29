/**
 * (c) Andrea Giammarchi - MIT
 * {@see https://github.com/WebReflection/html-escaper}
 */
/**
 * @desription escapes a string
 * @example
 * escape('&<>\'"') => '&amp;&lt;&gt;&#39;&quot;'
 */
export declare const escape: (sub: string) => any;
/**
 * @desription unescapes an escaped a string
 * @example
 * unescape('&amp;&lt;&gt;&#39;&quot;') => '&<>\'"'
 */
export declare const unescape: (sub: string) => any;
