/**
 * Client-side behavioral shell for the generative web UI.
 * Coordinates rendering, user input, and WebSocket lifecycle.
 *
 * @remarks
 * The shell is the only client-side JS beyond Level 2+ thread modules.
 * It manages its own WebSocket connection (with reconnection), receives
 * server messages (render/attrs), applies them to the DOM via
 * `setHTMLUnsafe`, and forwards user actions back to the server.
 *
 * Uses `setHTMLUnsafe` for DOM insertion because:
 * - Script tags (Level 2+ thread modules) must execute on insertion
 * - Declarative shadow DOM (`<template shadowrootmode>`) must be parsed
 * - Safety is enforced server-side by `createTemplate`'s trusted gate
 *
 * @public
 */
import type { BPEvent, BThreads, Disconnect, Handlers, Trigger, UseFeedback, UseSnapshot } from '../behavioral.ts'
import { BPEventSchema } from '../behavioral.ts'
import { CONTROLLER_ERRORS, CONTROLLER_EVENTS, SWAP_MODES } from './controller.constants.ts'
import type {
  BThreadAddedMessage,
  RootConnectedMessage,
  ShellHandlers,
  SnapshotEvent,
  SwapMode,
  UserActionMessage,
} from './controller.schemas.ts'
import { UpdateBehavioralModuleSchema, UpdateBehavioralResultSchema } from './controller.schemas.ts'
import { BOOLEAN_ATTRS, P_TARGET, P_TRIGGER } from './create-template.constants.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'

/** @internal Retry status codes that warrant reconnection attempts. */
const RETRY_STATUS_CODES = new Set([1006, 1012, 1013])

/** @internal Maximum number of reconnection attempts before giving up. */
const MAX_RETRIES = 3

/**
 * @internal
 * Sets up delegated event listeners on elements with p-trigger attributes
 * within a given subtree. Parses the p-trigger value to bind DOM events
 * to the shell's trigger function as userAction events.
 * Called on DocumentFragment before DOM insertion so listeners survive the move.
 *
 * @param subtree - DOM subtree to scan (DocumentFragment)
 * @param trigger - Shell's trigger function for forwarding user actions
 */
const bindTriggers = (subtree: DocumentFragment, trigger: (event: { type: string; detail?: unknown }) => void) => {
  const els = subtree.querySelectorAll(`[${P_TRIGGER}]`)
  for (const el of els) {
    const raw = el.getAttribute(P_TRIGGER)
    if (!raw) continue
    const pairs = raw.split(' ')
    for (const pair of pairs) {
      const [domEvent, type] = pair.split(':')
      if (!domEvent || !type) continue
      const listener = new DelegatedListener((event: Event) => {
        trigger({
          type: CONTROLLER_EVENTS.user_action,
          detail: {
            type,
            event,
          },
        })
      })
      delegates.set(el, listener)
      el.addEventListener(domEvent, listener)
    }
  }
}

/**
 * @internal
 * Inserts HTML into a target element using `setHTMLUnsafe` via a template element.
 * Binds p-trigger listeners on the DocumentFragment before insertion so they
 * survive the move into the live DOM and the `outerHTML` case works correctly.
 *
 * @param options - Swap configuration
 * @param options.el - Target DOM element
 * @param options.html - Trusted HTML string from the server render pipeline
 * @param options.swap - Insertion mode
 * @param options.trigger - Shell trigger for binding p-trigger elements before DOM insertion
 */
