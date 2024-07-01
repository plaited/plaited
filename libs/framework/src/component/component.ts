import { bProgram } from '../behavioral/b-program.js'
import type { PlaitedComponent, PlaitedElement, BPEvent, QuerySelector, Trigger, Disconnect } from '../types.js'
import { clone } from './sugar.js'
import { hasLogger, hasHDA } from './type-guards.js'
import { emit } from '../shared/emit.js'
import { useConnect } from './use-connect.js'
import { getPlaitedTemplate } from './get-plaited-template.js'
import { PLAITED_HDA_HOOK, PLAITED_LOGGER } from '../shared/constants.js'
import { bpTrigger } from '../jsx/constants.js'
import { cssCache, $ } from './sugar.js'
import { shadowObserver, addListeners } from './shadow-observer.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'
/**
 * Creates a PlaitedComponent
 * @param {object} args - Arguments for the PlaitedComponent
 * @param {string} args.tag - PlaitedComponent tag name
 * @param {string[]} args.observedAttributes - observed Attributes that will trigger the native `attributeChangedCallback` method when modified
 * @param {string[]} args.publicEvents - observed triggers that can be fired from outside component by invoking `trigger` method directly, via messenger, or via publisher
 * @param {string} args.mode - define wether island's custom element is open or closed. @defaultValue 'open'  @values 'open' | 'closed'
 * @param {boolean} args.delegatesFocus - configure whether to delegate focus or not @defaultValue 'true'
 * @param {function} args.eventSourceHandler - callback to handle event sources like messenger, publisher, web socket, or server sent events
 * @param {function} args.strategy - event selection strategy callback from behavioral library
 * @param {boolean|function} args.logger - logger function to receive messages from behavioral program selectedEvent publisher
 * @param {function} args.bp - behavioral program callback
 * @returns {PlaitedTemplate} A PlaitedTemplate of the PlaitedComponent
 */
export const Component: PlaitedComponent = ({
  tag,
  template,
  publicEvents,
  observedAttributes,
  mode = 'open',
  delegatesFocus = true,
  bp,
  connectedCallback,
  disconnectedCallback,
  ...rest
}) => {
  if (!tag) throw new Error(`Component is missing a [tag]`)
  if (!template) throw new Error(`Component [${tag}] is missing a [template]`)
  const getPlaitedElement = () => {
    class BaseElement extends HTMLElement implements PlaitedElement {
      static observedAttributes = observedAttributes
      get publicEvents() {
        return publicEvents
      }
      internals_: ElementInternals
      #root: ShadowRoot
      $: QuerySelector
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
        this.$ = $(this.#root)
      }
      #shadowObserver?: MutationObserver
      #disconnectSet = new Set<Disconnect>()
      #addDisconnect(cb: Disconnect) {
        return this.#disconnectSet.add(cb)
      }
      #trigger?: Trigger
      connectedCallback() {
        hasHDA(window) && window[PLAITED_HDA_HOOK](this.#root)
        if (bp) {
          const logger = hasLogger(window) ? window[PLAITED_LOGGER] : undefined
          const { trigger, feedback, ...rest } = bProgram(logger)
          this.#trigger = trigger
          addListeners(
            // just connected/upgraded then delegate listeners nodes with bp-trigger attribute
            Array.from(this.#root.querySelectorAll<Element>(`[${bpTrigger}]`)),
            trigger,
          )
          this.#shadowObserver = shadowObserver(this.#root, trigger) // create a shadow observer to watch for modification & addition of nodes with bp-trigger attribute

          const actions = bp.bind(this)({
            $: this.$,
            host: this,
            emit: emit(this),
            clone: clone(this.#root),
            connect: useConnect({ trigger, addDisconnect: this.#addDisconnect.bind(this), host: this }),
            trigger,
            ...rest,
          })
          feedback(actions)
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
    return BaseElement
  }
  getPlaitedElement.tag = tag.toLowerCase() as `${string}-${string}`
  return getPlaitedTemplate({
    getPlaitedElement,
    mode,
    delegatesFocus,
    template,
  })
}
