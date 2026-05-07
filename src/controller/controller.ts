import type { BPEvent, Disconnect, JsonObject } from '../behavioral.ts'
import { BOOLEAN_ATTRS, P_CONNECT, P_TARGET, P_TOPIC, P_TRIGGER } from '../render/template.constants.ts'
import type { CustomElementTag } from '../render/template.types.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../shared/shared.constants.ts'
import { isTypeOf } from '../utils.ts'
import {
  CONTROLLER_ERRORS,
  SWAP_MODES,
  UI_CORE_MAX_RETRIES,
  UI_CORE_RETRY_STATUS_CODES,
} from './controller.constants.ts'
import {
  AttrsMessageSchema,
  type ClientMessage,
  type ControllerErrorMessage,
  ControllerModuleDefaultSchema,
  type FormSubmitMessage,
  ImportModuleSchema,
  RenderMessageSchema,
  ServerMessageEnvelopeSchema,
  type SwapMode,
} from './controller.schemas.ts'
import { normalizeControllerErrorDetail } from './controller-error-detail.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'

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

type ControllerErrorMetadata = {
  kind?: string
  context?: JsonObject
}

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

const ControllerHTMLElement: typeof HTMLElement =
  globalThis.HTMLElement ?? (class ControllerHTMLElementFallback {} as typeof HTMLElement)