const performSwap = ({
  el,
  html,
  swap,
  trigger,
}: {
  el: Element
  html: string
  swap: SwapMode
  trigger: (event: { type: string; detail?: unknown }) => void
}) => {
  const template = document.createElement('template')
  template.setHTMLUnsafe(html)
  const content = template.content
  bindTriggers(content, trigger)
  switch (swap) {
    case SWAP_MODES.afterbegin:
      el.prepend(content)
      break
    case SWAP_MODES.afterend:
      el.after(content)
      break
    case SWAP_MODES.beforebegin:
      el.before(content)
      break
    case SWAP_MODES.beforeend:
      el.append(content)
      break
    case SWAP_MODES.innerHTML:
      el.replaceChildren(content)
      break
    case SWAP_MODES.outerHTML:
      el.replaceWith(content)
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
  // Remove the attribute if val is null or undefined, and it currently exists
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  // If val is null just return
  if (val === null) return
  // Set the attribute if it is a boolean attribute and it does not exist
  if (BOOLEAN_ATTRS.has(attr)) {
    !element.hasAttribute(attr) && element.toggleAttribute(attr, true)
    return
  }
  // Set the attribute if it doesnot already exist
  if (element.getAttribute(attr) !== `${val}`) element.setAttribute(attr, `${val}`)
}

/**
 * Factory for creating the client-side behavioral shell.
 *
 * @remarks
 * Wires up WebSocket lifecycle, DOM rendering, and user action forwarding.
 * The shell creates its own WebSocket connection with exponential backoff reconnection.
 *
 * All events originate internally — WebSocket messages and DOM events both use the
 * internal trigger. The `rendered` acknowledgment is triggered after a render completes.
 * `disconnect` arrives from the server via WebSocket to tear down the shell.
 * No `publicEvents` are defined — the returned trigger rejects all external calls.
 *
 * @public
 */
export const controller = ({
  trigger,
  root,
  bThreads,
  useFeedback,
  disconnectSet,
  restrictedTrigger,
  useSnapshot,
}: {
  trigger: Trigger
  root: Document | Element
  bThreads: BThreads
  useFeedback: UseFeedback
  disconnectSet: Set<Disconnect>
  restrictedTrigger: Trigger
  useSnapshot: UseSnapshot
}) => {
  // ─── WebSocket lifecycle ───────────────────────────────────────────
  let socket: WebSocket | undefined
  let retryCount = 0

  const send = <T extends BPEvent>(message: T) => {
    const fallback = () => {
      send(message)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      return socket.send(JSON.stringify(message))
    }
    !socket && trigger({ type: CONTROLLER_EVENTS.connect })
    socket?.addEventListener('open', fallback)
  }

  const callback = (evt: CloseEvent | MessageEvent) => {
    evt instanceof MessageEvent && trigger({ type: CONTROLLER_EVENTS.on_ws_message, detail: evt })
    evt.type === 'open' && trigger({ type: CONTROLLER_EVENTS.on_ws_open })
    evt instanceof CloseEvent && RETRY_STATUS_CODES.has(evt.code) && trigger({ type: CONTROLLER_EVENTS.retry })
    evt.type === 'error' && trigger({ type: CONTROLLER_EVENTS.on_ws_error, detail: evt })
  }

  disconnectSet.add(
    useSnapshot((detail) =>
      send<SnapshotEvent>({
        type: CONTROLLER_EVENTS.snapshot,
        detail,
      }),
    ),
  )
  // ─── Feedback handlers ─────────────────────────────────────────────
  const handlers: Handlers<ShellHandlers> = {
    [CONTROLLER_EVENTS.on_ws_error](evt: Event) {
      const target = evt.target as WebSocket
      throw new Error(`WebSocket error on ${target.url} (readyState: ${target.readyState})`)
    },
    [CONTROLLER_EVENTS.on_ws_message](evt: MessageEvent) {
      const result = BPEventSchema.parse(JSON.parse(evt.data))
      restrictedTrigger(result)
    },
    [CONTROLLER_EVENTS.on_ws_open]() {
      retryCount = 0
      send<RootConnectedMessage>({
        type: CONTROLLER_EVENTS.root_connected,
        detail: root instanceof HTMLElement ? root.tagName.toLowerCase() : 'document',
      })
    },
    [CONTROLLER_EVENTS.connect]() {
      socket = new WebSocket(self.location.origin.replace(/^http/, 'ws'))
      const listener = new DelegatedListener(callback)
      delegates.set(socket, listener)
      socket.addEventListener('open', listener)
      socket.addEventListener('message', listener)
      socket.addEventListener('error', listener)
      socket.addEventListener('close', listener)
    },
    [CONTROLLER_EVENTS.retry]() {
      socket = undefined
      if (retryCount < MAX_RETRIES) {
        const max = Math.min(9999, 1000 * 2 ** retryCount)
        setTimeout(() => trigger({ type: CONTROLLER_EVENTS.connect }), Math.floor(Math.random() * max))
        retryCount++
      }
    },
    [CONTROLLER_EVENTS.disconnect]() {
      socket?.close()
    },
    [CONTROLLER_EVENTS.render](detail) {
      const el = root.querySelector(`[${P_TARGET}="${detail.target}"]`)
      if (!el) return
      performSwap({ el, html: detail.html, swap: detail.swap ?? SWAP_MODES.innerHTML, trigger })
    },
    [CONTROLLER_EVENTS.attrs]({ target, attr }) {
      const element = root.querySelector(`[${P_TARGET}="${target}"]`)
      if (!element) return console.error(CONTROLLER_ERRORS.attrs_element_not_found, target)
      for (const key in attr) {
        updateAttributes({
          element,
          attr: key,
          val: attr[key]!,
        })
      }
    },
    [CONTROLLER_EVENTS.user_action]({ type, event }) {
      if (bThreads.has(type)) {
        trigger({
          type,
          detail: event,
        })
      }
      send<UserActionMessage>({ type: CONTROLLER_EVENTS.user_action, detail: type })
    },
    async [CONTROLLER_EVENTS.update_behavioral](detail) {
      const module = await import(detail)
      const { default: factory } = UpdateBehavioralModuleSchema.parse(module)
      const { threads, handlers } = UpdateBehavioralResultSchema.parse(factory(restrictedTrigger))
      threads && bThreads.set(threads)
      handlers && disconnectSet.add(useFeedback(handlers))
      send<BThreadAddedMessage>({
        type: CONTROLLER_EVENTS.behavioral_updated,
        detail: {
          src: detail,
          threads: threads ? Object.keys(threads) : undefined,
          handlers: handlers ? Object.keys(handlers) : undefined,
        },
      })
    },
  }
  disconnectSet.add(useFeedback(handlers))

  trigger({ type: CONTROLLER_EVENTS.connect })
}
