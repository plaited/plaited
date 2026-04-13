import * as z from 'zod'

import {
  type BPEvent,
  BPEventSchema,
  behavioral,
  type DefaultHandlers,
  type Disconnect,
  isExtension,
  notSchema,
  SNAPSHOT_MESSAGE_KINDS,
  type Trigger,
  useExtension,
  useInstaller,
} from '../../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../bridge-events.ts'
import { keyMirror, ueid } from '../../utils.ts'
import { canUseDOM } from '../render/can-use-dom.ts'
import { BOOLEAN_ATTRS, P_TARGET, P_TRIGGER } from '../render/template.constants.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'
import {
  CONTROLLER_ERRORS,
  SWAP_MODES,
  UI_CORE,
  UI_CORE_EVENTS,
  UI_CORE_MAX_RETRIES,
  UI_CORE_MEMORY_MAX_KEYS,
  UI_CORE_MEMORY_TTL_MS,
  UI_CORE_RETRY_STATUS_CODES,
} from './dom.constants.ts'
import {
  AttrsMessageSchema,
  EventDetailSchema,
  MessageEventDetailSchema,
  RenderMessageSchema,
  type SwapMode,
  UpdateExtensionDetailSchema,
  UserActionDetailSchema,
} from './dom.schemas.ts'

/**
 * Document-level view transition event types exposed as BP event types.
 *
 * @remarks
 * Fired by `controlDocument` when the browser dispatches `pagereveal`
 * or `pageswap` during MPA view transitions.
 *
 * @public
 */
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

const UndefinedDetailSchema = z.undefined()

const isPageReveal = (event: Event): event is PageRevealEvent => event.type === 'pagereveal'
const isPageSwap = (event: Event): event is PageSwapEvent => event.type === 'pageswap'

const toUICoreEventType = (event: string) => `${UI_CORE}:${event}`

const resolveSource = () => {
  const host = document.body?.firstElementChild
  return host ? host.tagName.toLowerCase() : 'document'
}

const bindTriggers = ({
  subtree,
  trigger,
}: {
  subtree: DocumentFragment
  trigger: (event: { type: string; detail?: unknown }) => void
}) => {
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

      const listener = new DelegatedListener((event: Event) => {
        trigger({
          type: toUICoreEventType(UI_CORE_EVENTS.user_action),
          detail: { type, event },
        })
      })
      delegates.set(element, listener)
      element.addEventListener(domEvent, listener)
    }
  }
}

const performSwap = ({
  element,
  html,
  swap,
  trigger,
}: {
  element: Element
  html: string
  swap: SwapMode
  trigger: (event: { type: string; detail?: unknown }) => void
}) => {
  const template = document.createElement('template')
  template.setHTMLUnsafe(html)
  const content = template.content
  bindTriggers({ subtree: content, trigger })

  switch (swap) {
    case SWAP_MODES.afterbegin:
      element.prepend(content)
      break
    case SWAP_MODES.afterend:
      element.after(content)
      break
    case SWAP_MODES.beforebegin:
      element.before(content)
      break
    case SWAP_MODES.beforeend:
      element.append(content)
      break
    case SWAP_MODES.innerHTML:
      element.replaceChildren(content)
      break
    case SWAP_MODES.outerHTML:
      element.replaceWith(content)
      break
  }
}

const updateAttributes = ({
  element,
  attr,
  val,
}: {
  element: Element
  attr: string
  val: string | null | number | boolean
}) => {
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  if (val === null) return
  if (BOOLEAN_ATTRS.has(attr)) {
    !element.hasAttribute(attr) && element.toggleAttribute(attr, true)
    return
  }
  if (element.getAttribute(attr) !== `${val}`) element.setAttribute(attr, `${val}`)
}

/**
 * Document-level behavioral controller for MPA transitions and server-driven UI updates.
 *
 * @public
 */
