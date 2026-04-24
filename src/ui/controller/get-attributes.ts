import type { Trigger } from '../../behavioral.ts'
import { DelegatedListener, delegates } from '../../utils.ts'
import { P_TRIGGER } from '../render/template.constants.ts'
import type { BindTriggers } from './controller.types.ts'

const getAttributes = (element: Element): Record<string, string> => {
  return Object.fromEntries(Array.from(element.attributes, (attr) => [attr.name, attr.value]))
}

export const bindTriggers: BindTriggers = (subtree: DocumentFragment, trigger: Trigger) => {
  const elements = subtree.querySelectorAll(`[${P_TRIGGER}]`)
  for (const element of elements) {
    const raw = element.getAttribute(P_TRIGGER)
    if (!raw) continue
    const pairs = raw.split(' ')
    for (const pair of pairs) {
      const separator = pair.indexOf(':')
      if (separator <= 0) continue
      const domEvent = pair.slice(0, separator)
      const type = pair.slice(separator + 1)
      if (!domEvent || !type) continue
      const listener = new DelegatedListener((_: Event) => {
        trigger({
          type,
          detail: getAttributes(element),
        })
      })
      delegates.set(element, listener)
      element.addEventListener(domEvent, listener)
    }
  }
}
