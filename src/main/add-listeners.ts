import type { Trigger } from '../behavioral/b-program.js'
import { DelegatedListener, delegates } from '../utils/delegated-listener.js'
import { P_TRIGGER } from '../jsx/jsx.constants.js'

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

/**
 * Sets up delegated event listeners for elements with p-trigger attributes.
 * Handles event delegation and automatic cleanup.
 *
 * @param elements Array of elements to observe
 * @param trigger Event trigger function
 *
 * @example
 * ```ts
 * // Add listeners to elements with p-trigger
 * addListeners(
 *   element.querySelectorAll('[p-trigger]'),
 *   trigger
 * );
 * ```
 *
 * @remarks
 * - Skips nested slots
 * - Creates delegated listeners only once per element
 * - Handles multiple event types per element
 * - Automatically removes invalid event listeners
 */
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
