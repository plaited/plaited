/**
 * A function for instantiating PlaitedElements
 * @param {PlaitedElementOptions} options - Options for the PlaitedElement
 * @param {function} mixin - A function that takes a base PlaitedElementConstructor and returns a new constructor with additional functionality
 * @returns {void}
 * @alias cc
 */
import { createTemplate, FunctionTemplate, AdditionalAttrs } from '@plaited/jsx'
import { dataTarget, dataTrigger, dataAddress } from '@plaited/jsx/utils'
import { Trigger, bProgram, TriggerArgs } from '@plaited/behavioral'
import {
  PlaitedElement,
  PlaitProps,
  ComponentFunction,
  PlaitedComponentConstructor,
  Emit,
  Messenger,
  Publisher,
} from './types.js'
import { assignSugar, SugaredElement, assignSugarForEach, createTemplateElement } from './sugar.js'
import { trueTypeOf } from '@plaited/utils'

const regexp = /\b[\w-]+\b(?=->[\w-]+)/g
// It takes the value of a data-target attribute and return all the events happening in it. minus the method identifier
// so iof the event was data-target="click->doSomething" it would return ["click"]
const matchAllEvents = (str: string) => {
  return Array.from(str.matchAll(regexp), (match) => match[0])
}
// returns the request/action name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// note triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
const getTriggerType = (e: Event, context: HTMLElement | SVGElement): string => {
  const el =
    context.tagName !== 'SLOT' && e.currentTarget === context
      ? context
      : e.composedPath().find((el) => el instanceof ShadowRoot) === context.getRootNode()
      ? context
      : undefined

  if (!el) return ''
  const pre = `${e.type}->`
  const trigger = el.dataset.trigger ?? ''
  const key = trigger
    .trim()
    .split(/\s+/)
    .find((str: string) => str.includes(pre))
  return key ? key.replace(pre, '') : ''
}
// Quickly traverse nodes observed in mutation selecting only those with data-trigger attribute
const traverseNodes = (node: Node, arr: Node[]) => {
  if (node.nodeType === 1) {
    if ((node as Element).hasAttribute(dataTrigger) || node instanceof HTMLSlotElement) {
      arr.push(node)
    }
    if (node.hasChildNodes()) {
      const childNodes = node.childNodes
      const length = childNodes.length
      for (let i = 0; i < length; i++) {
        traverseNodes(childNodes[i], arr)
      }
    }
  }
}

class DelegatedListener {
  callback: (ev: Event) => void
  constructor(callback: (ev: Event) => void) {
    this.callback = callback
  }
  handleEvent(evt: Event) {
    this.callback(evt)
  }
}

const delegates = new WeakMap()

