import type { BPEvent, Trigger } from '../behavioral/types.js'
import type { Disconnect } from '../shared/types.js'
import type {
  PlaitedElement,
  DefinePlaitedTemplateArgs,
  QuerySelector,
  SubscribeToPublisher,
  PostToWorker,
} from './types.js'
import { bProgram } from '../behavioral/b-program.js'
import { sync, point } from '../behavioral/sync.js'
import { useClone } from './use-clone.js'
import { useEmit } from './use-emit.js'
import { P_TRIGGER } from '../jsx/constants.js'
import { useQuery, cssCache } from './use-query.js'
import { shadowObserver, addListeners } from './shadow-observer.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'
import { canUseDOM, noop } from '@plaited/utils'
import { P_WORKER, P_HANDLER } from './constants.js'
import { SendToHandler, useHandler } from './use-handler.js'
import { useWorker } from './use-worker.js'

export const definePlaitedElement = ({
  tag,
  stylesheets,
  formAssociated,
  publicEvents,
  observedAttributes = [],
  connectedCallback,
  disconnectedCallback,
  attributeChangedCallback,
  ...rest
}: Omit<DefinePlaitedTemplateArgs, 'mode' | 'delegateFocus' | 'shadowDom'> & { stylesheets: string[] }) => {
  if (canUseDOM() && !customElements.get(tag)) {
    class BaseElement extends HTMLElement implements PlaitedElement {
      static observedAttributes = [...observedAttributes, P_WORKER]
      static formAssociated = formAssociated
      get publicEvents() {
        return publicEvents
      }
      internals_: ElementInternals
      get #root() {
        return this.internals_.shadowRoot as ShadowRoot
      }
      #query: QuerySelector
      #shadowObserver?: MutationObserver
      #trigger?: Trigger
      #disconnectSet = new Set<Disconnect>()
      #sendDirective = {
        [P_HANDLER]: this.#fallbackSendDirective<SendToHandler>(P_HANDLER),
        [P_WORKER]: this.#fallbackSendDirective<PostToWorker>(P_WORKER),
      }
      constructor() {
        super()
        this.internals_ = this.attachInternals()
        cssCache.set(this.#root, new Set<string>(stylesheets))
        this.#query = useQuery(this.#root)
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
        attributeChangedCallback?.bind(this)(name, oldValue, newValue)
      }
      connectedCallback() {
        if (connectedCallback) {
          // create a behavioral program
          const { trigger, useFeedback, ...rest } = bProgram()
          this.#trigger = trigger
          // Delegate listeners nodes with p-trigger directive on connection or upgrade
          addListeners(Array.from(this.#root.querySelectorAll<Element>(`[${P_TRIGGER}]`)), trigger)
          // Create a shadow observer to watch for modification & addition of nodes with p-trigger directive
          this.#shadowObserver = shadowObserver(this.#root, trigger)
          // create a handler to send message to server based on p-handler directive
          const handler: SendToHandler = (event) => this.#sendDirective[P_HANDLER](event)
          handler.disconnect = () => this.#sendDirective[P_HANDLER].disconnect()
          // create a handler to send message to web worker based on p-worker directive
          const worker: PostToWorker = (event) => this.#sendDirective[P_WORKER](event)
          worker.disconnect = () => this.#sendDirective[P_WORKER].disconnect()
          // bind connectedCallback to the custom element wih the following arguments
          const actions = connectedCallback.bind(this)({
            $: this.#query,
            host: this,
            emit: useEmit(this),
            clone: useClone(this.#root),
            subscribe: ((target, type) => {
              const disconnect = target.sub(type, trigger)
              this.#disconnectSet.add(disconnect)
              return disconnect
            }) as SubscribeToPublisher,
            send: { handler, worker },
            trigger,
            sync,
            point,
            ...rest,
          })
          // Subscribe feedback actions to behavioral program and add disconnect callback to disconnect set
          this.#disconnectSet.add(useFeedback(actions))
        }
      }
      disconnectedCallback() {
        this.#shadowObserver?.disconnect()
        for (const cb of this.#disconnectSet) cb()
        this.#disconnectSet.clear()
        disconnectedCallback?.bind(this)()
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
        if (this.#trigger && publicEvents) onlyPublicEvents(this.#trigger, publicEvents)(event)
      }
    }
    Object.assign(BaseElement.prototype, rest)
    customElements.define(tag, BaseElement)
  }
}
