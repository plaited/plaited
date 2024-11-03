import type { Disconnect, Trigger } from '../behavioral/b-program.js'
import { type PlaitedTrigger, isPlaitedTrigger } from './client.types.js'

export type ObsrvedAttributeDetail = {
  oldValue: null | string
  newValue: null | string
  name: string
}

export const useAttributesObserver = (eventType: string, trigger: PlaitedTrigger | Trigger) => {
  return (assignedElement: Element, attributeFilter: string[]) => {
    const mo = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes') {
          const name = mutation.attributeName as string
          const newValue = assignedElement.getAttribute(name)
          trigger<ObsrvedAttributeDetail>({
            type: eventType,
            detail: {
              oldValue: mutation.oldValue,
              name,
              newValue,
            },
          })
        }
      }
    })
    mo.observe(assignedElement, {
      attributeFilter,
      attributeOldValue: true,
    })
    const disconnect: Disconnect = mo.disconnect
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
}
