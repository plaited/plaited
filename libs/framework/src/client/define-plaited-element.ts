import type { BPEvent, Trigger, BThreads, UseFeedback, UseSnapshot } from '../behavioral/types.js'
import type { Disconnect } from '../shared/types.js'
import type {
  PlaitedElement,
  DefinePlaitedTemplateArgs,
  QuerySelector,
  SubscribeToPublisher,
  PostToWorker,
  AttachShadowOptions,
  PlaitedElementCallbackParameters,
} from './types.js'
import { bProgram } from '../behavioral/b-program.js'
import { sync, point } from '../behavioral/sync.js'
import { useClone } from './use-clone.js'
import { useEmit } from './use-emit.js'
import { P_TRIGGER } from '../jsx/constants.js'
import { useQuery, handleTemplateObject } from './use-query.js'
import { shadowObserver, addListeners } from './shadow-observer.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'
import { canUseDOM, noop } from '@plaited/utils'
import { P_WORKER, P_HANDLER } from './constants.js'
import { SendToHandler, useHandler } from './use-handler.js'
import { useWorker } from './use-worker.js'
import { callbacks } from './constants.js'

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
  ...rest
}: DefinePlaitedTemplateArgs & AttachShadowOptions) => {
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
              emit: useEmit(this),
              clone: useClone(this.#root),
              subscribe: ((target, type) => {
                const disconnect = target.sub(type, this.#trigger)
                this.#disconnectSet.add(disconnect)
                return disconnect
              }) as SubscribeToPublisher,
              send: { handler, worker },
              trigger: this.#trigger,
              useSnapshot: this.#useSnapshot,
              bThreads: this.#bThreads,
              sync,
              point,
              ...rest,
            })
            // Subscribe feedback actions to behavioral program and add disconnect callback to disconnect set
            this.#disconnectSet.add(this.#useFeedback(actions))
          }
        }
        disconnectedCallback() {
          this.#shadowObserver?.disconnect()
          for (const cb of this.#disconnectSet) cb()
          this.#disconnectSet.clear()
          this.#trigger({ type: callbacks.onDisconnected })
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
            type: callbacks.onAttributeChanged,
            detail: { name, oldValue, newValue },
          })
        }
        adoptedCallback() {
          this.#trigger({ type: callbacks.onAdopted })
        }
        formAssociatedCallback(form: HTMLFormElement) {
          this.#trigger<PlaitedElementCallbackParameters['onFormAssociated']>({
            type: callbacks.onFormAssociated,
            detail: { form },
          })
        }
        formDisabledCallback(disabled: boolean) {
          this.#trigger<PlaitedElementCallbackParameters['onFormDisabled']>({
            type: callbacks.onFormDisabled,
            detail: { disabled },
          })
        }
        formResetCallback() {
          this.#trigger({ type: callbacks.onFormReset })
        }
        formStateRestoreCallback(state: unknown, reason: 'autocomplete' | 'restore') {
          this.#trigger<PlaitedElementCallbackParameters['onFormStateRestore']>({
            type: callbacks.onFormStateRestore,
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
        trigger(event: BPEvent) {
          publicEvents && onlyPublicEvents(this.#trigger, publicEvents)(event)
        }
      },
    )
  }
}
