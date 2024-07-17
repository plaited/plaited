import type { BPEvent, Trigger } from '../behavioral/types.js'
import type { Disconnect } from './types.js'
import type { PlaitedElement, QuerySelector, GetPlaitedElement } from './types.js'
import { bProgram } from '../behavioral/b-program.js'
import { useClone } from './use-clone.js'
import { useEmit } from '../shared/use-emit.js'
import { useConnect } from './use-connect.js'
import { BP_TRIGGER } from '../jsx/constants.js'
import { cssCache, useQuery } from './use-query.js'
import { shadowObserver, addListeners } from './shadow-observer.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'
import { canUseDOM } from '@plaited/utils'

export const getPlaitedElement: GetPlaitedElement = ({
  tag,
  template,
  mode,
  delegatesFocus,
  publicEvents,
  observedAttributes,
  connectedCallback,
  disconnectedCallback,
  bp,
  devtool,
  publish,
  subscribe,
  useAjax,
  address = '',
  ...rest
}) => {
  if (canUseDOM() && !customElements.get(tag)) {
    class BaseElement extends HTMLElement implements PlaitedElement {
      static observedAttributes = observedAttributes
      get publicEvents() {
        return publicEvents
      }
      internals_: ElementInternals
      #root: ShadowRoot
      #query: QuerySelector
      constructor() {
        super()
        this.internals_ = this.attachInternals()
        if (this.internals_.shadowRoot) {
          this.#root = this.internals_.shadowRoot
        } else {
          this.#root = this.attachShadow({ mode, delegatesFocus })
          const { client, stylesheets } = template
          this.#root.innerHTML = client.join('')
          if (stylesheets.size) {
            const adoptedStyleSheets: CSSStyleSheet[] = []
            for (const style of stylesheets) {
              const sheet = new CSSStyleSheet()
              sheet.replaceSync(style)
              adoptedStyleSheets.push(sheet)
            }
            this.#root.adoptedStyleSheets = adoptedStyleSheets
          }
        }
        cssCache.set(this.#root, new Set<string>([...template.stylesheets]))
        this.#query = useQuery(this.#root)
      }
      #shadowObserver?: MutationObserver
      #disconnectSet = new Set<Disconnect>()
      #trigger?: Trigger
      connectedCallback() {
        useAjax && this.#disconnectSet.add(useAjax(this.#root))
        if (bp) {
          const { trigger, feedback, ...rest } = bProgram(devtool)
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
            connect: useConnect({ trigger, disconnectSet: this.#disconnectSet }),
            // @ts-ignore: union mismatch
            socket: publish,
            trigger,
            ...rest,
          })
          feedback(actions)
          subscribe && subscribe(address, trigger)
        }
        connectedCallback && connectedCallback.bind(this)()
      }
      disconnectedCallback() {
        this.#shadowObserver?.disconnect()
        for (const cb of this.#disconnectSet) cb()
        disconnectedCallback && disconnectedCallback.bind(this)()
      }
      trigger(event: BPEvent) {
        if (this.#trigger && publicEvents) onlyPublicEvents(this.#trigger, publicEvents)(event)
      }
    }
    Object.assign(BaseElement.prototype, rest)
    customElements.define(tag, BaseElement)
  }
}
