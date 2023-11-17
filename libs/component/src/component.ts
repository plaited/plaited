/**
 * A function for instantiating PlaitedElements
 * @param {PlaitedElementOptions} options - Options for the PlaitedElement
 * @param {function} mixin - A function that takes a base PlaitedElementConstructor and returns a new constructor with additional functionality
 * @returns {void}
 * @alias cc
 */
import { createTemplate, FunctionTemplate } from '@plaited/jsx'
import { dataTarget, dataTrigger, dataAddress } from '@plaited/jsx/utils'
import { Trigger, bProgram, TriggerArgs } from '@plaited/behavioral'
import type {
  PlaitedElement,
  PlaitProps,
  ComponentFunction,
  Emit,
  Messenger,
  Publisher,
  SugaredElement,
} from './types.js'
import { assignSugar } from './sugar.js'
import { noop, trueTypeOf } from '@plaited/utils'

type TriggerElement = (HTMLElement | SVGElement) & {
  dataset: {
    trigger: string
  }
}
const isElement = (node: Node): node is TriggerElement => node.nodeType === 1
// Quickly traverse nodes observed in mutation selecting only those with data-trigger attribute
const traverseNodes = (node: Node, arr: TriggerElement[]) => {
  if (isElement(node)) {
    node.hasAttribute(dataTrigger) && arr.push(node)
    if (node.hasChildNodes()) {
      const childNodes = node.childNodes
      const length = childNodes.length
      for (let i = 0; i < length; i++) {
        traverseNodes(childNodes[i], arr)
      }
    }
  }
}

const getTriggerMap = (el: TriggerElement) =>
  new Map(el.dataset.trigger.split(' ').map((pair) => pair.split(':')) as [string, string][])

/** get trigger for elements respective event from triggerTypeMap */
const getTriggerType = (event: Event, context: TriggerElement) => {
  const el =
    context.tagName !== 'SLOT' && event.currentTarget === context
      ? context
      : event.composedPath().find((el) => el instanceof ShadowRoot) === context.getRootNode()
      ? context
      : undefined
  if (!el) return
  return getTriggerMap(el).get(event.type)
}
// Our delegated listener class implements handleEvent
class DelegatedListener {
  callback: (ev: Event) => void
  constructor(callback: (ev: Event) => void) {
    this.callback = callback
  }
  handleEvent(evt: Event) {
    this.callback(evt)
  }
}
// Weakly hold reference to our delegated elements and their callbacks
const delegates = new WeakMap()

const isPublisher = (obj: Publisher | Messenger): obj is Publisher => {
  return Object.hasOwn(obj, 'subscribe')
}
/**
 * Creates a PlaitedComponent
 * @param {object} args - Arguments for the PlaitedComponent
 * @param {string} args.tag - The tag name of the component
 * @param {FunctionTemplate} args.template - The template function for the component
 * @param {boolean | DevCallback} args.dev - A callback function that receives a stream of state snapshots, last selected event, and trigger.
 * @param {Strategy} args.strategy - The event selection strategy to use. Defaults to `strategies.priority`.
 * @returns {PlaitedComponent} A PlaitedComponent
 */
