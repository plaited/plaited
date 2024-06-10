import type { Trigger } from '../types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { bpTrigger } from '../jsx/constants.js'

const isElement = (node: Node): node is Element => node.nodeType === 1

const getTriggerMap = (el: Element) =>
  new Map((el.getAttribute(bpTrigger) as string).split(' ').map((pair) => pair.split(':')) as [string, string][])

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
      const triggerType = el.getAttribute(bpTrigger) && getTriggerType(event, el)
      triggerType ?
        /** if key is present in `bp-trigger` trigger event on instance's bProgram */
        trigger?.({ type: triggerType, detail: event })
      : /** if key is not present in `bp-trigger` remove event listener for this event on Element */
        el.removeEventListener(event.type, delegates.get(el))
    }),
  )
}

/** add delegated event listeners  for elements in list */
export const addListeners = (elements: Element[], trigger: Trigger) => {
  for (const el of elements) {
    if (el.tagName === 'SLOT' && el.hasAttribute('slot')) continue // skip nested slots
    !delegates.has(el) && createDelegatedListener(el, trigger) // bind a callback for element if we haven't already
    for (const [event] of getTriggerMap(el)) {
      // add event listeners for each event type
      el.addEventListener(event, delegates.get(el))
    }
  }
}

export const shadowObserver = (root: ShadowRoot, trigger: Trigger) => {
  /**  Observes the addition of nodes to the shadow dom and changes to and child's bp-trigger attribute */
  const mo = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'attributes') {
        const el = mutation.target
        if (isElement(el)) {
          mutation.attributeName === bpTrigger && el.getAttribute(bpTrigger) && addListeners([el], trigger)
        }
      } else if (mutation.addedNodes.length) {
        const length = mutation.addedNodes.length
        for (let i = 0; i < length; i++) {
          const node = mutation.addedNodes[i]
          if (isElement(node)) {
            node.hasAttribute(bpTrigger) && addListeners([node], trigger)
            addListeners(Array.from(node.querySelectorAll(`[${bpTrigger}]`)), trigger)
          }
        }
      }
    }
  })
  mo.observe(root, {
    attributeFilter: [bpTrigger],
    childList: true,
    subtree: true,
  })
  return mo
}
