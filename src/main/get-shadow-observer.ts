import type { Trigger } from '../behavioral/b-program.js'
import { P_TRIGGER, P_TARGET } from '../jsx/jsx.constants.js'
import { addListeners } from './add-listeners.js'
import { assignHelpers, getBoundElements } from './assign-helpers.js'

const isElement = (node: Node): node is Element => node.nodeType === 1

/**
 * Creates a MutationObserver for shadow DOM to handle dynamic p-trigger elements.
 * Observes attribute changes and node additions for event delegation.
 *
 * @param root ShadowRoot to observe
 * @param trigger Event trigger function
 * @returns MutationObserver instance
 *
 * @example
 * ```ts
 * // In component context
 * const Component = defineTemplate({
 *   tag: 'my-component',
 *   shadowDom: template,
 *   bProgram({ trigger }) {
 *     const observer = getShadowObserver(this.shadowRoot, trigger);
 *
 *     return {
 *       // Cleanup on disconnect
 *       onDisconnected() {
 *         observer.disconnect();
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * Features:
 * - Observes p-trigger attribute changes
 * - Watches for new elements
 * - Handles nested elements
 * - Automatic event delegation
 * - Deep tree observation
 *
 * @remarks
 * - Observes entire shadow DOM tree
 * - Filters for p-trigger attribute changes
 * - Handles dynamically added elements
 * - Sets up event delegation automatically
 * - Requires manual disconnect when done
 *
 * Implementation details:
 * - Uses MutationObserver for DOM changes
 * - Delegates events through p-trigger attribute
 * - Handles both direct and nested elements
 * - Manages event listener lifecycle
 * - Provides automatic cleanup of invalid listeners
 */
export const getShadowObserver = (root: ShadowRoot, trigger: Trigger) => {
  const boundElements = getBoundElements(root)
  /**  Observes the addition of nodes to the shadow dom and changes to and child's p-trigger attribute */
  const mo = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'attributes') {
        const el = mutation.target
        if (isElement(el)) {
          mutation.attributeName === P_TRIGGER && el.getAttribute(P_TRIGGER) && addListeners([el], trigger)
          mutation.attributeName === P_TARGET && el.getAttribute(P_TARGET) && assignHelpers(boundElements, [el])
        }
      } else if (mutation.addedNodes.length) {
        const length = mutation.addedNodes.length
        for (let i = 0; i < length; i++) {
          const node = mutation.addedNodes[i]
          if (isElement(node)) {
            const targets = Array.from(node.querySelectorAll(`[${P_TARGET}]`))
            node.hasAttribute(P_TARGET) && targets.push(node)
            assignHelpers(boundElements, targets)
            const triggers = Array.from(node.querySelectorAll(`[${P_TRIGGER}]`))
            node.hasAttribute(P_TRIGGER) && triggers.push(node)
            addListeners(triggers, trigger)
          }
        }
      }
    }
  })
  mo.observe(root, {
    attributeFilter: [P_TRIGGER, P_TARGET],
    childList: true,
    subtree: true,
  })
  return mo
}