export const controlDocument = ({ onPageReveal }: { onPageReveal?: PageRevealFactory } = {}) => {
  if (!canUseDOM()) return

  const { trigger, useFeedback, useSnapshot, reportSnapshot, addBThread } = behavioral()
  const installer = useInstaller({
    trigger,
    useSnapshot,
    reportSnapshot,
    addBThread,
    ttlMs: UI_CORE_MEMORY_TTL_MS,
    maxKeys: UI_CORE_MEMORY_MAX_KEYS,
  })

  const source = resolveSource()
  const disconnectSet = new Set<Disconnect>()

  let socket: WebSocket | undefined
  let retryCount = 0

  const send = (message: BPEvent) => {
    const onOpen = () => {
      send(message)
      socket?.removeEventListener('open', onOpen)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
      return
    }
    if (!socket) {
      trigger({ type: toUICoreEventType(UI_CORE_EVENTS.connect) })
    }
    socket?.addEventListener('open', onOpen)
  }

  const socketListener = new DelegatedListener((event: Event) => {
    if (event.type === 'open') {
      retryCount = 0
      return
    }
    if (event instanceof MessageEvent) {
      trigger({
        type: toUICoreEventType(UI_CORE_EVENTS.on_ws_message),
        detail: event,
      })
      return
    }
    if (event instanceof CloseEvent && UI_CORE_RETRY_STATUS_CODES.has(event.code)) {
      trigger({ type: toUICoreEventType(UI_CORE_EVENTS.retry) })
      return
    }
    if (event.type === 'error') {
      trigger({
        type: toUICoreEventType(UI_CORE_EVENTS.on_ws_error),
        detail: event,
      })
    }
  })

  disconnectSet.add(() => socket?.close())
  disconnectSet.add(
    useSnapshot((message) => {
      if (socket?.readyState !== WebSocket.OPEN) return
      socket.send(
        JSON.stringify({
          type: CONTROLLER_TO_AGENT_EVENTS.snapshot,
          detail: {
            id: ueid(),
            source,
            msg: message,
          },
        }),
      )
    }),
  )

  const coreExtension = useExtension(UI_CORE, ({ bThread, bSync }) => {
    bThread({
      label: 'onConnect',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.connect,
            detailSchema: notSchema(UndefinedDetailSchema),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onRetry',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.retry,
            detailSchema: notSchema(UndefinedDetailSchema),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onWsError',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.on_ws_error,
            detailSchema: notSchema(EventDetailSchema),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onWsMessage',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.on_ws_message,
            detailSchema: notSchema(MessageEventDetailSchema),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onUserAction',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.user_action,
            detailSchema: notSchema(UserActionDetailSchema),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onUpdateExtension',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.update_extension,
            detailSchema: notSchema(UpdateExtensionDetailSchema),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onRender',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.render,
            detailSchema: notSchema(RenderMessageSchema.shape.detail),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onAttrs',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.attrs,
            detailSchema: notSchema(AttrsMessageSchema.shape.detail),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onDisconnect',
      rules: [
        bSync({
          block: {
            type: UI_CORE_EVENTS.disconnect,
            detailSchema: notSchema(UndefinedDetailSchema),
          },
        }),
      ],
      repeat: true,
    })

    return {
      [UI_CORE_EVENTS.on_ws_error](detail: Event) {
        const target = detail.target as WebSocket | null
        if (!target) {
          throw new Error('WebSocket error event missing target')
        }
        throw new Error(`WebSocket error on ${target.url} (readyState: ${target.readyState})`)
      },
      [UI_CORE_EVENTS.on_ws_message](detail: MessageEvent) {
        const parsed = BPEventSchema.parse(JSON.parse(String(detail.data)))

        if (parsed.type === AGENT_TO_CONTROLLER_EVENTS.update_behavioral) {
          trigger({
            type: toUICoreEventType(UI_CORE_EVENTS.update_extension),
            detail: parsed.detail,
          })
          return
        }

        if (
          parsed.type === AGENT_TO_CONTROLLER_EVENTS.render ||
          parsed.type === AGENT_TO_CONTROLLER_EVENTS.attrs ||
          parsed.type === AGENT_TO_CONTROLLER_EVENTS.disconnect
        ) {
          trigger({
            type: toUICoreEventType(parsed.type),
            detail: parsed.detail,
          })
          return
        }

        reportSnapshot({
          kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
          id: UI_CORE,
          error: `Dropped unsupported inbound controller event type "${parsed.type}".`,
        })
      },
      [UI_CORE_EVENTS.connect]() {
        socket = new WebSocket(`${self.location.origin.replace(/^http/, 'ws')}/ws`, source)
        delegates.set(socket, socketListener)
        socket.addEventListener('open', socketListener)
        socket.addEventListener('message', socketListener)
        socket.addEventListener('error', socketListener)
        socket.addEventListener('close', socketListener)
      },
      [UI_CORE_EVENTS.retry]() {
        socket = undefined
        if (retryCount >= UI_CORE_MAX_RETRIES) return
        const maxDelay = Math.min(9_999, 1_000 * 2 ** retryCount)
        setTimeout(
          () => trigger({ type: toUICoreEventType(UI_CORE_EVENTS.connect) }),
          Math.floor(Math.random() * maxDelay),
        )
        retryCount++
      },
      [UI_CORE_EVENTS.disconnect]() {
        socket?.close()
        socket = undefined
      },
      [UI_CORE_EVENTS.render](detail: z.infer<typeof RenderMessageSchema.shape.detail>) {
        const element = document.querySelector(`[${P_TARGET}="${detail.target}"]`)
        if (!element) return
        performSwap({
          element,
          html: detail.html,
          swap: detail.swap ?? SWAP_MODES.innerHTML,
          trigger,
        })
      },
      [UI_CORE_EVENTS.attrs](detail: z.infer<typeof AttrsMessageSchema.shape.detail>) {
        const element = document.querySelector(`[${P_TARGET}="${detail.target}"]`)
        if (!element) {
          console.error(CONTROLLER_ERRORS.attrs_element_not_found, detail.target)
          return
        }
        for (const key in detail.attr) {
          updateAttributes({
            element,
            attr: key,
            val: detail.attr[key]!,
          })
        }
      },
      [UI_CORE_EVENTS.user_action](detail: z.infer<typeof UserActionDetailSchema>) {
        send({
          type: CONTROLLER_TO_AGENT_EVENTS.user_action,
          detail: {
            id: ueid(),
            source,
            msg: detail.type,
          },
        })
      },
      async [UI_CORE_EVENTS.update_extension](detail: string) {
        const moduleExports = await import(detail)
        for (const value of Object.values(moduleExports)) {
          if (isExtension(value)) {
            disconnectSet.add(useFeedback(installer(value)))
          }
        }
      },
    }
  })

  disconnectSet.add(useFeedback(installer(coreExtension)))

  const documentListener = new DelegatedListener((event: Event) => {
    if (isPageReveal(event)) {
      trigger({
        type: DOCUMENT_EVENTS.on_pagereveal,
        detail: event.viewTransition,
      })
    }
    if (isPageSwap(event)) {
      trigger({
        type: DOCUMENT_EVENTS.on_pageswap,
        detail: event.viewTransition,
      })
    }
  })

  delegates.set(window, documentListener)
  window.addEventListener('pagereveal', documentListener)
  window.addEventListener('pageswap', documentListener)
  disconnectSet.add(() => {
    window.removeEventListener('pagereveal', documentListener)
    window.removeEventListener('pageswap', documentListener)
  })

  const documentHandlers: DefaultHandlers = {
    [DOCUMENT_EVENTS.on_pageswap]() {
      for (const disconnect of disconnectSet) {
        void disconnect()
      }
      disconnectSet.clear()
    },
  }

  if (onPageReveal) {
    documentHandlers[DOCUMENT_EVENTS.on_pagereveal] = onPageReveal(trigger)
  }

  disconnectSet.add(useFeedback(documentHandlers))

  trigger({ type: toUICoreEventType(UI_CORE_EVENTS.connect) })
}
