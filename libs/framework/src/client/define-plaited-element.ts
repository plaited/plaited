import type { BPEvent, Trigger } from '../behavioral/types.js'
import type { Disconnect } from '../shared/types.js'
import type { PlaitedElement, QuerySelector, DefinePlaitedTemplateArgs } from './types.js'
import { bProgram } from '../behavioral/b-program.js'
import { sync, loop, thread } from '../behavioral/rules-function.js'
import { useClone } from './use-clone.js'
import { useEmit } from './use-emit.js'
import { BP_TRIGGER } from '../jsx/constants.js'
import { useQuery, cssCache, handleTemplateObject } from './use-query.js'
import { shadowObserver, addListeners } from './shadow-observer.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'
import { canUseDOM } from '@plaited/utils'
import { TemplateObject } from '../jsx/types.js'

export const definePlaitedElement = ({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  formAssociated,
  publicEvents,
  observedAttributes,
  bp,
  connectedCallback,
  disconnectedCallback,
  ...rest
}: DefinePlaitedTemplateArgs & { shadowDom: TemplateObject }) => {
  if (canUseDOM() && !customElements.get(tag)) {
    class BaseElement extends HTMLElement implements PlaitedElement {
      static observedAttributes = observedAttributes
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
        if (this.internals_.shadowRoot === null) {
          this.attachShadow({ mode, delegatesFocus })
          handleTemplateObject(this.#root, shadowDom)
        }
        this.#query = useQuery(this.#root)
      }
      connectedCallback() {
        connectedCallback?.bind(this)()
        if (bp) {
          const { trigger, feedback, ...rest } = bProgram()
          this.#trigger = trigger
          addListeners(
            // just connected/upgraded then delegate listeners nodes with bp-trigger attribute
            Array.from(this.#root.querySelectorAll<Element>(`[${BP_TRIGGER}]`)),
            trigger,
          )
          this.#shadowObserver = shadowObserver(this.#root, trigger) // create a shadow observer to watch for modification & addition of nodes with bp-trigger attribute
          const actions = bp.bind(this)({
            $: this.#query,
            host: this,
            emit: useEmit(this),
            clone: useClone(this.#root),
            trigger,
            sync,
            loop,
            thread,
            ...rest,
          })
          feedback(actions)
        }
      }
      disconnectedCallback() {
        this.#shadowObserver?.disconnect()
        for (const cb of this.#disconnectSet) cb()
        disconnectedCallback?.bind(this)()
      }
      addDisconnectedCallback(cb: Disconnect) {this.#disconnectSet.add(cb)}
      trigger(event: BPEvent) {
        if (this.#trigger && publicEvents) onlyPublicEvents(this.#trigger, publicEvents)(event)
      }
    }
    Object.assign(BaseElement.prototype, rest)
    customElements.define(tag, BaseElement)
  }
}