const isPublisher = (obj: Publisher | Messenger): obj is Publisher => {
  return Object.hasOwn(obj, 'subscribe')
}
const isMessenger = (obj: Publisher | Messenger): obj is Messenger => {
  return Object.hasOwn(obj, 'connect')
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
}) => {
  if (!tag) {
    throw new Error(`Component is missing a [tag]`)
  }
  const _tag = tag.toLowerCase()
  return class PlaitedComponent extends HTMLElement implements PlaitedElement {
    static tag = _tag
    static stylesheets = template.stylesheets
    static template: FunctionTemplate<AdditionalAttrs & { slots?: never }> = ({ slot: _, children, ...attrs }) =>
      createTemplate(tag, {
        ...attrs,
        children: template,
        slots: children,
        shadowrootmode: mode,
        shadowrootdelegatesfocus: delegatesFocus,
      })
    #shadowObserver?: MutationObserver
    internals_: ElementInternals
    #trigger?: Trigger
    plait?(props: PlaitProps): void | Promise<void>
    #root: ShadowRoot
    #observedTriggers = (this.constructor as PlaitedComponentConstructor).observedTriggers
    constructor() {
      super()
      this.internals_ = this.attachInternals()
      if (this.internals_.shadowRoot) {
        this.#root = this.internals_.shadowRoot
      } else {
        /** no declarative shadow dom then create a shadowRoot */
        this.#root = this.attachShadow({ mode, delegatesFocus })
      }
      if (!template) {
        throw new Error(`Component [${tag}] is missing a [template]`)
      }
      const { content, stylesheets } = template
      const adoptedStyleSheets: CSSStyleSheet[] = []
      for (const style of stylesheets) {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(style)
        adoptedStyleSheets.push(sheet)
      }
      this.#root.adoptedStyleSheets = adoptedStyleSheets
      const tpl = createTemplateElement(content)
      this.#root.replaceChildren(tpl.content)
    }
    connectedCallback() {
      if (this.plait) {
        const { trigger, ...rest } = bProgram({
          strategy,
          dev,
        })
        this.#trigger = trigger // listeners need trigger to be available on instance
        this.#delegateListeners(
          // just connected/upgraded then delegate listeners nodes with data-trigger attribute
          Array.from(this.#root.querySelectorAll<HTMLElement>(`[${dataTrigger}]`)),
        )
        this.#shadowObserver = this.#createShadowObserver()
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
    disconnectedCallback() {
      this.#shadowObserver && this.#shadowObserver.disconnect()
      if (dev && this.#trigger)
        this.#trigger({
          type: `disconnected->${this.dataset.address ?? this.tagName.toLowerCase()}`,
        })
      this.#subscriptions.forEach((unsubscribe) => unsubscribe())
    }
    #subscriptions = new Set<() => void>()
    /** connect to a Messenger */
    #connect(comm: Messenger | Publisher) {
      if (trueTypeOf(comm) !== 'function') return
      const trigger = (args: TriggerArgs) => {
        if (trueTypeOf(args) !== 'object' || !Object.hasOwn(args, 'type')) return
        const { type, detail } = args
        if (this.#observedTriggers?.has(type)) {
          this.#trigger?.({ type, detail })
        }
      }
      if (isMessenger(comm)) {
        const recipient = this.dataset.address
        if (!recipient) {
          console.error(`Component ${this.tagName.toLowerCase()} is missing an attribute [${dataAddress}]`)
          return
        }
        const disconnect = comm.connect(recipient, trigger)
        disconnect && this.#subscriptions.add(disconnect)
        return disconnect
      }
      if (isPublisher(comm)) {
        const disconnect = comm.subscribe(trigger)
        disconnect && this.#subscriptions.add(disconnect)
        return disconnect
      }
    }
    /** emit a custom event */
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
    #delegateListeners(nodes: Node[]) {
      for (const el of nodes) {
        if (el.nodeType !== 1) continue // Skip non-element nodes
        const element = el as HTMLElement | SVGElement
        if (element.tagName === 'SLOT' && element.hasAttribute('slot')) continue
        !delegates.has(el) && this.#createDelegatedListener(element)
        const triggers = element.dataset.trigger
        if (triggers) {
          const events = matchAllEvents(triggers) /** get event type */
          for (const event of events) {
            /** loop through and set event listeners on delegated object */
            el.addEventListener(event, delegates.get(el))
          }
        }
      }
    }
    #createDelegatedListener(el: HTMLElement | SVGElement) {
      delegates.set(
        el,
        new DelegatedListener((event) => {
          // Delegated listener does not have element then delegate it's callback
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
    // Observes the addition of nodes to the shadow dom and changes to and child's data-trigger attribute
    #createShadowObserver() {
      const mo = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'attributes') {
            const el = mutation.target
            if (el.nodeType === 1) {
              this.#delegateListeners([el])
            }
          } else if (mutation.addedNodes.length) {
            const list: Node[] = []
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
    trigger({ type, detail }: TriggerArgs) {
      this.#observedTriggers?.has(type) && this.#trigger?.({ type, detail })
    }
    /** we're bringing the bling back!!! */
    $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
      target: string,
      { all = false, mod = '=' } = {},
    ): SugaredElement<T> | undefined | SugaredElement<T>[] {
      const selector = `[${dataTarget}${mod}"${target}"]`
      if (all) {
        return assignSugarForEach(this.#root.querySelectorAll<T>(selector))
      }
      const element = this.#root.querySelector<T>(selector)
      if (!element) return
      return assignSugar<T>(element)
    }
  }
}
