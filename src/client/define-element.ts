import type { Disconnect, SubscribeToPublisher } from './client.types.js'
import type { PostToWorker } from '../worker/use-worker.js'
import type { TemplateObject, CustomElementTag } from '../jsx/jsx.types.js'
import { P_WORKER, P_SERVER } from '../jsx/jsx.constants.js'
import { type BPEvent, type BSync, type BThread, bThread, bSync } from '../behavioral/b-thread.js'
import {
  type Actions,
  type BThreads,
  type Trigger,
  type UseFeedback,
  type UseSnapshot,
  bProgram,
} from '../behavioral/b-program.js'
import { P_TRIGGER } from '../jsx/jsx.constants.js'
import { QuerySelector, useQuery, handleTemplateObject } from './use-query.js'
import { shadowObserver, addListeners } from './shadow-observer.js'
import { usePublicEvents } from '../behavioral/use-public-events.js'
import { canUseDOM } from './can-use-dom.js'
import { SendServer, useServer } from './use-server.js'
import { useWorker } from '../worker/use-worker.js'
import { ELEMENT_CALLBACKS } from './client.constants.js'

export interface PlaitedElement extends HTMLElement {
  // Custom Methods and properties
  trigger: Trigger
  readonly publicEvents?: string[]
  adoptedCallback?: { (this: PlaitedElement): void }
  attributeChangedCallback?: {
    (this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void
  }
  connectedCallback(this: PlaitedElement): void
  disconnectedCallback(this: PlaitedElement): void
  formAssociatedCallback(this: PlaitedElement, form: HTMLFormElement): void
  formDisabledCallback(this: PlaitedElement, disabled: boolean): void
  formResetCallback(this: PlaitedElement): void
  formStateRestoreCallback(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void
}

type Subscribe = (
  target: {
    sub: SubscribeToPublisher
  },
  type: string,
  getLVC?: boolean,
) => Disconnect

type Emit = <T = unknown>(
  args: BPEvent<T> & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

export type ConnectedCallbackArgs = {
  $: QuerySelector
  root: ShadowRoot
  internals: ElementInternals
  subscribe: Subscribe
  send: { server: SendServer; worker: PostToWorker }
  emit: Emit
  trigger: Trigger
  bThreads: BThreads
  useSnapshot: UseSnapshot
  bThread: BThread
  bSync: BSync
}

export type PlaitedElementCallbackActions = {
  [ELEMENT_CALLBACKS.onAdopted]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onAttributeChanged]?: (args: {
    name: string
    oldValue: string | null
    newValue: string | null
  }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onDisconnected]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormAssociated]?: (args: { form: HTMLFormElement }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormDisabled]?: (args: { disabled: boolean }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormReset]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormStateRestore]?: (args: {
    state: unknown
    reason: 'autocomplete' | 'restore'
  }) => void | Promise<void>
}

type RequirePlaitedElementCallbackActions = Required<PlaitedElementCallbackActions>

type PlaitedElementCallbackParameters = {
  [K in keyof RequirePlaitedElementCallbackActions]: Parameters<RequirePlaitedElementCallbackActions[K]> extends (
    undefined
  ) ?
    undefined
  : Parameters<RequirePlaitedElementCallbackActions[K]>[0]
}

export type DefineElementArgs = {
  tag: CustomElementTag
  shadowDom: TemplateObject
  delegatesFocus: boolean
  mode: 'open' | 'closed'
  slotAssignment: 'named' | 'manual'
  observedAttributes?: string[]
  publicEvents?: string[]
  formAssociated?: true
  connectedCallback?: {
    (this: PlaitedElement, args: ConnectedCallbackArgs): Actions<PlaitedElementCallbackActions>
  }
}

