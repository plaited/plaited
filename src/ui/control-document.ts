import { behavioral, type DefaultHandlers, type Disconnect } from '../behavioral.ts'
import { canUseDOM, keyMirror } from '../utils.ts'
import { RESTRICTED_EVENTS } from './controller.constants.ts'
import { controller } from './controller.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'

const DOCUMENT_RESTRICTED_EVENTS = keyMirror(
  //Document lifecycle
  'on_pagereveal',
  'on_pageswap',
)

export const controlDocument = () => {
  if (canUseDOM()) {
    const { trigger, useFeedback, bThreads, useRestrictedTrigger, useSnapshot } = behavioral()

    const disconnectSet = new Set<Disconnect>()

    const listener = new DelegatedListener((event: Event) => {
      event.type === 'pagereveal' && trigger({ type: DOCUMENT_RESTRICTED_EVENTS.on_pagereveal, detail: Event })
      event.type === 'pageswap' && trigger({ type: DOCUMENT_RESTRICTED_EVENTS.on_pageswap, detail: Event })
    })

    delegates.set(document, listener)
    document.addEventListener('pagereveal', listener)
    document.addEventListener('pageswap', listener)

    const handlers: DefaultHandlers = {
      [DOCUMENT_RESTRICTED_EVENTS.on_pageswap]() {
        for (const cb of disconnectSet) void cb()
        disconnectSet.clear()
      },
    }

    useFeedback(handlers)

    const restrictedTrigger = useRestrictedTrigger(
      ...Object.values(RESTRICTED_EVENTS),
      ...Object.values(DOCUMENT_RESTRICTED_EVENTS),
    )
    controller({
      root: document,
      trigger,
      bThreads,
      useFeedback,
      disconnectSet,
      restrictedTrigger,
      useSnapshot,
    })
  }
}