export const Component: ComponentFunction = ({
  mode = 'open',
  delegatesFocus = true,
  tag,
  template,
  dev,
  strategy,
  observedTriggers = [],
}) => {
  if (!tag) {
    throw new Error(`Component is missing a [tag]`)
  }
  const _tag = tag.toLowerCase()
  return class PlaitedComponent extends HTMLElement implements PlaitedElement {
    static tag = _tag
    static stylesheets = template.stylesheets
    static template: FunctionTemplate = ({ children = [], ...attrs }) =>
      createTemplate(tag, {
        ...attrs,
        children: [
          createTemplate('template', {
            shadowrootmode: mode,
            shadowrootdelegatesfocus: delegatesFocus,
            children: template,
          }),
          ...(Array.isArray(children) ? children : [children]),
        ],
      })
    #observedTriggers = new Set(observedTriggers)
    internals_: ElementInternals
    #root: ShadowRoot
    constructor() {
      super()
      if (!template) throw new Error(`Component [${tag}] is missing a [template]`)
      this.internals_ = this.attachInternals()
      if (this.internals_.shadowRoot) {
        this.#root = this.internals_.shadowRoot
      } else {
        this.#root = this.attachShadow({ mode, delegatesFocus })
        const { content, stylesheets } = template
        this.#root.innerHTML = content
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
      this.trigger = this.trigger.bind(this)
    }
    plait?(props: PlaitProps): void | Promise<void>
    #trigger?: Trigger
    #shadowObserver?: MutationObserver
    connectedCallback() {
      if (this.plait) {
        const { trigger, ...rest } = bProgram({ strategy, dev })
        this.#trigger = trigger // listeners need trigger to be available on instance
        this.#delegateListeners(
          // just connected/upgraded then delegate listeners nodes with data-trigger attribute
          Array.from(this.#root.querySelectorAll<TriggerElement>(`[${dataTrigger}]`)),
        )
        this.#shadowObserver = this.#createShadowObserver() // create a shadow observer to watch for modification & addition of nodes with data-trigger attribute
        dev &&
          trigger({
            type: `connected->${this.dataset.address ?? this.tagName.toLowerCase()}`,
          })
        void this.plait({
          $: this.$.bind(this),
          host: this,
          emit: this.#emit.bind(this),
          connect: this.#connect.bind(this),
          trigger,
          ...rest,
        })
      }
    }
    #subscriptions = new Set<() => void>() // holds unsubscribe callbacks
    disconnectedCallback() {
      this.#shadowObserver && this.#shadowObserver.disconnect()
      if (dev && this.#trigger)
        this.#trigger({
          type: `disconnected->${this.dataset.address ?? this.tagName.toLowerCase()}`,
        })
      this.#subscriptions.forEach((unsubscribe) => unsubscribe())
      this.#subscriptions.clear()
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
      const recipient = this.dataset.address
      if (!recipient) {
        console.error(`Component ${this.tagName.toLowerCase()} is missing an attribute [${dataAddress}]`)
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
    /** If delegated listener does not have element then delegate it's callback with auto cleanup*/
    #createDelegatedListener(el: TriggerElement) {
      delegates.set(
        el,
        new DelegatedListener((event) => {
          //
          const triggerType = getTriggerType(event, el)
          triggerType
            ? /** if key is present in `data-trigger` trigger event on instance's bProgram */
              this.#trigger?.({
                type: triggerType,
                detail: event,
              })
            : /** if key is not present in `data-trigger` remove event listener for this event on Element */
              el.removeEventListener(event.type, delegates.get(el))
        }),
      )
    }
    /** delegate event listeners  for elements in list */
    #delegateListeners(elements: TriggerElement[]) {
      for (const el of elements) {
        if (el.tagName === 'SLOT' && el.hasAttribute('slot')) continue // skip nested slots
        !delegates.has(el) && this.#createDelegatedListener(el) // bind a callback for element if we haven't already
        for (const [event] of getTriggerMap(el)) {
          // add event listeners for each event type
          el.addEventListener(event, delegates.get(el))
        }
      }
    }
    /**  Observes the addition of nodes to the shadow dom and changes to and child's data-trigger attribute */
    #createShadowObserver() {
      const mo = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'attributes') {
            const el = mutation.target
            if (isElement(el)) {
              mutation.attributeName === dataTrigger && this.#delegateListeners([el])
            }
          } else if (mutation.addedNodes.length) {
            const list: TriggerElement[] = []
            const length = mutation.addedNodes.length
            for (let i = 0; i < length; i++) {
              traverseNodes(mutation.addedNodes[i], list)
            }
            this.#delegateListeners(list)
          }
        }
      })
      mo.observe(this.#root, {
        attributeFilter: [dataTrigger],
        childList: true,
        subtree: true,
      })
      return mo
    }
    /** Public trigger method allows triggers of only observedTriggers from outside component */
    trigger(args: TriggerArgs) {
      const name = this.dataset.address ?? this.tagName.toLowerCase()
      if (trueTypeOf(args) !== 'object') return console.error(`Invalid TriggerArg passed to Component [${name}]`)
      const { type, detail } = args
      if (!Object.hasOwn(args, 'type')) return console.error(`TriggerArg missing [type]`)
      if (this.#observedTriggers.has(type)) return this.#trigger?.({ type, detail })
      return console.warn(`Component [${name}] is not observing trigger [${type}]`)
    }
    /** we're bringing the bling back!!! */
    $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(target: string, match = '='): SugaredElement<T>[] {
      return assignSugar<T>(
        Array.from(this.#root.querySelectorAll<HTMLElement | SVGElement>(`[${dataTarget}${match}"${target}"]`)),
      )
    }
  }
}
