import { createTemplate } from '@plaited/jsx'
import { bpTrigger, bpAddress } from '@plaited/jsx/utils'
import { Trigger, bProgram, BPEvent, Publisher } from '@plaited/behavioral'
import type {
  PlaitedElementConstructor,
  PlaitedElement,
  PlaitedComponent,
  Emit,
  Messenger,
  QuerySelector,
  PlaitedTemplate,
} from '@plaited/component-types'
import { $, cssCache, clone } from './sugar.js'
import { noop, trueTypeOf } from '@plaited/utils'
import { defineRegistry } from './define-registry.js'
import { delegatedListener } from './delegated-listener.js'

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

const isPublisher = (obj: Publisher | Messenger): obj is Publisher => 'subscribe' in obj

/**
 * Creates a PlaitedComponent
 * @param {object} args - Arguments for the PlaitedComponent
 * @param {string} args.tag - PlaitedComponent tag name
 * @param {string[]} args.attributes - observed Attributes that will trigger the native `attributeChangedCallback` method when modified
 * @param {string[]} args.triggers - observed triggers that can be fired from outside component by invoking `trigger` method directly, via messenger, or via publisher
 * @param {string} args.mode - define wether island's custom element is open or closed. @defaultValue 'open'  @values 'open' | 'closed'
 * @param {boolean} args.delegatesFocus - configure whether to delegate focus or not @defaultValue 'true'
 * @param {boolean|function} args.dev - logger function to receive messages from behavioral program react streams @defaultValue 'true'
 * @param {function} args.strategy - event selection strategy callback from behavioral library
 * @returns {FunctionTemplate} A FunctionTemplate of the PlaitedComponent
 */

export const Component: PlaitedComponent = ({
  tag,
  template,
  observedTriggers,
  observedAttributes = [],
  mode = 'open',
  delegatesFocus = true,
  dev,
  strategy,
  connectedCallback,
  disconnectedCallback,
  bp,
  ...rest
}) => {
  if (!tag) {
    throw new Error(`Component is missing a [tag]`)
  }
  const _tag = tag.toLowerCase() as `${string}-${string}`
  class Base extends HTMLElement implements PlaitedElement {
    static tag = _tag
    static observedAttributes = observedAttributes
    #observedTriggers = new Set(observedTriggers ?? [])
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
    connectedCallback() {
      if (bp) {
        const { trigger, ...rest } = bProgram({ strategy, dev })
        this.#trigger = trigger // listeners need trigger to be available on instance
        this.#delegateListeners(
          // just connected/upgraded then delegate listeners nodes with bp-trigger attribute
          Array.from(this.#root.querySelectorAll<Element>(`[${bpTrigger}]`)),
        )
        this.#shadowObserver = this.#createShadowObserver() // create a shadow observer to watch for modification & addition of nodes with bp-trigger attribute
        dev &&
          trigger({
            type: `connected(${this.getAttribute(bpAddress) ?? this.tagName.toLowerCase()})`,
          })
        void bp.bind(this)({
          $: this.$,
          host: this,
          emit: this.#emit.bind(this),
          clone: clone(this.#root),
          connect: this.#connect.bind(this),
          trigger,
          ...rest,
        })
      }
      connectedCallback && connectedCallback.bind(this)()
    }
    #subscriptions = new Set<() => void>() // holds unsubscribe callbacks
    disconnectedCallback() {
      this.#shadowObserver && this.#shadowObserver.disconnect()
      if (dev && this.#trigger)
        this.#trigger({
          type: `disconnected(${this.getAttribute(bpAddress) ?? this.tagName.toLowerCase()})`,
        })
      if (this.#subscriptions.size) {
        this.#subscriptions.forEach((unsubscribe) => {
          unsubscribe()
        })
        this.#subscriptions.clear()
      }
      disconnectedCallback && disconnectedCallback.bind(this)()
    }
    /** Manually disconnect subscription to messenger or publisher */
    #disconnect(cb: (() => void) | undefined) {
      const callback = cb ?? noop
      this.#subscriptions.add(callback)
      return () => {
        callback()
        this.#subscriptions.delete(callback)
      }
    }
    /** connect trigger to a Messenger or Publisher */
    #connect(comm: Messenger | Publisher) {
      if (trueTypeOf(comm) !== 'function') return noop // if comm is not a function return noop
      if (isPublisher(comm)) return this.#disconnect(comm.subscribe(this.trigger))
      const recipient = this.getAttribute(bpAddress)
      if (!recipient) {
        console.error(`Component ${this.tagName.toLowerCase()} is missing an attribute [${bpAddress}]`)
        return noop // if we're missing an address on our component return noop and console.error msg
      }
      return this.#disconnect(comm.connect(recipient, this.trigger))
    }
    /** emit a custom event cancelable and composed are true by default */
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
    /** delegate event listeners  for elements in list */
    #delegateListeners(elements: Element[]) {
      for (const el of elements) {
        if (el.tagName === 'SLOT' && el.hasAttribute('slot')) continue // skip nested slots
        !delegatedListener.has(el) && delegatedListener.set(
          el,
          (event) => {
            const triggerType = el.getAttribute(bpTrigger) && getTriggerType(event, el)
            triggerType ?
              /** if key is present in `bp-trigger` trigger event on instance's bProgram */
              this.#trigger?.({ type: triggerType, detail: event })
            : /** if key is not present in `bp-trigger` remove event listener for this event on Element */
              el.removeEventListener(event.type, delegatedListener.get(el))
          },
        ) // bind a callback for element if we haven't already
        for (const [event] of getTriggerMap(el)) {
          // add event listeners for each event type
          el.addEventListener(event, delegatedListener.get(el))
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
    /** Public trigger method allows triggers of only observedTriggers from outside component */
    trigger(args: BPEvent) {
      const name = this.dataset.address ?? this.tagName.toLowerCase()
      if (trueTypeOf(args) !== 'object') return console.error(`Invalid TriggerArg passed to Component [${name}]`)
      const { type, detail } = args
      if (!('type' in args)) return console.error(`TriggerArg missing [type]`)
      if (this.#observedTriggers.has(type)) return this.#trigger?.({ type, detail })
      return console.warn(`Component [${name}] is not observing trigger [${type}]`)
    }
  }
  Object.assign(Base.prototype, rest)
  const registry = new Set<PlaitedElementConstructor>([...template.registry, Base])
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
  ft.define = (silent = true) => defineRegistry(new Set<PlaitedElementConstructor>(registry), silent)
  ft.tag = _tag
  return ft
}
