import { createTemplate } from '../jsx/index.js'
import { bpTrigger } from '../jsx/constants.js'
import { bProgram } from '../behavioral/index.js'
import type {
  BPEvent,
  Trigger,
  GetPlaitedElement,
  PlaitedElement,
  PlaitedComponent,
  QuerySelector,
  PlaitedTemplate,
} from '../types.js'
import { $, cssCache, clone } from './sugar.js'
import { delegates, DelegatedListener } from './delegated-listener.js'
import { emit } from './private-utils.js'
import { hasLogger } from './type-guards.js'
import { defineRegistry } from './define-registry.js'
import { onlyObservedTriggers } from './only-observed-triggers.js'

const isElement = (node: Node): node is Element => node.nodeType === 1

const getTriggerMap = (el: Element) =>
  new Map((el.getAttribute(bpTrigger) as string).split(' ').map((pair) => pair.split(':')) as [string, string][])

/** get trigger for elements respective event from triggerTypeMap */
const getTriggerType = (event: Event, context: Element) => {
  const el =
    context.tagName !== 'SLOT' && event.currentTarget === context ? context
    : event.composedPath().find((el) => el instanceof ShadowRoot) === context.getRootNode() ? context
    : undefined
  if (!el) return
  return getTriggerMap(el).get(event.type)
}

/**
 * Creates a PlaitedComponent
 * @param {object} args - Arguments for the PlaitedComponent
 * @param {string} args.tag - PlaitedComponent tag name
 * @param {string[]} args.observedAttributes - observed Attributes that will trigger the native `attributeChangedCallback` method when modified
 * @param {string[]} args.observedTriggers - observed triggers that can be fired from outside component by invoking `trigger` method directly, via messenger, or via publisher
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
  observedTriggers,
  observedAttributes,
  mode = 'open',
  delegatesFocus = true,
  bp,
  connectedCallback,
  disconnectedCallback,
  ...rest
}) => {
  if (!tag) {
    throw new Error(`Component is missing a [tag]`)
  }
  const _tag = tag.toLowerCase() as `${string}-${string}`
  const getPlaitedElement = () => {
    class Base extends HTMLElement implements PlaitedElement {
      static tag = _tag
      static observedAttributes = observedAttributes
      get observedTriggers() {
        return observedTriggers
      }
      internals_: ElementInternals
      #root: ShadowRoot
      $: QuerySelector
      constructor() {
        super()
        if (!template) throw new Error(`Component [${tag}] is missing a [template]`)
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
        /** Warn ourselves not to overwrite the trigger method */
        if (this.trigger !== this.constructor.prototype.trigger) {
          throw new Error('trigger method cannot be overridden in a subclass.')
        }
        this.trigger = this.trigger.bind(this)
        this.$ = $(this.#root)
      }
      #trigger?: Trigger
      #shadowObserver?: MutationObserver
      #disconnectEventSources?: () => void
      connectedCallback() {
        if (bp) {
          const { trigger, ...rest } = bProgram(hasLogger(window) ? window.logger : undefined)
          this.#trigger = trigger // listeners need trigger to be available on instance
          this.#delegateListeners(
            // just connected/upgraded then delegate listeners nodes with bp-trigger attribute
            Array.from(this.#root.querySelectorAll<Element>(`[${bpTrigger}]`)),
          )
          this.#shadowObserver = this.#createShadowObserver() // create a shadow observer to watch for modification & addition of nodes with bp-trigger attribute
          void bp.bind(this)({
            $: this.$,
            host: this,
            root: this.#root,
            emit: emit(this),
            clone: clone(this.#root),
            trigger,
            ...rest,
          })
        }
        connectedCallback && connectedCallback.bind(this)()
      }
      set disconnectEventSources(cb: () => void) {
        if (!this.#disconnectEventSources) {
          this.#disconnectEventSources = cb
        }
      }
      disconnectedCallback() {
        this.#shadowObserver?.disconnect()
        this.#disconnectEventSources?.()
        disconnectedCallback && disconnectedCallback.bind(this)()
      }
      /** If delegated listener does not have element then delegate it's callback with auto cleanup*/
      #createDelegatedListener(el: Element) {
        delegates.set(
          el,
          new DelegatedListener((event) => {
            const triggerType = el.getAttribute(bpTrigger) && getTriggerType(event, el)
            triggerType ?
              /** if key is present in `bp-trigger` trigger event on instance's bProgram */
              this.#trigger?.({ type: triggerType, detail: event })
            : /** if key is not present in `bp-trigger` remove event listener for this event on Element */
              el.removeEventListener(event.type, delegates.get(el))
          }),
        )
      }
      /** delegate event listeners  for elements in list */
      #delegateListeners(elements: Element[]) {
        for (const el of elements) {
          if (el.tagName === 'SLOT' && el.hasAttribute('slot')) continue // skip nested slots
          !delegates.has(el) && this.#createDelegatedListener(el) // bind a callback for element if we haven't already
          for (const [event] of getTriggerMap(el)) {
            // add event listeners for each event type
            el.addEventListener(event, delegates.get(el))
          }
        }
      }
      /**  Observes the addition of nodes to the shadow dom and changes to and child's bp-trigger attribute */
      #createShadowObserver() {
        const mo = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            if (mutation.type === 'attributes') {
              const el = mutation.target
              if (isElement(el)) {
                mutation.attributeName === bpTrigger && el.getAttribute(bpTrigger) && this.#delegateListeners([el])
              }
            } else if (mutation.addedNodes.length) {
              const length = mutation.addedNodes.length
              for (let i = 0; i < length; i++) {
                const node = mutation.addedNodes[i]
                if (isElement(node)) {
                  node.hasAttribute(bpTrigger) && this.#delegateListeners([node])
                  this.#delegateListeners(Array.from(node.querySelectorAll(`[${bpTrigger}]`)))
                }
              }
            }
          }
        })
        mo.observe(this.#root, {
          attributeFilter: [bpTrigger],
          childList: true,
          subtree: true,
        })
        return mo
      }
      trigger(event: BPEvent) {
        this.#trigger && onlyObservedTriggers(this.#trigger, this)(event)
      }
    }
    Object.assign(Base.prototype, rest)
    return Base
  }
  const registry = new Set<GetPlaitedElement>([...template.registry, getPlaitedElement])
  const ft: PlaitedTemplate = ({ children = [], ...attrs }) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: {
            ...template,
            registry,
          },
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.define = (silent = true) => defineRegistry(new Set<GetPlaitedElement>(registry), silent)
  ft.tag = _tag
  ft.$ = '🐻'
  return ft
}
