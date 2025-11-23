import { canUseDOM } from './can-use-dom.ts'

/**
 * @internal
 * Creates DocumentFragment from HTML with executable scripts.
 *
 * ⚠️ **Security Warning**: Allows script execution.
 * Only use with trusted content or proper CSP.
 *
 * @param html - HTML string to parse
 * @returns DocumentFragment or undefined if no DOM
 *
 * @example Trusted content only
 * ```ts
 * const fragment = createDocumentFragment(
 *   '<div>Hello <script>console.log("World")</script></div>'
 * );
 * document.body.appendChild(fragment); // Script executes
 * ```
 *
 * @remarks
 * Uses setHTMLUnsafe API.
 * Scripts execute on DOM append.
 * Returns undefined in SSR.
 *
 * @see {@link canUseDOM} for environment detection
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
