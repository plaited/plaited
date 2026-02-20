/**
 * Client-side behavioral shell for the generative web UI.
 * Coordinates rendering, user input, streaming, and WebSocket lifecycle.
 *
 * @remarks
 * The shell is the only client-side JS beyond Level 2+ thread modules.
 * It manages its own WebSocket connection (with reconnection), receives
 * server messages (render/patch/stream), applies them to the DOM via
 * `setHTMLUnsafe`, and forwards user actions back to the server.
 *
 * Uses `setHTMLUnsafe` for DOM insertion because:
 * - Script tags (Level 2+ thread modules) must execute on insertion
 * - Declarative shadow DOM (`<template shadowrootmode>`) must be parsed
 * - Safety is enforced server-side by `createTemplate`'s trusted gate
 *
 * Stream chunks are batched via `requestAnimationFrame` — multiple chunks arriving
 * within the same frame are flushed in a single DOM write.
 *
 * @public
 */

import { useBehavioral } from '../main/use-behavioral.ts'
import type { BPEvent } from '../main.ts'
import { BOOLEAN_ATTRS, P_TRIGGER } from './create-template.constants.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'
import { SHELL_EVENTS } from './shell.constants.ts'
import { BPEventSchema, type ShellHandlers, type StreamMessage, type SwapMode } from './shell.schema.ts'

/**
 * Context required to initialize the shell behavioral program.
 *
 * @remarks
 * The shell creates and manages its own WebSocket connection from the provided URL,
 * including reconnection with exponential backoff.
 * Pass `document` for light DOM or a `ShadowRoot` for shadow-scoped shells.
 * Both implement `ParentNode`, so `querySelector` scopes correctly.
 *
 * @public
 */
export type ShellContext = {
  /** WebSocket endpoint URL for the server connection */
  url: string
  /** DOM scope for querySelector — `document` for light DOM, `ShadowRoot` for shadow-scoped */
  root: Document | ShadowRoot
}

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
      const [domEvent, action] = pair.split(':')
      if (!domEvent || !action) continue
      const listener = new DelegatedListener((_: Event) => {
        trigger({
          type: SHELL_EVENTS.user_action,
          detail: action,
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
    case 'innerHTML':
      el.replaceChildren(content)
      break
    case 'outerHTML':
      el.replaceWith(content)
      break
    case 'beforebegin':
      el.before(content)
      break
    case 'afterbegin':
      el.prepend(content)
      break
    case 'beforeend':
      el.append(content)
      break
    case 'afterend':
      el.after(content)
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
 * Returns an async initializer. Call with a `ShellContext` to start the shell.
 * The shell creates its own WebSocket connection with exponential backoff reconnection.
 *
 * All events originate internally — WebSocket messages and DOM events both use the
 * internal trigger. The `rendered` acknowledgment and `disconnect` lifecycle event
 * are triggered by handlers. No `publicEvents` are defined — the returned trigger
 * rejects all external calls.
 *
 * @public
 */
export const createShell = useBehavioral<ShellHandlers, ShellContext>({
  bProgram({ trigger, url, root, disconnect }) {
    const pendingChunks: StreamMessage['detail'][] = []
    let flushScheduled = false

    // ─── WebSocket lifecycle ───────────────────────────────────────────
    let socket: WebSocket | undefined
    let retryCount = 0

    const ws = {
      callback(evt: CloseEvent | MessageEvent) {
        if (evt instanceof MessageEvent) {
          const result = BPEventSchema.safeParse(JSON.parse(evt.data))
          if (result.success) trigger(result.data)
          else console.error('Shell: invalid message', result.error)
        }
        if (evt.type === 'open') {
          retryCount = 0
        }
        if (evt instanceof CloseEvent && RETRY_STATUS_CODES.has(evt.code)) {
          ws.retry()
        }
        if (evt.type === 'error') {
          console.error('Shell WebSocket error:', evt)
        }
      },
      connect() {
        socket = new WebSocket(url)
        const listener = new DelegatedListener(ws.callback)
        delegates.set(socket, listener)
        socket.addEventListener('open', listener)
        socket.addEventListener('message', listener)
        socket.addEventListener('error', listener)
        socket.addEventListener('close', listener)
      },
      retry() {
        socket = undefined
        if (retryCount < MAX_RETRIES) {
          const max = Math.min(9999, 1000 * 2 ** retryCount)
          setTimeout(ws.connect, Math.floor(Math.random() * max))
          retryCount++
        }
      },
    }

    ws.connect()

    const send = (message: BPEvent) => {
      const fallback = () => {
        send(message)
        socket?.removeEventListener('open', fallback)
      }
      if (socket?.readyState === WebSocket.OPEN) {
        return socket.send(JSON.stringify(message))
      }
      if (!socket) ws.connect()
      socket?.addEventListener('open', fallback)
    }

    // ─── Feedback handlers ─────────────────────────────────────────────
    return {
      [SHELL_EVENTS.disconnect]() {
        disconnect()
        socket?.close()
      },
      [SHELL_EVENTS.render](detail) {
        const el = root.querySelector(`[p-target="${detail.target}"]`)
        if (!el) return
        performSwap({ el, html: detail.html, swap: detail.swap ?? 'innerHTML', trigger })
        trigger({ type: SHELL_EVENTS.rendered, detail: detail.target })
      },

      [SHELL_EVENTS.attrs]({ target, attr }) {
        const element = root.querySelector(`[p-target="${target}"]`)
        if (!element) return trigger({ type: SHELL_EVENTS.attrs_element_not_found, detail: target })
        for (const key in attr) {
          updateAttributes({
            element,
            attr: key,
            val: attr[key]!,
          })
        }
      },

      [SHELL_EVENTS.stream](detail) {
        pendingChunks.push(detail)
        if (!flushScheduled) {
          flushScheduled = true
          requestAnimationFrame(() => {
            for (const chunk of pendingChunks) {
              const el = root.querySelector(`[p-target="${chunk.target}"]`)
              if (!el) {
                trigger({ type: SHELL_EVENTS.stream_element_not_found, detail: chunk.target })
                continue
              }
              performSwap({ el, html: chunk.content, swap: 'beforeend', trigger })
            }
            pendingChunks.length = 0
            flushScheduled = false
          })
        }
      },

      [SHELL_EVENTS.user_action](detail) {
        send({ type: SHELL_EVENTS.user_action, detail })
      },

      [SHELL_EVENTS.rendered](detail) {
        send({ type: SHELL_EVENTS.rendered, detail })
      },
    }
  },
})
