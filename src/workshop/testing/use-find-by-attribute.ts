import type { Trigger } from '../../behavioral/b-program.js'
import type { FindByAttribute, FindByAttributeDetails } from './testing.types.js'

export const FIND_BY_ATTRIBUTE = 'find_by_attribute'

export const useFindByAttribute = (trigger: Trigger) => {
  /**
   * @description Asynchronously searches for an element by a specific attribute and its value,
   * traversing both the light DOM and any nested shadow DOM trees.
   *
   * @template T - The expected element type (HTMLElement or SVGElement) to be returned. Defaults to `HTMLElement | SVGElement`.
   * @param {string} attributeName - The name of the attribute to query.
   * @param {string | RegExp} attributeValue - The exact string value or a regular expression to match against the attribute's value.
   * @param {HTMLElement | SVGElement} [context=document] - An optional element (or the document itself) to serve as the starting point for the search. Defaults to `document`.
   * @returns {Promise<T | undefined>} A promise that resolves with the first matching element (cast to type T) or `undefined` if no element with the specified attribute and value is found.
   *
   * @example Basic Usage
   * ```typescript
   * import { findByAttribute } from 'plaited/workshop';
   *
   * // Find an element with the attribute data-testid="login-button"
   * const loginButton = await findByAttribute('data-testid', 'login-button');
   *
   * // Find an element whose class attribute contains 'icon-' followed by letters
   * const iconElement = await findByAttribute('class', /icon-\w+/);
   * ```
   *
   * @example Usage with Context and Specific Type
   * ```typescript
   * const container = document.getElementById('user-section');
   *
   * // Find an <input> element within the container with name="email"
   * const emailInput = await findByAttribute<HTMLInputElement>('name', 'email', container);
   *
   * if (emailInput) {
   *   console.log(emailInput.value);
   * }
   * ```
   *
   * @remarks
   * - The search is performed recursively through all child nodes (element nodes) and shadow roots.
   * - It checks the attribute value using `getAttribute`.
   * - Handles both exact string matches and regular expression tests.
   * - The search operation is scheduled using `requestAnimationFrame`, but the core traversal is synchronous within that frame.
   */
  const findByAttribute: FindByAttribute = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    attributeName: string,
    attributeValue: string | RegExp,
    context?: HTMLElement | SVGElement,
  ): Promise<T | undefined> => {
    trigger<FindByAttributeDetails>({
      type: FIND_BY_ATTRIBUTE,
      detail: [attributeName, attributeValue, context],
    })
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
  return findByAttribute
}
