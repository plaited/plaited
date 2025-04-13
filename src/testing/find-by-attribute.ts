/**
 * Type definition for the shadow DOM-aware attribute finder function.
 * Supports generic element types and optional search context.
 *
 * @template T Element type to search for (defaults to HTMLElement | SVGElement)
 * @param attributeName Name of attribute to match
 * @param attributeValue Value to match (string or RegExp)
 * @param context Optional element to limit search scope
 * @returns Promise resolving to matched element or undefined
 */
export type FindByAttribute = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement,
) => Promise<T | undefined>
/**
 * Asynchronously finds elements by attribute, searching through both light and shadow DOM.
 * Supports string and RegExp matching with optional search context.
 *
 * @template T Element type to return (defaults to HTMLElement | SVGElement)
 * @param attributeName Attribute name to search for
 * @param attributeValue Attribute value or pattern to match
 * @param context Optional element to scope the search
 * @returns Promise<T | undefined> First matching element or undefined
 *
 * @example Basic Usage
 * ```ts
 * // Find by exact match
 * const element = await findByAttribute('data-testid', 'user-profile');
 *
 * // Find by pattern
 * const element = await findByAttribute('class', /button-\w+/);
 * ```
 *
 * @example With Context and Type
 * ```ts
 * // Search within specific container
 * const container = document.querySelector('.container');
 * const button = await findByAttribute<HTMLButtonElement>(
 *   'role',
 *   'submit',
 *   container
 * );
 * ```
 *
 * @example Shadow DOM Search
 * ```ts
 * // Searches through shadow DOM boundaries
 * const element = await findByAttribute(
 *   'p-target',
 *   'content',
 *   customElement
 * );
 * ```
 *
 * Features:
 * - Shadow DOM traversal
 * - Regular expression support
 * - Type-safe element returns
 * - Scoped searching
 * - Async operation
 * - Animation frame timing
 *
 * @remarks
 * - Returns first matching element
 * - Searches synchronously but returns Promise
 * - Traverses all shadow roots
 * - Uses requestAnimationFrame
 * - Handles missing attributes
 * - Type-safe return values
 *
 */
export const findByAttribute: FindByAttribute = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement,
): Promise<T | undefined> => {
  const searchInShadowDom = (node: Node): T | undefined => {
    if (node.nodeType === 1) {
      const attr = (node as Element).getAttribute(attributeName)
      if (typeof attributeValue === 'string' && attr === attributeValue) {
        return node as T
      }
      if (attributeValue instanceof RegExp && attr && attributeValue.test(attr)) {
        return (node as T) ?? undefined
      }
      if ((node as Element).getAttribute(attributeName) === attributeValue) {
        return node as T
      }
    }

    if (node.nodeType === 1 && (node as Element).shadowRoot) {
      for (const child of ((node as Element).shadowRoot as ShadowRoot).children) {
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
      const rootNode = context ?? document
      const foundNode = searchInShadowDom(rootNode)
      resolve(foundNode)
    })
  })
}
