import { type BPEvent, BPEventSchema, type Disconnect, type Trigger } from '../../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../bridge-events.ts'
import { isTypeOf } from '../../utils.ts'
import { createStyles } from '../css/styles.ts'
import { canUseDOM } from '../render/can-use-dom.ts'
import { BOOLEAN_ATTRS, P_TARGET, P_TOPIC, P_TRIGGER } from '../render/template.constants.ts'
import { createTemplate, Fragment } from '../render/template.ts'
import type { CustomElementTag, ElementAttributeList, FunctionTemplate } from '../render/template.types.ts'
import {
  CONTROLLER_ERRORS,
  SWAP_MODES,
  UI_CORE_MAX_RETRIES,
  UI_CORE_RETRY_STATUS_CODES,
} from './controller.constants.ts'
import {
  AttrsMessageSchema,
  ControllerModuleDefaultSchema,
  ImportModuleSchema,
  RenderMessageSchema,
  type SwapMode,
} from './controller.schemas.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'

const styles = createStyles({
  controller: { display: 'contents' },
})

/**
 * Brand identifier stamped onto `ControllerTemplate` function objects.
 *
 * @remarks
 * Used at runtime to distinguish controller island template functions from
 * plain {@link FunctionTemplate} instances.
 *
 * @public
 */
export const CONTROLLER_TEMPLATE_IDENTIFIER = '🎛️' as const

/**
 * A template function branded as a controller island entry point.
 *
 * @remarks
 * Returned by {@link controlIsland}. Carries the custom element `tag` and `$`
 * brand so consumers can identify it as a controller island template.
 *
 * @public
 */
export type ControllerTemplate = FunctionTemplate<ElementAttributeList['controlIsland']> & {
  tag: CustomElementTag
  $: typeof CONTROLLER_TEMPLATE_IDENTIFIER
}

const getAttributes = (element: Element): Record<string, string> => {
  return Object.fromEntries(Array.from(element.attributes, (attr) => [attr.name, attr.value]))
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

      const listener = new DelegatedListener((_: Event) => {
        trigger({
          type,
          detail: getAttributes(element),
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
  trigger: Trigger
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
 * Defines and registers a custom-element controller island.
 *
 * @remarks
 * The custom element connects to the server topic declared by `p-topic`,
 * applies pushed `render` and `attrs` messages inside that island, forwards
 * `p-trigger` actions as BP events, and invokes default exports from local
 * controller modules loaded through site-root JavaScript import paths.
 *
 * @param tag - Custom element tag name to register and render.
 * @returns A branded `ControllerTemplate` function for use in SSR templates.
 *
 * @public
 */
export const controlIsland = (tag: CustomElementTag): ControllerTemplate => {
  if (canUseDOM() && !customElements.get(tag)) {
    customElements.define(
      tag,
      class extends HTMLElement {
        static observedAttributes = [P_TOPIC]
        #disconnectSet = new Set<Disconnect>()
        #socket: WebSocket | undefined
        #socketTopic: string | undefined
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
            this.#reportError(error)
          }
        })
        #connect() {
          const topic = this.getAttribute(P_TOPIC)
          if (!topic) return
          if (
            this.#socketTopic === topic &&
            (this.#socket?.readyState === WebSocket.CONNECTING || this.#socket?.readyState === WebSocket.OPEN)
          ) {
            return
          }
          this.#closeSocket()
          this.#socket = new WebSocket(`${self.location.origin.replace(/^http/, 'ws')}/ws`, topic)
          this.#socketTopic = topic
          delegates.set(this.#socket, this.#socketListener)
          this.#socket.addEventListener('open', this.#socketListener)
          this.#socket.addEventListener('message', this.#socketListener)
          this.#socket.addEventListener('error', this.#socketListener)
          this.#socket.addEventListener('close', this.#socketListener)
        }
        #closeSocket() {
          const socket = this.#socket
          this.#socket = undefined
          this.#socketTopic = undefined
          if (!socket) return
          socket.removeEventListener('open', this.#socketListener)
          socket.removeEventListener('message', this.#socketListener)
          socket.removeEventListener('error', this.#socketListener)
          socket.removeEventListener('close', this.#socketListener)
          if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) socket.close()
        }
        #addDisconnect(disconnect: Disconnect) {
          this.#disconnectSet.add(disconnect)
        }
        #send(message: { type: string; detail?: unknown }) {
          const onOpen = () => {
            this.#send(message)
            this.#socket?.removeEventListener('open', onOpen)
          }
          if (this.#socket?.readyState === WebSocket.OPEN) {
            this.#socket.send(JSON.stringify(message))
            return
          }
          if (this.#socket?.readyState === WebSocket.CLOSING || this.#socket?.readyState === WebSocket.CLOSED) {
            this.#closeSocket()
          }
          if (!this.#socket) this.#connect()
          this.#socket?.addEventListener('open', onOpen)
        }
        #reportError(error: unknown) {
          this.#send({
            type: CONTROLLER_TO_AGENT_EVENTS.error,
            detail: error instanceof Error ? error.message : String(error),
          })
        }
        #trigger(message: BPEvent) {
          this.#send({ type: CONTROLLER_TO_AGENT_EVENTS.ui_event, detail: message })
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
          this.#trigger({ type: CONTROLLER_TO_AGENT_EVENTS.import_invoked, detail: path })
        }
        #onWsMessage(message: MessageEvent) {
          try {
            const { type, detail } = BPEventSchema.parse(JSON.parse(String(message.data)))
            switch (type) {
              case AGENT_TO_CONTROLLER_EVENTS.import: {
                const path = ImportModuleSchema.shape.detail.parse(detail)
                void this.#importModule(path).catch((error) => this.#reportError(error))
                break
              }
              case AGENT_TO_CONTROLLER_EVENTS.render: {
                const { target, html, swap } = RenderMessageSchema.shape.detail.parse(detail)
                const element = this.querySelector(`[${P_TARGET}="${target}"]`)
                if (!element) return
                performSwap({
                  element,
                  trigger: this.#trigger.bind(this),
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
            this.#reportError(error)
          }
        }
        #onRetry() {
          this.#closeSocket()
          if (this.#retryCount >= UI_CORE_MAX_RETRIES) return
          const maxDelay = Math.min(9_999, 1_000 * 2 ** this.#retryCount)
          setTimeout(() => this.#connect(), Math.floor(Math.random() * maxDelay))
          this.#retryCount++
        }
        attributeChangedCallback(name: string, _: string | null, newValue: string | null) {
          if (name === P_TOPIC && isTypeOf<string>(newValue, 'string')) {
            this.#connect()
          }
        }
        adoptedCallback() {
          this.#connect()
        }
        connectedCallback() {
          this.#connect()
        }
        disconnectedCallback() {
          for (const cb of this.#disconnectSet) void cb()
          this.#disconnectSet.clear()
          this.#closeSocket()
        }
      },
    )
  }
  const ft: ControllerTemplate = ({ children = [], ...attrs }) => {
    const tpl = Fragment({ children })
    tpl.registry.push(tag)
    return createTemplate(tag, { ...attrs, ...styles.controller, children: tpl })
  }
  ft.tag = tag
  ft.$ = CONTROLLER_TEMPLATE_IDENTIFIER
  return ft
}
