/// <reference lib="dom.iterable" />
import { dataTarget, dataTrigger } from './constants.ts'
import { delegatedListener } from './delegated-listener.ts'
import { Trigger } from '../plait/mod.ts'
import { Query } from './types.ts'

// It takes the value of a data-target attribute and return all the events happening in it. minus the method identifier
// so iof the event was data-target="click->doSomething" it would return ["click"]
const matchAllEvents = (str: string) => {
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g
  return [...str.matchAll(regexp)].flatMap(([, event]) => event)
}

// returns the request/action name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// note triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
const getTriggerKey = (evt: Event) => {
  const el = evt.currentTarget
  const type = evt.type
  const pre = `${type}->`
  //@ts-ignore: will be HTMLOrSVGElement
  return el.dataset.trigger
    .trim()
    .split(/\s+/)
    .find((str: string) => str.includes(pre))
    .replace(pre, '')
}

// Takes a list of nodes added when mutation observer change happened and filters our the ones with triggers
const filterAddedNodes = (nodes: NodeList) => {
  const elements: HTMLElement[] = []
  nodes.forEach((node) => {
    if (node instanceof HTMLElement && node.dataset.trigger) elements.push(node)
  })
  return elements
}

interface IslandElement {
  plait?: ($: Query) => {
    trigger: Trigger
    disconnect: () => void
  }
}

interface Base {
  $<T = Element>(id: string): T[] | never[]
}

type BaseConstructor = new () => Base

type IslandConstructor = new () => IslandElement
/**
 *  Define Island function
 */
export const defineIsland = (
  tag: `${string}-${string}`,
  mixin: (
    base: CustomElementConstructor & BaseConstructor,
  ) => CustomElementConstructor & IslandConstructor,
) => {
  if (customElements.get(tag)) return
  class ISLElement extends HTMLElement {
    #noDeclarativeShadow = false
    #shadowObserver?: MutationObserver
    #templateObserver?: MutationObserver
    #disconnect?: () => void
    internals_: ElementInternals
    #trigger?: Trigger
    plait?: ($: ISLElement['$']) => {
      trigger: Trigger
      disconnect: () => void
    }
    constructor(
      mode?: 'open' | 'closed',
      delegatesFocus?: boolean,
    ) {
      super()
      this.internals_ = this.attachInternals()
      const shadow = this.internals_.shadowRoot
      if (!shadow) {
        this.attachShadow({ mode: mode || 'open', delegatesFocus })
        this.#noDeclarativeShadow = true
      }
      this.$ = this.$.bind(this)
    }
    connectedCallback() {
      if (this.#noDeclarativeShadow) {
        const template = this.querySelector<HTMLTemplateElement>(
          'template[shadowroot]',
        )
        template
          ? this.#appendTemplate(template)
          : (this.#templateObserver = this.#createTemplateObserver())
      }
      this.#delegateListeners()
      this.#shadowObserver = this.#createShadowObserver()
      let disconnect: undefined | (() => void) = undefined
      let trigger: undefined | Trigger
      this.plait && ({ disconnect, trigger } = this.plait(this.$))
      disconnect && (this.#disconnect = disconnect)
      trigger && (this.#trigger = trigger)
      this.#trigger && this.#trigger({
        type: `connected->${this.id || this.tagName.toLowerCase()}`,
      })
    }
    disconnectedCallback() {
      this.#trigger &&
        this.#trigger({
          type: `disconnected->${this.id || this.tagName.toLowerCase()}`,
        })
      this.#templateObserver && this.#templateObserver.disconnect()
      this.#shadowObserver && this.#shadowObserver.disconnect()
      this.#disconnect && this.#disconnect()
    }
    #delegateListeners(nodes?: HTMLElement[]) {
      const triggers = nodes ||
        (this.shadowRoot as ShadowRoot).querySelectorAll(`[${dataTrigger}]`)
      triggers.forEach((el) => {
        if (!delegatedListener.has(el)) {
          delegatedListener.set(el, (evt) => {
            const triggerKey = getTriggerKey(evt)
            triggerKey && this.#trigger && this.#trigger({
              type: triggerKey,
              data: evt,
            })
          })
        }
        //@ts-ignore: will be HTMLOrSVGElement
        const events = matchAllEvents(el.dataset.trigger)
        for (const event of events) {
          el.addEventListener(event, delegatedListener.get(el))
        }
      })
    }
    // Observes the addition of nodes to the shadow dom and changes to and child's data-trigger attribute
    #createShadowObserver() {
      const mo = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.addedNodes.length) {
            this.#delegateListeners(filterAddedNodes(mutation.addedNodes))
          }
          if (mutation.type === 'attributes') {
            this.#delegateListeners()
          }
        }
      })
      mo.observe(this, {
        attributeFilter: [dataTrigger],
        childList: true,
        subtree: true,
      })
      return mo
    }
    #appendTemplate(template: HTMLTemplateElement) {
      const root = this.shadowRoot as ShadowRoot
      !root.firstChild &&
        root.appendChild(document.importNode((template).content, true))
    }
    #createTemplateObserver() {
      const mo = new MutationObserver(() => {
        const template = this.querySelector<HTMLTemplateElement>(
          'template[shadowroot]',
        )
        if (template) {
          mo.disconnect()
          this.#appendTemplate(template as HTMLTemplateElement)
        }
      })
      mo.observe(this, { childList: true })
      return mo
    }
    $<T = Element>(id: string): T[] | never[] {
      const selection = this.shadowRoot
        ? this.shadowRoot.querySelectorAll(
          `[${dataTarget}="${id}"]`,
        ) as unknown as T[]
        : []
      return [...selection]
    }
  }
  customElements.define(
    tag,
    mixin(ISLElement),
  )
}
