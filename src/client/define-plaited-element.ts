import type { Disconnect } from '../shared/shared.types.js'
import type { PostToWorker } from './use-worker.js'
import type { TemplateObject, CustomElementTag } from '../jsx/jsx.types.js'
import {
  Actions,
  BPEvent,
  BSync,
  BThread,
  BThreads,
  Trigger,
  UseFeedback,
  UseSnapshot,
  bProgram,
  bThread,
  bSync,
} from '../behavioral.js'
import { P_TRIGGER } from '../jsx/jsx.constants.js'
import { QuerySelector, useQuery, handleTemplateObject } from './use-query.js'
import { shadowObserver, addListeners } from './shadow-observer.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'
import { SubscribeToPublisher } from '../shared/shared.types.js'
import { canUseDOM } from './can-use-dom.js'
import { noop } from '../utils.js'
import { P_WORKER, P_HANDLER } from './constants.js'
import { SendToHandler, useHandler } from './use-handler.js'
import { useWorker } from './use-worker.js'
import { ELEMENT_CALLBACKS } from './constants.js'

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

type Subscribe = (target: {
  sub:SubscribeToPublisher
}, type: string, getLVC?: boolean) => Disconnect

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
  send: { handler: SendToHandler; worker: PostToWorker }
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

export type DefinePlaitedElementArgs = {
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



export const definePlaitedElement = ({
  tag,
  formAssociated,
  publicEvents,
  observedAttributes = [],
  shadowDom,
  delegatesFocus,
  mode,
  slotAssignment,
  connectedCallback,
}: DefinePlaitedElementArgs) => {
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
        #sendDirective = {
          [P_HANDLER]: this.#fallbackSendDirective<SendToHandler>(P_HANDLER),
          [P_WORKER]: this.#fallbackSendDirective<PostToWorker>(P_WORKER),
        }
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
        }
        connectedCallback() {
          if (connectedCallback) {
            // create a behavioral program
            // Delegate listeners nodes with p-trigger directive on connection or upgrade
            addListeners(Array.from(this.#root.querySelectorAll<Element>(`[${P_TRIGGER}]`)), this.#trigger)
            // Create a shadow observer to watch for modification & addition of nodes with p-this.#trigger directive
            this.#shadowObserver = shadowObserver(this.#root, this.#trigger)
            // create a handler to send message to server based on p-handler directive
            const handler: SendToHandler = (event) => this.#sendDirective[P_HANDLER](event)
            handler.disconnect = () => this.#sendDirective[P_HANDLER].disconnect()
            // create a handler to send message to web worker based on p-worker directive
            const worker: PostToWorker = (event) => this.#sendDirective[P_WORKER](event)
            worker.disconnect = () => this.#sendDirective[P_WORKER].disconnect()
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
              send: { handler, worker },
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
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
          if (newValue && (name === P_WORKER || name === P_HANDLER)) {
            const disconnect = this.#sendDirective[name].disconnect
            this.#disconnectSet.delete(disconnect)
            disconnect()
            this.#connectSendDirective(name, newValue)
          }
          if (newValue === null && (name === P_WORKER || name === P_HANDLER)) {
            const disconnect = this.#sendDirective[name].disconnect
            this.#disconnectSet.delete(disconnect)
            disconnect()
            this.#sendDirective[name] = this.#fallbackSendDirective(name)
          }
          this.#trigger<PlaitedElementCallbackParameters['onAttributeChanged']>({
            type: ELEMENT_CALLBACKS.onAttributeChanged,
            detail: { name, oldValue, newValue },
          })
        }
        adoptedCallback() {
          this.#trigger({ type: ELEMENT_CALLBACKS.onAdopted })
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
        #fallbackSendDirective<T>(directive: string) {
          const fallback = () => console.error(`Missing directive: ${directive}`)
          fallback.disconnect = noop
          return fallback as T
        }
        #connectSendDirective(attr: typeof P_HANDLER | typeof P_WORKER, value: string) {
          const send = attr === P_HANDLER ? useHandler(this, value) : useWorker(this, value)
          this.#sendDirective[attr] === send
          this.#disconnectSet.add(send.disconnect)
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
        trigger(event: BPEvent) {
          publicEvents && onlyPublicEvents(this.#trigger, publicEvents)(event)
        }
      },
    )
  }
}