export const defineElement = ({
  tag,
  formAssociated,
  publicEvents,
  observedAttributes = [],
  shadowDom,
  delegatesFocus,
  mode,
  slotAssignment,
  connectedCallback,
}: DefineElementArgs) => {
  if (canUseDOM() && !customElements.get(tag)) {
    customElements.define(
      tag,
      class extends HTMLElement implements PlaitedElement {
        static observedAttributes = [...observedAttributes, P_WORKER]
        static formAssociated = formAssociated
        get publicEvents() {
          return publicEvents
        }
        #internals: ElementInternals
        get #root() {
          return this.#internals.shadowRoot as ShadowRoot
        }
        #query: QuerySelector
        #shadowObserver?: MutationObserver
        #trigger: Trigger
        #useFeedback: UseFeedback
        #useSnapshot: UseSnapshot
        #bThreads: BThreads
        #disconnectSet = new Set<Disconnect>()
        #sendServer = this.#fallbackSendDirective<SendServer>(P_SERVER)
        #sendWorker = this.#fallbackSendDirective<PostToWorker>(P_WORKER)
        trigger: Trigger
        #mounted = false
        constructor() {
          super()
          this.#internals = this.attachInternals()
          const frag = handleTemplateObject(this.#root, shadowDom)
          this.attachShadow({ mode, delegatesFocus, slotAssignment })
          this.#root.replaceChildren(frag)
          this.#query = useQuery(this.#root)
          const { trigger, useFeedback, useSnapshot, bThreads } = bProgram()
          this.#trigger = trigger
          this.#useFeedback = useFeedback
          this.#useSnapshot = useSnapshot
          this.#bThreads = bThreads
          this.trigger = usePublicEvents(this.#trigger, publicEvents)
        }
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
          if (!this.#mounted) return
          if (name === P_WORKER && oldValue !== newValue) this.#setSendWorker(newValue)
          if (name === P_SERVER && oldValue !== newValue) this.#setSendServer(newValue)
          this.#trigger<PlaitedElementCallbackParameters['onAttributeChanged']>({
            type: ELEMENT_CALLBACKS.onAttributeChanged,
            detail: { name, oldValue, newValue },
          })
        }
        adoptedCallback() {
          this.#trigger({ type: ELEMENT_CALLBACKS.onAdopted })
        }
        connectedCallback() {
          this.#mounted = true
          // create a server to send message to server based on p-server directive
          const server: SendServer = (event) => this.#sendServer(event)
          server.disconnect = () => this.#sendServer.disconnect()
          this.hasAttribute(P_SERVER) && this.#setSendServer(this.getAttribute(P_SERVER))
          if (connectedCallback) {
            // Delegate listeners nodes with p-trigger directive on connection or upgrade
            addListeners(Array.from(this.#root.querySelectorAll<Element>(`[${P_TRIGGER}]`)), this.#trigger)
            // Create a shadow observer to watch for modification & addition of nodes with p-this.#trigger directive
            this.#shadowObserver = shadowObserver(this.#root, this.#trigger)
            // create a server to send message to web worker based on p-worker directive
            const worker: PostToWorker = (event) => this.#sendWorker(event)
            worker.disconnect = () => this.#sendWorker.disconnect()
            this.hasAttribute(P_WORKER) && this.#setSendWorker(this.getAttribute(P_WORKER))
            // bind connectedCallback to the custom element wih the following arguments
            const actions = connectedCallback.bind(this)({
              $: this.#query,
              root: this.#root,
              internals: this.#internals,
              subscribe: ((target, type, getLVC) => {
                const disconnect = target.sub(type, this.#trigger, getLVC)
                this.#disconnectSet.add(disconnect)
                return disconnect
              }) as Subscribe,
              send: { server, worker },
              emit: this.#emit,
              trigger: this.#trigger,
              useSnapshot: this.#useSnapshot,
              bThreads: this.#bThreads,
              bThread,
              bSync,
            })
            // Subscribe feedback actions to behavioral program and add disconnect callback to disconnect set
            this.#disconnectSet.add(this.#useFeedback(actions))
          }
        }
        disconnectedCallback() {
          this.#shadowObserver?.disconnect()
          for (const cb of this.#disconnectSet) cb()
          this.#disconnectSet.clear()
          this.#trigger({ type: ELEMENT_CALLBACKS.onDisconnected })
        }
        formAssociatedCallback(form: HTMLFormElement) {
          this.#trigger<PlaitedElementCallbackParameters['onFormAssociated']>({
            type: ELEMENT_CALLBACKS.onFormAssociated,
            detail: { form },
          })
        }
        formDisabledCallback(disabled: boolean) {
          this.#trigger<PlaitedElementCallbackParameters['onFormDisabled']>({
            type: ELEMENT_CALLBACKS.onFormDisabled,
            detail: { disabled },
          })
        }
        formResetCallback() {
          this.#trigger({ type: ELEMENT_CALLBACKS.onFormReset })
        }
        formStateRestoreCallback(state: unknown, reason: 'autocomplete' | 'restore') {
          this.#trigger<PlaitedElementCallbackParameters['onFormStateRestore']>({
            type: ELEMENT_CALLBACKS.onFormStateRestore,
            detail: { state, reason },
          })
        }
        #emit({ type, detail, bubbles = false, cancelable = true, composed = true }: Parameters<Emit>[0]) {
          if (!type) return
          const event = new CustomEvent(type, {
            bubbles,
            cancelable,
            composed,
            detail,
          })
          this.dispatchEvent(event)
        }
        #fallbackSendDirective<T>(directive: string) {
          const fallback = () => console.error(`Missing directive: ${directive}`)
          fallback.disconnect = () => {}
          return fallback as T
        }
        #setSendWorker(value: string | null) {
          this.#sendWorker.disconnect()
          this.#disconnectSet.delete(this.#sendWorker.disconnect)
          this.#sendWorker =
            value === null ? this.#fallbackSendDirective<PostToWorker>(P_WORKER) : useWorker(this.trigger.bind(this), value)
        }
        #setSendServer(value: string | null) {
          this.#sendServer.disconnect()
          this.#disconnectSet.delete(this.#sendServer.disconnect)
          this.#sendServer = value === null ? this.#fallbackSendDirective<PostToWorker>(P_WORKER) : useServer(this)
        }
      },
    )
  }
}
