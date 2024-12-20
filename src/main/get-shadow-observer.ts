import type { Trigger } from '../behavioral/b-program.js'
import { DelegatedListener, delegates } from './delegated-listener.js'
import { P_TRIGGER } from '../jsx/jsx.constants.js'

const isElement = (node: Node): node is Element => node.nodeType === 1

const getTriggerMap = (el: Element) =>
  new Map((el.getAttribute(P_TRIGGER) as string).split(' ').map((pair) => pair.split(':')) as [string, string][])

/** get trigger for elements respective event from triggerTypeMap */
const getTriggerType = (event: Event, context: Element) => {
  const el =
    context.tagName !== 'SLOT' && event.currentTarget === context ? context
    : event.composedPath().find((el) => el instanceof ShadowRoot) === context.getRootNode() ? context
    : undefined
  if (!el) return
  return getTriggerMap(el).get(event.type)
}

/** If delegated listener does not have element then delegate it's callback with auto cleanup*/
const createDelegatedListener = (el: Element, trigger: Trigger) => {
  delegates.set(
    el,
    new DelegatedListener((event) => {
      const type = el.getAttribute(P_TRIGGER) && getTriggerType(event, el)
      type ?
        /** if key is present in `p-trigger` trigger event on instance's bProgram */
        trigger?.({ type, detail: event })
      : /** if key is not present in `p-trigger` remove event listener for this event on Element */
        el.removeEventListener(event.type, delegates.get(el))
    }),
  )
}

/** add delegated event listeners  for elements in list */
export const addListeners = (elements: Element[], trigger: Trigger) => {
  for (const el of elements) {
    if (el.tagName === 'SLOT' && Boolean(el.assignedSlot)) continue // skip nested slots
    !delegates.has(el) && createDelegatedListener(el, trigger) // bind a callback for element if we haven't already
    for (const [event] of getTriggerMap(el)) {
      // add event listeners for each event type
      el.addEventListener(event, delegates.get(el))
    }
  }
}

export const getShadowObserver = (root: ShadowRoot, trigger: Trigger) => {
  /**  Observes the addition of nodes to the shadow dom and changes to and child's p-trigger attribute */
  const mo = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'attributes') {
        const el = mutation.target
        if (isElement(el)) {
          mutation.attributeName === P_TRIGGER && el.getAttribute(P_TRIGGER) && addListeners([el], trigger)
        }
      } else if (mutation.addedNodes.length) {
        const length = mutation.addedNodes.length
        for (let i = 0; i < length; i++) {
          const node = mutation.addedNodes[i]
          if (isElement(node)) {
            node.hasAttribute(P_TRIGGER) && addListeners([node], trigger)
            addListeners(Array.from(node.querySelectorAll(`[${P_TRIGGER}]`)), trigger)
          }
        }
      }
    }
  })
  mo.observe(root, {
    attributeFilter: [P_TRIGGER],
    childList: true,
    subtree: true,
  })
  return mo
}
