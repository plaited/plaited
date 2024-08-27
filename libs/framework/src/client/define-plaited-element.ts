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
          const { trigger, useFeedback, ...rest } = bProgram()
          this.#trigger = trigger
          addListeners(
            // just connected/upgraded then delegate listeners nodes with p-trigger attribute
            Array.from(this.#root.querySelectorAll<Element>(`[${P_TRIGGER}]`)),
            trigger,
          )
          this.#shadowObserver = shadowObserver(this.#root, trigger) // create a shadow observer to watch for modification & addition of nodes with p-trigger attribute
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
            send: { handler: this.#sendDirective[P_HANDLER], worker: this.#sendDirective[P_WORKER] },
            trigger,
            sync,
            point,
            ...rest,
          })
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
        if (attr === P_HANDLER) this.#sendDirective[attr] === useHandler(this, value)
        if (attr === P_WORKER) this.#sendDirective[attr] === useWorker(this, value)
      }
      trigger(event: BPEvent) {
        if (this.#trigger && publicEvents) onlyPublicEvents(this.#trigger, publicEvents)(event)
      }
    }
    Object.assign(BaseElement.prototype, rest)
    customElements.define(tag, BaseElement)
  }
}
