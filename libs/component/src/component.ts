/**
 * A function for instantiating PlaitedElements
 * @param {PlaitedElementOptions} options - Options for the PlaitedElement
 * @param {function} mixin - A function that takes a base PlaitedElementConstructor and returns a new constructor with additional functionality
 * @returns {void}
 * @alias cc
 */
import { dataTarget, dataTrigger, dataAddress, createTemplate, FunctionTemplate, AdditionalAttrs } from '@plaited/jsx'
import { Trigger, bProgram, Log } from '@plaited/behavioral'
import { ComponentArgs, PlaitedElement, PlaitProps, SelectorMod, Connect } from './types.js'
import { delegatedListener } from './delegated-listener.js'
import { assignSugar, SugaredElement, assignSugarForEach, createTemplateElement } from './sugar.js'

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
    e.currentTarget === context
      ? context
      : // check if closest slot from the element that invoked the event is the instances slot
      e.composedPath().find((slot) => (slot as Element)?.tagName === 'SLOT' && slot === context)
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

// eslint-disable-next-line no-console
const log = (log: Log) => console.table(log)

export const Component = ({
  mode = 'open',
  delegatesFocus = true,
  tag,
  template,
  observedTriggers,
  dev,
  strategy,
  connect,
}: ComponentArgs) => {
  if (!tag) {
    throw new Error(`Component is missing a [tag]`)
  }
  const _tag = tag.toLowerCase()
  return class PlaitedComponent extends HTMLElement implements PlaitedElement {
    static tag = _tag
    static stylesheets = template.stylesheets
    static template: FunctionTemplate<AdditionalAttrs & { slots: never }> = ({ slot: _, children, ...attrs }) =>
      createTemplate(tag, {
        ...attrs,
        children: template,
        slots: children,
        shadowrootmode: mode,
        shadowrootdelegatesfocus: delegatesFocus,
      })
    #shadowObserver?: MutationObserver
    #disconnectMessenger?: ReturnType<Connect>
    internals_: ElementInternals
    #trigger: Trigger
    plait?(props: PlaitProps): void | Promise<void>
    #root: ShadowRoot
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
        const { trigger, ...rest } = this.#bProgram()
        this.#trigger = trigger // listeners need trigger to be available on instance
        this.#delegateObservedTriggers() //just connected/upgraded then delegate observed triggers
        this.#delegateListeners(
          // just connected/upgraded then delegate listeners nodes with data-trigger attribute
          Array.from(this.#root.querySelectorAll<HTMLElement>(`[${dataTrigger}]`)),
        )
        this.#shadowObserver = this.#createShadowObserver()
        void this.plait({
          $: this.$.bind(this),
          host: this,
          trigger,
          ...rest,
        })
      }
    }
    disconnectedCallback() {
      this.#shadowObserver && this.#shadowObserver.disconnect()
      this.#disconnectMessenger && this.#disconnectMessenger()
      this.#trigger({
        type: `disconnected->${this.dataset.address ?? this.tagName.toLowerCase()}`,
      })
    }
    #bProgram() {
      const { trigger, ...rest } = bProgram({
        strategy,
        dev: dev === true ? log : dev,
      })
      let disconnect: ReturnType<Connect>
      if (connect) {
        const recipient = this.dataset.address
        if (!recipient) {
          console.error(`Component ${this.tagName.toLowerCase()} is missing an attribute [${dataAddress}]`)
        }
        disconnect = connect(recipient, trigger)
      }
      trigger({
        type: `connected->${this.dataset.address ?? this.tagName.toLowerCase()}`,
      })
      this.#disconnectMessenger = disconnect
      return { trigger, ...rest }
    }
    #delegateObservedTriggers() {
      if (observedTriggers) {
        const entries = Object.entries(observedTriggers)
        !delegatedListener.has(this) && this.#createDelegatedListener(this)
        for (const [event] of entries) {
          this.addEventListener(event, delegatedListener.get(this))
        }
      }
    }
    #getObservedTriggerType(el: HTMLElement | SVGElement, event: Event) {
      if (el !== this) return
      if (observedTriggers) {
        const entries = Object.entries(observedTriggers)
        const entry = entries.find(([key]) => key === event.type)
        if (entry) return entry[1]
      }
    }
    #delegateListeners(nodes: Node[]) {
      for (const el of nodes) {
        if (el.nodeType !== 1) continue // Skip non-element nodes
        const element = el as HTMLElement | SVGElement
        if (element.tagName === 'SLOT' && element.hasAttribute('slot')) continue
        !delegatedListener.has(el) && this.#createDelegatedListener(element)
        const triggers = element.dataset.trigger
        if (triggers) {
          const events = matchAllEvents(triggers) /** get event type */
          for (const event of events) {
            /** loop through and set event listeners on delegated object */
            el.addEventListener(event, delegatedListener.get(el))
          }
        }
      }
    }
    #createDelegatedListener(el: HTMLElement | SVGElement) {
      delegatedListener.set(el, (event) => {
        // Delegated listener does not have element then delegate it's callback
        const triggerType = getTriggerType(event, el) || this.#getObservedTriggerType(el, event)
        triggerType
          ? /** if key is present in `data-trigger` trigger event on instance's bProgram */
            this.#trigger<Event>({
              type: triggerType,
              detail: event,
            })
          : /** if key is not present in `data-trigger` remove event listener for this event on Element */
            el.removeEventListener(event.type, delegatedListener.get(el))
      })
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
    /** we're bringing the bling back!!! */
    $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
      target: string,
      opts?: {
        all?: false
        mod?: SelectorMod
      },
    ): SugaredElement<T> | undefined
    $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
      target: string,
      opts?: {
        all: true
        mod?: SelectorMod
      },
    ): SugaredElement<T>[]
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
