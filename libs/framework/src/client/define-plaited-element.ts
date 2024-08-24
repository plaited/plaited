import type { BPEvent, Trigger } from '../behavioral/types.js'
import type { Disconnect } from '../shared/types.js'
import type { PlaitedElement, DefinePlaitedTemplateArgs, QuerySelector } from './types.js'
import { bProgram } from '../behavioral/b-program.js'
import { sync, point } from '../behavioral/sync.js'
import { useClone } from './use-clone.js'
import { useEmit } from './use-emit.js'
import { P_TRIGGER } from '../jsx/constants.js'
import { useQuery, cssCache } from './use-query.js'
import { shadowObserver, addListeners } from './shadow-observer.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'
import { canUseDOM, isTypeOf } from '@plaited/utils'
import { navigationListener } from './navigation-listener.js'
import { useConnect } from './use-connect.js'
import { P_WORKER } from './constants.js'

export const definePlaitedElement = ({
  tag,
  shadowDom,
  formAssociated,
  publicEvents,
  observedAttributes = [],
  connectedCallback,
  disconnectedCallback,
  attributeChangedCallback,
  ...rest
}: Omit<DefinePlaitedTemplateArgs, 'mode' | 'delegateFocus'>) => {
  if (canUseDOM() && !customElements.get(tag)) {
    class BaseElement extends HTMLElement implements PlaitedElement {
      static observedAttributes = [...observedAttributes, P_WORKER]
      static formAssociated = formAssociated
      get publicEvents() {
        return publicEvents
      }
      internals_: ElementInternals
      get #root() { return this.internals_.shadowRoot as ShadowRoot}
      #query: QuerySelector
      #shadowObserver?: MutationObserver
      #trigger?: Trigger
      #disconnectSet = new Set<Disconnect>()
      constructor() {
        super()
        this.internals_ = this.attachInternals()
        cssCache.set(this.#root, new Set<string>([...shadowDom.stylesheets]))
        this.#query = useQuery(this.#root)
      }
      #updateWorker?: (newValue: string | null) => void
      attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        name === P_WORKER && this.#updateWorker?.(newValue)
        attributeChangedCallback?.bind(this)(name, oldValue, newValue)
      }
      connectedCallback() {
        isTypeOf<string>(history?.state?.plaited, 'string') && navigationListener(this.#root)
        if (connectedCallback) {
          const { trigger, useFeedback, ...rest } = bProgram()
          this.#trigger = trigger
          addListeners(
            // just connected/upgraded then delegate listeners nodes with p-trigger attribute
            Array.from(this.#root.querySelectorAll<Element>(`[${P_TRIGGER}]`)),
            this.#trigger,
          )
          this.#shadowObserver = shadowObserver(this.#root, trigger) // create a shadow observer to watch for modification & addition of nodes with p-trigger attribute
          const actions = connectedCallback.bind(this)({
            $: this.#query,
            host: this,
            emit: useEmit(this),
            clone: useClone(this.#root),
            connect: useConnect({host: this, disconnectSet: this.#disconnectSet, trigger, setUpdateWorker: (updateWorker) => this.#updateWorker = updateWorker}),
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
      trigger(event: BPEvent) {
        if (this.#trigger && publicEvents) onlyPublicEvents(this.#trigger, publicEvents)(event)
      }
    }
    Object.assign(BaseElement.prototype, rest)
    customElements.define(tag, BaseElement)
  }
}
