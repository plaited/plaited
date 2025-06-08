/**
 * @description Type definition for a function that asynchronously finds an element
 * containing specific text content, searching through light and shadow DOM.
 *
 * @template T - The expected HTMLElement type to be returned. Defaults to `HTMLElement`.
 * @param {string | RegExp} searchText - The exact string or regular expression pattern to match within the text content of elements.
 * @param {HTMLElement} [context=document.body] - An optional element within which to limit the search scope. Defaults to `document.body`.
 * @returns {Promise<T | undefined>} A promise that resolves to the first element (of type T) containing the matching text, or `undefined` if no match is found.
 */
export type FindByText = <T extends HTMLElement = HTMLElement>(
  searchText: string | RegExp,
  context?: HTMLElement,
) => Promise<T | undefined>

/**
 * @description Asynchronously searches for an element by its text content, traversing both the light DOM
 * and any nested shadow DOM trees. Returns the immediate parent element of the first matching text node found.
 *
 * @template T - The expected HTMLElement type to be returned. Defaults to `HTMLElement`.
 * @param {string | RegExp} searchText - The exact string or a regular expression to match against the trimmed text content of elements.
 * @param {HTMLElement} [context=document.body] - An optional HTMLElement to serve as the starting point for the search. Defaults to `document.body`.
 * @returns {Promise<T | undefined>} A promise that resolves with the first matching parent element (cast to type T) or `undefined` if no element contains the specified text.
 *
 * @example Basic Usage
 * ```typescript
 * import { findByText } from 'plaited/workshop';
 *
 * // Find an element containing the exact text "Submit Button"
 * const submitButton = await findByText('Submit Button');
 *
 * // Find an element containing text that matches the regex /Save|Update/
 * const saveOrUpdateButton = await findByText(/Save|Update/);
 * ```
 *
 * @example Usage with Context and Specific Type
 * ```typescript
 * const formElement = document.getElementById('my-form');
 *
 * // Find a <button> element within the form containing "Login"
 * const loginButton = await findByText<HTMLButtonElement>('Login', formElement);
 *
 * if (loginButton) {
 *   loginButton.disabled = true;
 * }
 * ```
 *
 * @remarks
 * - The search is performed recursively through all child nodes and shadow roots.
 * - Text content is trimmed (`.textContent?.trim()`) before comparison.
 * - The function returns the `parentElement` of the matching text node.
 * - The search operation is scheduled using `requestAnimationFrame` but the core traversal is synchronous within that frame.
 */
export const findByText: FindByText = <T extends HTMLElement = HTMLElement>(
  searchText: string | RegExp,
  context?: HTMLElement,
): Promise<T | undefined> => {
  const searchInShadowDom = (node: Node): T | undefined => {
    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent?.trim()
      if (typeof searchText === 'string' && content === searchText) {
        return (node.parentElement as T) ?? undefined
      } else if (searchText instanceof RegExp && content && searchText.test(content)) {
        return (node.parentElement as T) ?? undefined
      }
    }

    if (node instanceof HTMLElement && node.shadowRoot) {
      for (const child of node.shadowRoot.children) {
        const result = searchInShadowDom(child)
        if (result) {
          return result
        }
      }
    }

    for (const child of node.childNodes) {
      const result = searchInShadowDom(child)
      if (result) {
        return result
      }
    }
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const rootNode = context ?? document.body
      const foundNode = searchInShadowDom(rootNode)
      resolve(foundNode)
    })
  })
}
