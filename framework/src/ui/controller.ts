import type { BPEvent, Disconnect, JsonObject } from '../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS, SWAP_MODES } from '../shared/shared.constants.ts'
import {
  type A2AResultMessage,
  type A2ATaskMessage,
  AttrsMessageSchema,
  type ClientMessage,
  type ControllerErrorMessage,
  type FormSubmitMessage,
  RenderMessageSchema,
  ServerMessageSchema,
  type UiEventMessage,
} from '../shared/shared.schemas.ts'
import { isTypeOf } from '../utils.ts'
import {
  CONTROLLER_ERRORS,
  CONTROLLER_EVENTS,
  PAGE_EVENTS,
  UI_CORE_MAX_RETRIES,
  UI_CORE_RETRY_STATUS_CODES,
} from './controller.constants.ts'
import { normalizeControllerErrorDetail } from './controller-error-detail.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'
import { BOOLEAN_ATTRS, O_TARGET, O_TRIGGER } from './template.constants.ts'

const getAttributes = (element: Element): Record<string, string> => {
  return Object.fromEntries(Array.from(element.attributes, (attr) => [attr.name, attr.value]))
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

const cssCache = new WeakMap<Document, Set<string>>()

const stringifyUnknown = (value: unknown): string => {
  if (isTypeOf<string>(value, 'string')) return value
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

type FormSubmitFieldValue = FormSubmitMessage['detail']['data'][string]

const normalizeFormFieldValue = (value: FormDataEntryValue): string => {
  return value instanceof File ? value.name : value
}

const buildFormSubmitData = (form: HTMLFormElement): Record<string, FormSubmitFieldValue> => {
  const data: Record<string, FormSubmitFieldValue> = {}
  for (const [key, value] of new FormData(form).entries()) {
    const next = normalizeFormFieldValue(value)
    const previous = data[key]
    if (previous === undefined) {
      data[key] = next
      continue
    }
    data[key] = Array.isArray(previous) ? [...previous, next] : [previous, next]
  }
  return data
}

const isPageShow = (event: Event): event is PageTransitionEvent => event.type === PAGE_EVENTS.pageshow
const isPageHide = (event: Event): event is PageTransitionEvent => event.type === PAGE_EVENTS.pagehide
const isPageReveal = (event: Event): event is PageRevealEvent => event instanceof PageRevealEvent
const isPageSwap = (event: Event): event is PageSwapEvent => event instanceof PageSwapEvent

export type Register = (args: {
  DelegatedListener: typeof DelegatedListener
  delegates: WeakMap<EventTarget, unknown>
  addDisconnect: (disconnect: Disconnect) => void
  trigger: (event: BPEvent) => void
  reportError: (
    error: unknown,
    metadata?: {
      description?: string
      context?: JsonObject
    },
  ) => void
}) => void | Promise<void>

export const useController = ({
  registry = [],
  agentCardId,
  onPageReveal,
  onPageSwap,
  onPageHide,
  onPageShow,
}: {
  registry?: Register[]
  /**
   * Optional id of a `<script type="application/agent+json">` element in
   * the page HTML. When set, the controller reads the Agent Card from
   * that script tag and registers it with the Flutter bridge via
   * `agent/card` postMessage.
   */
  agentCardId?: string
  onPageReveal?: (event: PageRevealEvent) => void | Promise<void>
  onPageSwap?: (event: PageSwapEvent) => void | Promise<void>
  onPageShow?: (event: PageTransitionEvent) => void | Promise<void>
  onPageHide?: (event: PageTransitionEvent) => void | Promise<void>
}) => {
  class Controller {
    #disconnectSet = new Set<Disconnect>()
    #socket: WebSocket | undefined
    #retryCount = 0
    /**
     * Message handler for incoming JSON-RPC 2.0 messages from the
     * Flutter bridge. Receives `task/send` requests and routes them
     * to the behavioral engine as `a2a_task` WebSocket events.
     */
    #a2aMessageHandler: ((event: MessageEvent) => void) | undefined
    /**
     * The `name` from the page's Agent Card, tracked so the controller
     * can send `agent/withdraw` on disconnect.
     */
    #a2aRegisteredName: string | undefined
    #socketListener = new DelegatedListener((event: Event) => {
      try {
        const target = event.target
        if (!(target instanceof WebSocket)) {
          throw new Error(`WebSocket listener received event without WebSocket target`)
        }
        if (target !== this.#socket) return
        if (event.type === 'open') {
          this.#retryCount = 0
          this.#sendConnected()
          return
        }
        if (event instanceof MessageEvent) {
          this.#onWsMessage(event)
          return
        }
        if (event instanceof CloseEvent && UI_CORE_RETRY_STATUS_CODES.has(event.code)) this.#onRetry()
        if (event.type === 'error') {
          throw new Error(`WebSocket error on ${target.url} (readyState: ${target.readyState})`)
        }
      } catch (error) {
        const target = event.target
        this.#reportError(error, {
          description: 'Socket listener event handler threw an error',
          context: {
            eventType: event.type,
            socketUrl: target instanceof WebSocket ? target.url : null,
            socketReadyState: target instanceof WebSocket ? target.readyState : null,
          },
        })
      }
    })
    #connect() {
      this.#closeSocket(this.#socket)
      this.#socket = new WebSocket(self.location.href.replace(/^http/, 'ws'))
      delegates.set(this.#socket, this.#socketListener)
      this.#socket.addEventListener('open', this.#socketListener)
      this.#socket.addEventListener('message', this.#socketListener)
      this.#socket.addEventListener('error', this.#socketListener)
      this.#socket.addEventListener('close', this.#socketListener)
    }
    #closeSocket(socket?: WebSocket) {
      if (!socket) return
      this.#socket = undefined
      socket.removeEventListener('open', this.#socketListener)
      socket.removeEventListener('message', this.#socketListener)
      socket.removeEventListener('error', this.#socketListener)
      socket.removeEventListener('close', this.#socketListener)
      if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) socket.close()
    }
    #send(message: ClientMessage) {
      const onOpen = () => {
        this.#send(message)
        this.#socket?.removeEventListener('open', onOpen)
      }
      if (this.#socket?.readyState === WebSocket.OPEN) {
        this.#socket.send(JSON.stringify(message))
        return
      }
      if (this.#socket?.readyState === WebSocket.CLOSING || this.#socket?.readyState === WebSocket.CLOSED) {
        this.#closeSocket(this.#socket)
      }
      if (!this.#socket) this.#connect()
      this.#socket?.addEventListener('open', onOpen)
    }
    #reportError(
      error: unknown,
      metadata: {
        description?: string
        context?: JsonObject
      } = {},
    ) {
      const message: ControllerErrorMessage = {
        type: CONTROLLER_TO_AGENT_EVENTS.error,
        detail: {
          ...normalizeControllerErrorDetail({
            error,
            description: metadata.description,
            context: metadata.context,
          }),
        },
      }
      this.#send(message)
    }
    #sendConnected() {
      this.#trigger({
        type: CONTROLLER_EVENTS.controller_connected,
        detail: {
          timestamp: Date.now(),
        },
      })
    }
    #trigger(event: BPEvent) {
      const message: UiEventMessage = {
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
        detail: {
          event,
        },
      }
      this.#send(message)
    }
    #sendFormSubmit(form: HTMLFormElement) {
      const message: FormSubmitMessage = {
        type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
        detail: {
          id: form.id || null,
          action: form.action || null,
          method: form.method || 'get',
          data: buildFormSubmitData(form),
        },
      }
      this.#send(message)
    }
    #bindTriggers = (subtree: DocumentFragment) => {
      const elements = subtree.querySelectorAll(`[${O_TRIGGER}]`)
      for (const element of elements) {
        const raw = element.getAttribute(O_TRIGGER)
        if (!raw) continue

        const pairs = raw.split(' ')
        for (const pair of pairs) {
          const separator = pair.indexOf(':')
          if (separator <= 0) continue

          const domEvent = pair.slice(0, separator)
          const type = pair.slice(separator + 1)
          if (!domEvent || !type) continue

          const listener = new DelegatedListener((_: Event) => {
            this.#trigger({
              type,
              detail: getAttributes(element),
            })
          })
          delegates.set(element, listener)
          element.addEventListener(domEvent, listener)
        }
      }
    }
    #bindForms = (subtree: DocumentFragment) => {
      const elements = subtree.querySelectorAll('form')
      for (const element of elements) {
        const listener = new DelegatedListener((event: Event) => {
          try {
            event.preventDefault()
            this.#sendFormSubmit(element)
          } catch (error) {
            this.#reportError(error, { description: 'Form submit event handler threw an error' })
          }
        })
        delegates.set(element, listener)
        element.addEventListener('submit', listener)
      }
    }
    async #updateDocumentStyles(stylesheets: string[]) {
      let instanceStyles = cssCache.get(document)
      if (!instanceStyles) {
        instanceStyles = new Set()
        cssCache.set(document, instanceStyles)
      }
      for (const styles of stylesheets) {
        if (instanceStyles.has(styles)) continue
        instanceStyles.add(styles)
        try {
          const sheet = new CSSStyleSheet()
          const nextSheet = await sheet.replace(styles)
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, nextSheet]
        } catch (error) {
          instanceStyles.delete(styles)
          this.#reportError(error, {
            description: 'CSSStyleSheet replacement or adoption failed',
            context: {
              stylesheetLength: styles.length,
              stylesheetPreview: styles.slice(0, 120),
            },
          })
        }
      }
    }
    #performSwap({ element, html, swap }: { element: Element; html: string; swap: keyof typeof SWAP_MODES }) {
      const template = document.createElement('template')
      template.setHTMLUnsafe(html)
      const content = template.content
      this.#bindTriggers(content)
      this.#bindForms(content)
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
    #onWsMessage(message: MessageEvent) {
      try {
        const raw = JSON.parse(String(message.data))
        const parsed = ServerMessageSchema.safeParse(raw)
        if (!parsed.success) {
          const zodError = parsed.error
          const isInvalidType = zodError.issues.length === 1 && zodError.issues[0]?.code === 'invalid_union'
          if (isInvalidType) {
            throw new Error(`Unsupported controller event type "${raw.type}"`)
          }
          throw zodError
        }
        const { type, detail } = parsed.data
        switch (type) {
          case AGENT_TO_CONTROLLER_EVENTS.render: {
            const { target, html, swap, stylesheets } = RenderMessageSchema.shape.detail.parse(detail)
            const element = document.querySelector(`[${O_TARGET}="${target}"]`)
            if (!element) return
            void this.#updateDocumentStyles(stylesheets)
            this.#performSwap({
              element,
              html: html,
              swap: swap ?? SWAP_MODES.innerHTML,
            })
            break
          }
          case AGENT_TO_CONTROLLER_EVENTS.attrs: {
            const { target, attr } = AttrsMessageSchema.shape.detail.parse(detail)
            const element = document.querySelector(`[${O_TARGET}="${target}"]`)
            if (!element) {
              console.error(CONTROLLER_ERRORS.attrs_element_not_found, target)
              return
            }
            for (const key in attr) {
              updateAttributes({
                element,
                attr: key,
                val: attr[key]!,
              })
            }
            break
          }
          case AGENT_TO_CONTROLLER_EVENTS.a2a_result: {
            this.#onA2AResult(detail)
            break
          }
        }
      } catch (error) {
        this.#reportError(error, {
          description: 'Failed to parse or handle server message',
          context: { rawMessage: stringifyUnknown(message.data) },
        })
      }
    }
    #onRetry() {
      this.#closeSocket(this.#socket)
      if (this.#retryCount >= UI_CORE_MAX_RETRIES) return
      const maxDelay = Math.min(9_999, 1_000 * 2 ** this.#retryCount)
      setTimeout(() => this.#connect(), Math.floor(Math.random() * maxDelay))
      this.#retryCount++
    }
    #onA2AResult(detail: A2AResultMessage['detail']) {
      const { taskId, state, parts } = detail
      const update: { jsonrpc: string; method: string; params: Record<string, unknown> } = {
        jsonrpc: '2.0',
        method: 'task/update',
        params: { id: taskId, state },
      }
      if (parts) {
        update.params.artifact = { parts }
      }
      window.postMessage(JSON.stringify(update), self.origin)
    }
    #readAgentCard(): Record<string, unknown> | undefined {
      if (!agentCardId) return
      const script = self.document.getElementById(agentCardId)
      if (!script?.textContent) return
      try {
        return JSON.parse(script.textContent)
      } catch {
        return
      }
    }
    #registerAgent(card: Record<string, unknown>) {
      this.#a2aRegisteredName = (card as { name?: string }).name
      window.postMessage(JSON.stringify({ jsonrpc: '2.0', method: 'agent/card', params: card }), self.origin)
    }
    #withdrawAgent() {
      if (!this.#a2aRegisteredName) return
      window.postMessage(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'agent/withdraw',
          params: { name: this.#a2aRegisteredName },
        }),
        self.origin,
      )
      this.#a2aRegisteredName = undefined
    }
    #addDisconnect(disconnect: Disconnect) {
      this.#disconnectSet.add(disconnect)
    }
    async #onPageHide(event: PageTransitionEvent) {
      await onPageHide?.(event)
      this.#disconnect()
    }
    async #onPageReveal(event: PageRevealEvent) {
      await onPageReveal?.(event)
    }
    async #onPageShow(event: PageTransitionEvent) {
      await onPageShow?.(event)
    }
    async #onPageSwap(event: PageSwapEvent) {
      await onPageSwap?.(event)
    }
    connect() {
      const listener = new DelegatedListener((event: Event) => {
        isPageHide(event) && this.#onPageHide(event)
        isPageReveal(event) && this.#onPageReveal(event)
        isPageShow(event) && this.#onPageShow(event)
        isPageSwap(event) && this.#onPageSwap(event)
      })
      delegates.set(window, listener)
      window.addEventListener(PAGE_EVENTS.pagehide, listener)
      window.addEventListener(PAGE_EVENTS.pagereveal, listener)
      window.addEventListener(PAGE_EVENTS.pageshow, listener)
      window.addEventListener(PAGE_EVENTS.pageswap, listener)
      this.#connect()

      // Set up A2A: listen for incoming tasks from the Flutter bridge
      this.#a2aMessageHandler = (event: MessageEvent) => {
        if (event.origin !== self.origin) return
        if (typeof event.data !== 'string') return
        try {
          const msg = JSON.parse(event.data)
          if (msg?.method === 'task/send' && msg?.params) {
            const { id, skill, message } = msg.params
            this.#send({
              type: CONTROLLER_TO_AGENT_EVENTS.a2a_task,
              detail: {
                taskId: id,
                skill,
                message: { role: message?.role ?? 'user', parts: message?.parts ?? [{ data: {} }] },
              },
            } as A2ATaskMessage)
          }
        } catch {
          // ignore malformed messages
        }
      }
      window.addEventListener('message', this.#a2aMessageHandler)

      // Register agent card with the Flutter bridge
      const card = this.#readAgentCard()
      if (card) this.#registerAgent(card)

      for (const register of registry) {
        try {
          void register({
            DelegatedListener,
            delegates,
            addDisconnect: this.#addDisconnect.bind(this),
            trigger: this.#trigger.bind(this),
            reportError: this.#reportError.bind(this),
          })
        } catch (error) {
          this.#reportError(error, {
            description: 'Register callback threw an error',
            context: { registerType: typeof register },
          })
        }
      }
    }
    #disconnect() {
      this.#withdrawAgent()
      if (this.#a2aMessageHandler) {
        window.removeEventListener('message', this.#a2aMessageHandler)
        this.#a2aMessageHandler = undefined
      }
      for (const cb of this.#disconnectSet) void cb()
      this.#disconnectSet.clear()
      this.#closeSocket(this.#socket)
    }
  }
  const controller = new Controller()
  controller.connect()
}