export class Controller extends ControllerHTMLElement {
  static observedAttributes = [P_TOPIC, P_CONNECT]
  #address: string | null = null
  #disconnectSet = new Set<Disconnect>()
  #socket: WebSocket | undefined
  #socketTopic: string | null = null
  #retryCount = 0
  #socketListener = new DelegatedListener((event: Event) => {
    try {
      const target = event.target
      if (!(target instanceof WebSocket)) {
        throw new Error(`WebSocket listener received event without WebSocket target`)
      }
      if (target !== this.#socket) return
      if (event.type === 'open') {
        this.#retryCount = 0
        return
      }
      if (event instanceof MessageEvent) this.#onWsMessage(event)
      if (event instanceof CloseEvent && UI_CORE_RETRY_STATUS_CODES.has(event.code)) this.#onRetry()
      if (event.type === 'error') {
        throw new Error(`WebSocket error on ${target.url} (readyState: ${target.readyState})`)
      }
    } catch (error) {
      const target = event.target
      this.#reportError(error, {
        kind: 'socket_listener_error',
        context: {
          eventType: event.type,
          socketTopic: this.#socketTopic ?? null,
          socketUrl: target instanceof WebSocket ? target.url : null,
          socketReadyState: target instanceof WebSocket ? target.readyState : null,
        },
      })
    }
  })
  #formListener = new DelegatedListener((event: Event) => {
    try {
      const owner = event.composedPath().find((node): node is Controller => node instanceof Controller)
      if (owner !== this) return

      const form = event.target
      if (!(form instanceof HTMLFormElement)) return

      event.preventDefault()
      this.#sendFormSubmit(form)
    } catch (error) {
      this.#reportError(error, { kind: 'form_submit_error' })
    }
  })
  #registry = new CustomElementRegistry()
  #register(tags: CustomElementTag[]) {
    for (const tag of tags) {
      if (!this.#registry.get(tag)) this.#registry.define(tag, Controller)
    }
  }
  #connect() {
    this.#closeSocket(this.#socket)
    this.#socketTopic = this.getAttribute(P_TOPIC)
    this.#address = this.getAttribute(P_CONNECT)
    if (!isTypeOf<string>(this.#socketTopic, 'string')) return
    this.#socket = new WebSocket(
      this.#address ?? `${self.location.origin.replace(/^http/, 'ws')}/ws`,
      this.#socketTopic,
    )
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
  #addDisconnect(disconnect: Disconnect) {
    this.#disconnectSet.add(disconnect)
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
  #reportError(error: unknown, metadata: ControllerErrorMetadata = {}) {
    const event: ControllerErrorMessage = {
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: normalizeControllerErrorDetail({
        error,
        kind: metadata.kind,
        context: metadata.context,
      }),
    }
    this.#send(event)
  }
  #trigger(message: BPEvent) {
    const event = { type: CONTROLLER_TO_AGENT_EVENTS.ui_event, detail: message }
    this.#send(event)
  }
  #sendFormSubmit(form: HTMLFormElement) {
    const event: FormSubmitMessage = {
      type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
      detail: {
        id: form.id || null,
        action: form.action || null,
        method: form.method || 'get',
        data: buildFormSubmitData(form),
      },
    }
    this.#send(event)
  }
  async #importModule(path: string) {
    const modules = await import(path)
    const setup = ControllerModuleDefaultSchema.parse(modules.default)
    await setup({
      DelegatedListener,
      delegates,
      addDisconnect: this.#addDisconnect.bind(this),
      trigger: this.#trigger.bind(this),
    })
    this.#trigger({ type: CONTROLLER_TO_AGENT_EVENTS.import_invoked, detail: { path } })
  }
  #bindTriggers = (subtree: DocumentFragment) => {
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
  async #updateDocumentStyles(stylesheets: string[]) {
    const root = this.ownerDocument
    let instanceStyles = cssCache.get(root)
    if (!instanceStyles) {
      instanceStyles = new Set()
      cssCache.set(root, instanceStyles)
    }
    for (const styles of stylesheets) {
      if (instanceStyles.has(styles)) continue
      instanceStyles.add(styles)
      try {
        const sheet = new CSSStyleSheet()
        const nextSheet = await sheet.replace(styles)
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, nextSheet]
      } catch (error) {
        instanceStyles.delete(styles)
        this.#reportError(error, {
          kind: 'stylesheet_error',
          context: {
            stylesheetLength: styles.length,
            stylesheetPreview: styles.slice(0, 120),
          },
        })
      }
    }
  }
  #performSwap({ element, html, swap }: { element: Element; html: string; swap: SwapMode }) {
    const template = document.createElement('template')
    template.setHTMLUnsafe(html)
    const content = template.content

    this.#registry.initialize(content)
    this.#bindTriggers(content)

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
      const { type, detail } = ServerMessageEnvelopeSchema.parse(JSON.parse(String(message.data)))
      switch (type) {
        case AGENT_TO_CONTROLLER_EVENTS.import: {
          const path = ImportModuleSchema.shape.detail.parse(detail)
          void this.#importModule(path).catch((error) =>
            this.#reportError(error, {
              kind: 'module_import_error',
              context: { path },
            }),
          )
          break
        }
        case AGENT_TO_CONTROLLER_EVENTS.render: {
          const { target, html, swap, registry, stylesheets } = RenderMessageSchema.shape.detail.parse(detail)
          const element = this.querySelector(`[${P_TARGET}="${target}"]`)
          if (!element) return
          void this.#updateDocumentStyles(stylesheets)
          this.#register(registry)
          this.#performSwap({
            element,
            html: html,
            swap: swap ?? SWAP_MODES.innerHTML,
          })
          break
        }
        case AGENT_TO_CONTROLLER_EVENTS.attrs: {
          const { target, attr } = AttrsMessageSchema.shape.detail.parse(detail)
          const element = this.querySelector(`[${P_TARGET}="${target}"]`)
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
        case AGENT_TO_CONTROLLER_EVENTS.disconnect: {
          this.#closeSocket()
          break
        }
        default: {
          throw new Error(`Unsupported controller event type "${type}"`)
        }
      }
    } catch (error) {
      this.#reportError(error, {
        kind: 'server_message_error',
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
  attributeChangedCallback() {
    this.#connect()
  }
  adoptedCallback() {
    this.#connect()
  }
  connectedCallback() {
    this.#socketTopic = this.getAttribute(P_TOPIC)
    this.#address = this.getAttribute(P_CONNECT)
    delegates.set(this, this.#socketListener)
    this.addEventListener('submit', this.#formListener)
    this.#connect()
  }
  disconnectedCallback() {
    this.removeEventListener('submit', this.#formListener)
    for (const cb of this.#disconnectSet) void cb()
    this.#disconnectSet.clear()
    this.#closeSocket(this.#socket)
  }
}
