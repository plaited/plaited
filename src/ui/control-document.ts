import { behavioral, type DefaultHandlers, type Disconnect, type Trigger } from '../behavioral.ts'
import { keyMirror } from '../utils.ts'
import { canUseDOM } from './can-use-dom.ts'
import { RESTRICTED_EVENTS } from './controller.constants.ts'
import { controller } from './controller.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'

export const DOCUMENT_EVENTS = keyMirror('on_pagereveal', 'on_pageswap')

// ─── Document Event Message Types ───────────────────────────────────────────

/** @public */
export type OnPageRevealMessage = {
  type: typeof DOCUMENT_EVENTS.on_pagereveal
  detail: ViewTransition
}

/** @public */
export type OnPageSwapMessage = {
  type: typeof DOCUMENT_EVENTS.on_pageswap
  detail: ViewTransition
}

// ─── Derived Handler Type ───────────────────────────────────────────────────

type DocumentEventMessage = OnPageRevealMessage | OnPageSwapMessage

/** @public */
export type BehavioralDocumentEventDetails = {
  [M in DocumentEventMessage as M['type']]: M['detail']
}

/** @public */
export type PageRevealFactory = (trigger: Trigger) => (detail: ViewTransition) => void | Promise<void>

const isPageReveal = (event: Event): event is PageRevealEvent => event.type === 'pagereveal'
const isPageSwap = (event: Event): event is PageSwapEvent => event.type === 'pageswap'

/**
 * Document-level behavioral controller for MPA view transitions.
 *
 * @remarks
 * Creates a BP engine scoped to `document`, wires up the WebSocket controller,
 * and listens for `pageswap`/`pagereveal` view transition events on `window`.
 * The `pageswap` handler always tears down the disconnect set. An optional
 * `onPageReveal` factory receives the restricted trigger and returns the handler
 * for the `on_pagereveal` event. The restricted trigger enforces the same
 * trust boundary as `update_behavioral` — it cannot fire `render`, `attrs`,
 * or `disconnect`.
 *
 * @param options - Configuration options
 * @param options.onPageReveal - Factory that receives restricted trigger and returns the pagereveal handler
 *
 * @public
 */
export const controlDocument = ({ onPageReveal }: { onPageReveal?: PageRevealFactory } = {}) => {
  if (canUseDOM()) {
    const { trigger, useFeedback, bThreads, useRestrictedTrigger, useSnapshot } = behavioral()

    const disconnectSet = new Set<Disconnect>()

    const listener = new DelegatedListener((event: Event) => {
      isPageReveal(event) &&
        trigger({
          type: DOCUMENT_EVENTS.on_pagereveal,
          detail: event.viewTransition,
        })
      isPageSwap(event) &&
        trigger({
          type: DOCUMENT_EVENTS.on_pageswap,
          detail: event.viewTransition,
        })
    })

    delegates.set(window, listener)
    window.addEventListener('pagereveal', listener)
    window.addEventListener('pageswap', listener)

    const restrictedTrigger = useRestrictedTrigger(
      ...Object.values(RESTRICTED_EVENTS),
      ...Object.values(DOCUMENT_EVENTS),
    )

    const handlers: DefaultHandlers = {
      [DOCUMENT_EVENTS.on_pageswap]() {
        for (const cb of disconnectSet) void cb()
        disconnectSet.clear()
      },
    }

    if (onPageReveal) {
      handlers[DOCUMENT_EVENTS.on_pagereveal] = onPageReveal(restrictedTrigger)
    }

    useFeedback(handlers)

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
