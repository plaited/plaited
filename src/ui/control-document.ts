import { behavioral, type DefaultHandlers, type Disconnect } from '../main.ts'
import { canUseDOM } from '../utils.ts'
import { CONTROLLER_EVENTS } from './controller.constants.ts'
import { controller } from './controller.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'

export const controlDocument = () => {
  if (canUseDOM()) {
    const { trigger, useFeedback, bThreads, useRestrictedTrigger, useSnapshot } = behavioral()

    const disconnectSet = new Set<Disconnect>()

    const listener = new DelegatedListener((event: Event) => {
      event.type === 'pagereveal' && trigger({ type: CONTROLLER_EVENTS.on_pagereveal, detail: Event })
      event.type === 'pageswap' && trigger({ type: CONTROLLER_EVENTS.on_pageswap, detail: Event })
    })

    delegates.set(document, listener)
    document.addEventListener('pagereveal', listener)
    document.addEventListener('pageswap', listener)

    const handlers: DefaultHandlers = {
      [CONTROLLER_EVENTS.on_pageswap]() {
        for (const cb of disconnectSet) void cb()
        disconnectSet.clear()
      },
    }

    useFeedback(handlers)

    controller({
      root: document,
      trigger,
      bThreads,
      useFeedback,
      disconnectSet,
      useRestrictedTrigger,
      useSnapshot,
    })
  }
}
