/**
 * Client-side behavioral controller for the generative web UI.
 * Coordinates rendering, user input, and WebSocket lifecycle.
 *
 * @remarks
 * The controller is the only client-side JS beyond Level 2+ thread modules.
 * It manages its own WebSocket connection (with reconnection), receives
 * server messages (render/attrs), applies them to the DOM via
 * `setHTMLUnsafe`, and forwards user actions back to the server.
 *
 * Uses `setHTMLUnsafe` for DOM insertion because:
 * - Declarative shadow DOM (`<template shadowrootmode>`) must be parsed
 * - Safety is enforced server-side by `createTemplate`'s trusted gate
 *
 * Note: Inline `<script>` tags in rendered HTML will NOT execute — the HTML spec
 * marks scripts inserted via parsing APIs as "parser-inserted" and suppresses
 * execution. Use `update_behavioral` + `import(url)` for dynamic code loading.
 *
 * @public
 */
import type { BPEvent, BThreads, Disconnect, Handlers, Trigger, UseFeedback, UseSnapshot } from '../../behavioral.ts'
import { BPEventSchema } from '../../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../bridge-events.ts'
import { ueid } from '../../utils.ts'
import { DelegatedListener, delegates } from '../dom/delegated-listener.ts'
import { BOOLEAN_ATTRS, P_TARGET, P_TRIGGER } from '../render/template.constants.ts'
import { CONTROLLER_ERRORS, SWAP_MODES, WEBSOCKET_LIFECYCLE_EVENTS } from './controller.constants.ts'
import type { ControllerHandlers, SwapMode } from './controller.schemas.ts'
import { UpdateBehavioralModuleSchema, UpdateBehavioralResultSchema } from './controller.schemas.ts'

/** @internal Retry status codes that warrant reconnection attempts. */
const RETRY_STATUS_CODES = new Set([1006, 1012, 1013])

/** @internal Maximum number of reconnection attempts before giving up. */
const MAX_RETRIES = 3

/**
 * @internal
 * Sets up delegated event listeners on elements with p-trigger attributes
 * within a given subtree. Parses the p-trigger value to bind DOM events
 * to the controller's trigger function as userAction events.
 * Called on DocumentFragment before DOM insertion so listeners survive the move.
 *
 * @param subtree - DOM subtree to scan (DocumentFragment)
 * @param trigger - Controller's trigger function for forwarding user actions
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
          type: CONTROLLER_TO_AGENT_EVENTS.user_action,
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
 * @param options.trigger - Controller trigger for binding p-trigger elements before DOM insertion
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
 * Module for creating the client-side behavioral controller.
 *
 * @remarks
 * Wires up WebSocket lifecycle, DOM rendering, and user action forwarding.
 * The controller creates its own WebSocket connection with exponential backoff reconnection.
 *
 * All events originate internally — WebSocket messages and DOM events both use the
 * internal trigger. The `rendered` acknowledgment is triggered after a render completes.
 * `disconnect` arrives from the server via WebSocket to tear down the controller.
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
  useSnapshot,
}: {
  trigger: Trigger
  root: Document | Element
  bThreads: BThreads
  useFeedback: UseFeedback
  disconnectSet: Set<Disconnect>
  useSnapshot: UseSnapshot
}) => {
  const source = root instanceof HTMLElement ? root.tagName.toLowerCase() : 'document'

  // ─── WebSocket lifecycle ───────────────────────────────────────────
  let socket: WebSocket | undefined
  let retryCount = 0

  const send = (message: BPEvent) => {
    const fallback = () => {
      send(message)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      return socket.send(JSON.stringify(message))
    }
    !socket && trigger({ type: WEBSOCKET_LIFECYCLE_EVENTS.connect })
    socket?.addEventListener('open', fallback)
  }

  const callback = (evt: CloseEvent | MessageEvent) => {
    evt instanceof MessageEvent && trigger({ type: WEBSOCKET_LIFECYCLE_EVENTS.on_ws_message, detail: evt })
    if (evt.type === 'open') retryCount = 0
    evt instanceof CloseEvent && RETRY_STATUS_CODES.has(evt.code) && trigger({ type: WEBSOCKET_LIFECYCLE_EVENTS.retry })
    evt.type === 'error' && trigger({ type: WEBSOCKET_LIFECYCLE_EVENTS.on_ws_error, detail: evt })
  }

  disconnectSet.add(
    useSnapshot((detail) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: CONTROLLER_TO_AGENT_EVENTS.snapshot, detail: { id: ueid(), source, msg: detail } }),
        )
      }
    }),
  )
  // ─── Feedback handlers ─────────────────────────────────────────────
  const handlers: Handlers<ControllerHandlers> = {
    [WEBSOCKET_LIFECYCLE_EVENTS.on_ws_error](evt: Event) {
      const target = evt.target as WebSocket
      throw new Error(`WebSocket error on ${target.url} (readyState: ${target.readyState})`)
    },
    [WEBSOCKET_LIFECYCLE_EVENTS.on_ws_message](evt: MessageEvent) {
      const result = BPEventSchema.parse(JSON.parse(evt.data))
      trigger(result)
    },
    [WEBSOCKET_LIFECYCLE_EVENTS.connect]() {
      socket = new WebSocket(`${self.location.origin.replace(/^http/, 'ws')}/ws`, source)
      const listener = new DelegatedListener(callback)
      delegates.set(socket, listener)
      socket.addEventListener('open', listener)
      socket.addEventListener('message', listener)
      socket.addEventListener('error', listener)
      socket.addEventListener('close', listener)
    },
    [WEBSOCKET_LIFECYCLE_EVENTS.retry]() {
      socket = undefined
      if (retryCount < MAX_RETRIES) {
        const max = Math.min(9999, 1000 * 2 ** retryCount)
        setTimeout(() => trigger({ type: WEBSOCKET_LIFECYCLE_EVENTS.connect }), Math.floor(Math.random() * max))
        retryCount++
      }
    },
    [AGENT_TO_CONTROLLER_EVENTS.disconnect]() {
      socket?.close()
    },
    [AGENT_TO_CONTROLLER_EVENTS.render](detail) {
      const el = root.querySelector(`[${P_TARGET}="${detail.target}"]`)
      if (!el) return
      performSwap({ el, html: detail.html, swap: detail.swap ?? SWAP_MODES.innerHTML, trigger })
    },
    [AGENT_TO_CONTROLLER_EVENTS.attrs]({ target, attr }) {
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
    [CONTROLLER_TO_AGENT_EVENTS.user_action]({ type, event }) {
      if (bThreads.has(type)) {
        trigger({
          type,
          detail: event,
        })
      }
      send({ type: CONTROLLER_TO_AGENT_EVENTS.user_action, detail: { id: ueid(), source, msg: type } })
    },
    async [AGENT_TO_CONTROLLER_EVENTS.update_behavioral](detail) {
      const moduleImports = await import(detail)
      const { default: behavioralModule } = UpdateBehavioralModuleSchema.parse(moduleImports)
      const { threads, handlers } = UpdateBehavioralResultSchema.parse(behavioralModule(trigger))
      threads && bThreads.set(threads)
      handlers && disconnectSet.add(useFeedback(handlers))
    },
  }
  disconnectSet.add(useFeedback(handlers))

  trigger({ type: WEBSOCKET_LIFECYCLE_EVENTS.connect })
}
