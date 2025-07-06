import { canUseDOM } from './can-use-dom.js'

/**
 * Creates a DocumentFragment from HTML string with executable scripts.
 *
 * ⚠️ **Security Warning**: This utility allows JavaScript execution from HTML strings.
 * Only use with trusted sources or when you have proper Content Security Policy (CSP) configured.
 *
 * This function uses the `setHTMLUnsafe` API to parse HTML, which allows script execution.
 * Scripts in the HTML are reconstructed to ensure they execute when the fragment is
 * appended to the DOM.
 *
 * @param html - The HTML string to parse into a DocumentFragment
 * @returns DocumentFragment with executable scripts, or undefined if DOM is not available
 *
 * @example
 * // Basic usage - only with trusted content!
 * const fragment = createDocumentFragment('<div>Hello <script>console.log("World")</script></div>');
 * document.body.appendChild(fragment); // Script executes here
 *
 * @example
 * // Loading a component with scripts
 * const widgetHTML = await fetch('/trusted-widget.html').then(r => r.text());
 * const fragment = createDocumentFragment(widgetHTML);
 * container.appendChild(fragment);
 *
 * @remarks
 * - Returns undefined in non-DOM environments (e.g., SSR)
 * - Scripts are cloned and replaced to ensure execution
 * - All script attributes are preserved during reconstruction
 * - Uses `setHTMLUnsafe` which is part of the HTML Sanitizer API
 * - Script execution happens when the fragment is appended to the DOM
 *
 * @internal
 */
export const createDocumentFragment = (html: string) => {
  if (!canUseDOM()) return
  const tpl = document.createElement('template')
  tpl.setHTMLUnsafe(html)
  const clone = tpl.content.cloneNode(true) as DocumentFragment
  const scripts = clone.querySelectorAll<HTMLScriptElement>('script')
  for (const script of scripts) {
    const newScript = document.createElement('script')
    for (const attr of script.attributes) {
      newScript.setAttribute(attr.name, attr.value)
    }
    if (script.textContent) {
      newScript.textContent = script.textContent
    }
    script.parentNode?.appendChild(newScript)
    script.parentNode?.removeChild(script)
  }
  return clone
}
