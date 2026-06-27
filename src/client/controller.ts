import type { BPEvent, Disconnect } from '../behavioral.ts'
import {
  CONTROLLER_TO_SERVER_EVENTS,
  P_FORM_TRIGGER,
  PAGE_EVENTS,
  SERVER_TO_CONTROLLER_EVENTS,
  SWAP_MODES,
} from '../shared/shared.constants.ts'
import {
  type AttrsMessage,
  type ClientMessage,
  type DispatchCustomEventMessage,
  type NavigateMessage,
  type RenderMessage,
  ServerMessageSchema,
} from '../shared/shared.schemas.ts'
import { UI_CORE_MAX_RETRIES, UI_CORE_RETRY_STATUS_CODES } from './controller.constants.ts'
import {
  ElementNotFoundError,
  FormSubmitError,
  PageExtensionError,
  TriggerError,
  WebSocketError,
  WebSocketMessageError,
} from './controller.errors.ts'
import type { ControllerConstructorArgs, ControllerExtension } from './controller.types.ts'
import { DelegatedListener } from './delegated-listener.ts'
import { BOOLEAN_ATTRS, P_FORM, P_TARGET, P_TRIGGER } from './template.constants.ts'

const delegates = new WeakMap<EventTarget, DelegatedListener>()

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

const isPageShow = (event: Event): event is PageTransitionEvent => event.type === PAGE_EVENTS.pageshow
const isPageHide = (event: Event): event is PageTransitionEvent => event.type === PAGE_EVENTS.pagehide
const isPageReveal = (event: Event): event is PageRevealEvent => event instanceof PageRevealEvent
const isPageSwap = (event: Event): event is PageSwapEvent => event instanceof PageSwapEvent
const isSubmit = (event: Event): event is SubmitEvent => event instanceof SubmitEvent

