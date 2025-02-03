/**
 * Type definition for shadow DOM-aware text search function.
 * Supports finding elements by their text content across shadow boundaries.
 *
 * @template T Element type to return (defaults to HTMLElement)
 * @param searchText Text content to find (string or RegExp)
 * @param context Optional element to limit search scope
 * @returns Promise resolving to element containing text or undefined
 */
export type FindByText = <T extends HTMLElement = HTMLElement>(
  searchText: string | RegExp,
  context?: HTMLElement,
) => Promise<T | undefined>
/**
 * Asynchronously finds elements by their text content, searching through both light and shadow DOM.
 * Returns the parent element of matching text nodes.
 *
 * @template T Element type to return (defaults to HTMLElement)
 * @param searchText Text to search for (exact match or RegExp pattern)
 * @param context Optional element to scope the search (defaults to document.body)
 * @returns Promise<T | undefined> Element containing matching text or undefined
 *
 * @example Basic Usage
 * ```ts
 * // Find by exact text
 * const element = await findByText('Click me');
 *
 * // Find by pattern
 * const element = await findByText(/Submit|Send/);
 * ```
 *
 * @example With Context and Type
 * ```ts
 * // Search within container with type
 * const button = await findByText<HTMLButtonElement>(
 *   'Submit',
 *   formElement
 * );
 *
 * if (button) {
 *   button.disabled = true;
 * }
 * ```
 *
 * @example Shadow DOM Search
 * ```ts
 * // Search through custom elements
 * const element = await findByText(
 *   'Hidden Content',
 *   customElement
 * );
 * ```
 *
 * Features:
 * - Shadow DOM traversal
 * - Regular expression matching
 * - Type-safe returns
 * - Scoped searching
 * - Async operation
 * - Trim whitespace
 *
 * @remarks
 * - Returns parent of first matching text node
 * - Searches synchronously but returns Promise
 * - Traverses all shadow roots
 * - Uses requestAnimationFrame
 * - Trims text content before matching
 * - Handles nested shadow DOM
 *
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