export class Controller {
  constructor({
    agentCardId,
    extensions,
    onPageReveal,
    onPageSwap,
    onPageHide,
    onPageShow,
  }: ControllerConstructorArgs) {
    this.#agentCardId = agentCardId
    this.#extensions = extensions
    this.#onPageHide = onPageHide
    this.#onPageReveal = onPageReveal
    this.#onPageShow = onPageShow
    this.#onPageSwap = onPageSwap
  }
  #agentCardId?: string
  #extensions?: Map<string, ControllerExtension>
  #onPageHide: ControllerConstructorArgs['onPageHide']
  #onPageReveal: ControllerConstructorArgs['onPageReveal']
  #onPageShow: ControllerConstructorArgs['onPageShow']
  #onPageSwap: ControllerConstructorArgs['onPageSwap']
  #disconnectSet = new Set<Disconnect>()
  #messageQueue: string[] = []
  #socket: WebSocket | undefined
  #retryCount = 0
  #socketListener = new DelegatedListener((event: Event) => {
    try {
      const target = event.target
      if (!(target instanceof WebSocket)) {
        throw new WebSocketError(`WebSocket listener received event without WebSocket target`, {
          cause: {
            eventType: event.type,
            socketUrl: target instanceof WebSocket ? target.url : null,
            socketReadyState: target instanceof WebSocket ? target.readyState : null,
          },
        })
      }
      if (target !== this.#socket) return
      if (event.type === 'open') {
        this.#retryCount = 0
        return
      }
      if (event instanceof MessageEvent) {
        this.#webSocketListener(event)
        return
      }
      if (event instanceof CloseEvent && UI_CORE_RETRY_STATUS_CODES.has(event.code)) this.#webSocketRetry()
      if (event.type === 'error') {
        throw new WebSocketError(`WebSocket error on ${target.url} (readyState: ${target.readyState})`, {
          cause: {
            eventType: event.type,
            socketUrl: target instanceof WebSocket ? target.url : null,
            socketReadyState: target instanceof WebSocket ? target.readyState : null,
          },
        })
      }
    } catch (err) {
      const error = err instanceof Error ? err : new WebSocketError('page listener error', { cause: err })
      this.#reportError(error)
    }
  })
  #connectWebSocket() {
    this.#closeWebSocket(this.#socket)
    this.#socket = new WebSocket(self.location.href.replace(/^http/, 'ws'))
    delegates.set(this.#socket, this.#socketListener)
    this.#socket.addEventListener('open', this.#socketListener)
    this.#socket.addEventListener('message', this.#socketListener)
    this.#socket.addEventListener('error', this.#socketListener)
    this.#socket.addEventListener('close', this.#socketListener)
  }
  #addDisconnect(disconnect: Disconnect) {
    this.#disconnectSet.add(disconnect)
  }
  #closeWebSocket(socket?: WebSocket) {
    if (!socket) return
    this.#socket = undefined
    socket.removeEventListener('open', this.#socketListener)
    socket.removeEventListener('message', this.#socketListener)
    socket.removeEventListener('error', this.#socketListener)
    socket.removeEventListener('close', this.#socketListener)
    if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) socket.close()
  }
  #webSocketRetry() {
    this.#closeWebSocket(this.#socket)
    if (this.#retryCount >= UI_CORE_MAX_RETRIES) return
    const maxDelay = Math.min(9_999, 1_000 * 2 ** this.#retryCount)
    setTimeout(() => this.#connectWebSocket(), Math.floor(Math.random() * maxDelay))
    this.#retryCount++
  }
  #send(message: ClientMessage) {
    const onOpen = () => {
      for (const msg of this.#messageQueue) this.#socket?.send(msg)
      this.#messageQueue = []
      this.#socket?.removeEventListener('open', onOpen)
    }
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(message))
      return
    }
    this.#messageQueue.push(JSON.stringify(message))
    if (!this.#socket) this.#connectWebSocket()
    this.#socket?.addEventListener('open', onOpen)
  }
  #sendSnapshot(type: keyof typeof PAGE_EVENTS) {
    this.#send({
      type: CONTROLLER_TO_SERVER_EVENTS.snapshot,
      detail: {
        timeStamp: Date.now(),
        type,
        serializedHTML: document.documentElement.getHTML({ serializableShadowRoots: true }),
        adoptedStyleSheets: [...(cssCache.get(document) ?? [])],
      },
    })
  }
  #reportError(error: Error, id?: string) {
    this.#send({
      type: CONTROLLER_TO_SERVER_EVENTS.error,
      detail: {
        timeStamp: Date.now(),
        id,
        name: error.name,
        error: error.toString(),
        stack: error.stack,
      },
    })
  }
  #trigger(event: BPEvent) {
    this.#send({
      type: CONTROLLER_TO_SERVER_EVENTS.ui_event,
      detail: {
        event,
        timeStamp: Date.now(),
      },
    })
  }
  #bindTriggers(subtree: DocumentFragment | HTMLBodyElement) {
    const elements = subtree.querySelectorAll(`[${P_TRIGGER}]`)
    for (const element of elements) {
      const raw = element.getAttribute(P_TRIGGER)
      if (!raw) continue
      const handlers = new Map<string, (event: Event) => void>()
      for (const pair of raw.split(' ')) {
        const separator = pair.indexOf(':')
        if (separator <= 0) continue

        const domEvent = pair.slice(0, separator)
        const type = pair.slice(separator + 1)
        if (!domEvent || !type) continue
        const handleEvent = (event: Event) => {
          try {
            if (this.#extensions?.has(pair)) {
              const extension = this.#extensions.get(pair)!
              void extension({
                event,
                addDisconnect: this.#addDisconnect.bind(this),
                trigger: this.#trigger.bind(this),
              })
            } else {
              this.#trigger({
                type,
                detail: getAttributes(element),
              })
            }
          } catch (err) {
            const error = err instanceof Error ? err : new TriggerError('trigger error', { cause: err })
            this.#reportError(error)
          }
        }
        handlers.set(domEvent, handleEvent)
      }
      const listener =
        delegates.get(element) ??
        new DelegatedListener((event: Event) => {
          const type = event.type
          const handler = handlers.get(type)
          handler?.(event)
        })
      delegates.set(element, listener)
      for (const type of handlers.keys()) {
        element.addEventListener(type, listener)
      }
    }
  }
  #bindForms(subtree: DocumentFragment | HTMLBodyElement) {
    const elements = subtree.querySelectorAll<HTMLFormElement>(`form[${P_FORM}]`)
    for (const element of elements) {
      const listener =
        delegates.get(element) ??
        new DelegatedListener(async (event: Event) => {
          try {
            if (!isSubmit(event)) return
            event.preventDefault()
            const form = event.currentTarget as HTMLFormElement
            const formData = new FormData(form)
            const response = await fetch(window.location.href, {
              method: 'POST',
              body: formData,
              headers: {
                [P_FORM_TRIGGER]: element.getAttribute(P_FORM)!,
              },
            })
            if (!response.ok) {
              const errorText = await response.text().catch(() => 'No error body details')
              throw new FormSubmitError('Form submission failed with status', {
                cause: {
                  status: response.status,
                  errorText,
                },
              })
            }
          } catch (err) {
            const error =
              err instanceof Error ? err : new FormSubmitError('Form data event handler threw an error', { cause: err })
            this.#reportError(error)
          }
        })
      delegates.set(element, listener)
      element.addEventListener('submit', listener)
    }
  }
  #bind() {
    const body = document.querySelector('body')
    if (body) {
      this.#bindForms(body)
      this.#bindTriggers(body)
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
      const sheet = new CSSStyleSheet()
      const nextSheet = await sheet.replace(styles)
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, nextSheet]
    }
  }
  // Server Message Handlers
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
  #render({ target, html, stylesheets, swap, id }: RenderMessage['detail']) {
    const element = document.querySelector(`[${P_TARGET}="${target}"]`)
    if (!element)
      throw new ElementNotFoundError(`${SERVER_TO_CONTROLLER_EVENTS.render}`, {
        cause: {
          id,
          target,
        },
      })
    void this.#updateDocumentStyles(stylesheets)
    this.#performSwap({
      element,
      html: html,
      swap,
    })
  }
  #attrs({ target, attr, id }: AttrsMessage['detail']) {
    const element = document.querySelector(`[${P_TARGET}="${target}"]`)
    if (!element)
      throw new ElementNotFoundError(`${SERVER_TO_CONTROLLER_EVENTS.attrs}`, {
        cause: {
          id,
          target,
        },
      })
    for (const key in attr) {
      updateAttributes({
        element,
        attr: key,
        val: attr[key]!,
      })
    }
  }
  #dispatchCustomEvent({
    id,
    target,
    event: { type, detail },
    bubbles = false,
    cancelable = true,
    composed = true,
  }: DispatchCustomEventMessage['detail']) {
    const element = document.querySelector(`[${P_TARGET}="${target}"]`)
    if (!element)
      throw new ElementNotFoundError(`${SERVER_TO_CONTROLLER_EVENTS.dispatch_custom_event}`, {
        cause: {
          id,
          target,
        },
      })
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })
    element.dispatchEvent(event)
  }
  #navigate({ url, replace }: NavigateMessage['detail']) {
    replace ? window.location.replace(url) : window.location.assign(url)
  }
  #webSocketListener(message: MessageEvent) {
    let id: string | undefined
    try {
      const raw = JSON.parse(String(message.data))
      const { type, detail } = ServerMessageSchema.parse(raw)
      id = detail.id
      switch (type) {
        case SERVER_TO_CONTROLLER_EVENTS.render: {
          this.#render(detail)
          break
        }
        case SERVER_TO_CONTROLLER_EVENTS.attrs: {
          this.#attrs(detail)
          break
        }
        case SERVER_TO_CONTROLLER_EVENTS.dispatch_custom_event: {
          this.#dispatchCustomEvent(detail)
          break
        }
        case SERVER_TO_CONTROLLER_EVENTS.navigate: {
          this.#navigate(detail)
          break
        }
      }
      this.#send({
        type: CONTROLLER_TO_SERVER_EVENTS.success,
        detail: {
          id,
          timeStamp: Date.now(),
        },
      })
    } catch (err) {
      const error = err instanceof Error ? err : new WebSocketMessageError('web socket listener error', { cause: err })
      this.#reportError(error, id)
    }
  }
  async #pageHideListener(event: PageTransitionEvent) {
    await this.#onPageHide?.({
      event,
      addDisconnect: this.#addDisconnect.bind(this),
      trigger: this.#trigger.bind(this),
    })
    this.#sendSnapshot(PAGE_EVENTS.pagehide)
    this.#disconnect()
  }
  async #pageRevealListener(event: PageRevealEvent) {
    await this.#onPageReveal?.({
      event,
      addDisconnect: this.#addDisconnect.bind(this),
      trigger: this.#trigger.bind(this),
    })
    this.#sendSnapshot(PAGE_EVENTS.pagereveal)
  }
  async #pageShowListener(event: PageTransitionEvent) {
    this.connect()
    await this.#onPageShow?.({
      event,
      addDisconnect: this.#addDisconnect.bind(this),
      trigger: this.#trigger.bind(this),
    })
    this.#sendSnapshot(PAGE_EVENTS.pageshow)
  }
  async #pageSwapListener(event: PageSwapEvent) {
    await this.#onPageSwap?.({
      event,
      addDisconnect: this.#addDisconnect.bind(this),
      trigger: this.#trigger.bind(this),
    })
    this.#sendSnapshot(PAGE_EVENTS.pageswap)
  }
  #connectPage() {
    const listener =
      delegates.get(window) ??
      new DelegatedListener((event: Event) => {
        try {
          isPageHide(event) && void this.#pageHideListener(event)
          isPageReveal(event) && void this.#pageRevealListener(event)
          isPageShow(event) && void this.#pageShowListener(event)
          isPageSwap(event) && void this.#pageSwapListener(event)
        } catch (err) {
          const error = err instanceof Error ? err : new PageExtensionError('page listener error', { cause: err })
          this.#reportError(error)
        }
      })
    window.addEventListener(PAGE_EVENTS.pagehide, listener)
    window.addEventListener(PAGE_EVENTS.pagereveal, listener)
    window.addEventListener(PAGE_EVENTS.pageshow, listener)
    window.addEventListener(PAGE_EVENTS.pageswap, listener)
    const disconnect = () => {
      window.removeEventListener(PAGE_EVENTS.pagehide, listener)
      window.removeEventListener(PAGE_EVENTS.pagereveal, listener)
      window.removeEventListener(PAGE_EVENTS.pageshow, listener)
      window.removeEventListener(PAGE_EVENTS.pageswap, listener)
    }
    this.#addDisconnect(disconnect)
  }
  connect() {
    this.#connectPage()
    this.#connectWebSocket()
    this.#bind()
  }
  #disconnect() {
    for (const cb of this.#disconnectSet) void cb()
    this.#disconnectSet.clear()
    this.#closeWebSocket(this.#socket)
  }
}
