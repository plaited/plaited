import { dataTrigger, dataTarget } from './constants.js'
import { delegatedListener } from './delegated-listener.js'
import { TriggerFunc, TriggerArgs } from '@plaited/plait'
import { noop } from '@plaited/utils'

// It takes the value of a data-target attribute and return all the events happening in it. minus the method idetenfier
// so iof the event was data-target="click->doSomething" it would return ["click"]
const matchAllEvents = (str: string) =>{
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g
  return [ ...str.matchAll(regexp) ].flatMap(([ , event ]) => event)
}

// returns the method name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// not triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
const getTriggerMethod = (evt: Event) => {
  const el = evt.currentTarget
  const type = evt.type
  const pre = `${type}->`
  //@ts-ignore: will be HTMLOrSVGElement
  return  el.dataset.trigger
    .trim()
    .split(/\s+/)
    .find((str: string) => str.includes(pre))
    .replace(pre, '')
}

// Takes a list of nodes added when mutation observer change happened and filters our the ones with triggers
const filterAddedNodes = (nodes:NodeList) => {
  const elements:HTMLElement[] = []
  nodes.forEach(node => {
    if(node instanceof HTMLElement && node.dataset.trigger) elements.push(node)
  })
  return elements
}

export type Plaited = {
  trigger?: TriggerFunc,
  disconnect?: () => void
}

export type Query = (selector: string) => Element[]

export class BaseComponent extends HTMLElement {
  #noDeclarativeShadow = false
  #shadowObserver: MutationObserver
  #templateObserver: MutationObserver
  #disconnect?: () => void 
  internals_: ElementInternals
  #trigger?: TriggerFunc
  constructor(
    mode?: 'open' | 'closed',
    delegatesFocus?: boolean
  ) {
    super()
    this.internals_ = this.attachInternals()
    const shadow = this.internals_.shadowRoot
    if(!shadow) {
      this.attachShadow({ mode: mode || 'open', delegatesFocus })
      this.#noDeclarativeShadow = true
    }
    this.$ = this.$.bind(this)
  }
  connectedCallback() {
    if(this.#noDeclarativeShadow) {
      const template = this.querySelector<HTMLTemplateElement>('template[shadowroot]')
        template
          ? this.#appendTemplate(template)
          : (this.#templateObserver = this.#createTemplateObserver())
    }
    this.#delegateListeners()
    this.#shadowObserver = this.#createShadowObserver()
    const {  disconnect, trigger } = this.plait(this.$, this)
    this.#disconnect = disconnect
    this.#trigger = trigger
  }
  plait($: Query,
    context: this
  ): Plaited{
    return {
      disconnect: noop,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      trigger: (args:TriggerArgs) =>{},
    }
  }
  disconnectedCallback() {
    this.#templateObserver && this.#templateObserver.disconnect()
    this.#shadowObserver.disconnect()
    this.#disconnect && this.#disconnect()
  }
  #delegateListeners(nodes?: HTMLElement[]) {
    const triggers = nodes || (this.shadowRoot as ShadowRoot).querySelectorAll(`[${dataTrigger}]`)
    triggers.forEach(el => {
      if(!delegatedListener.has(el)) {
        delegatedListener.set(el, evt => {
          const method = getTriggerMethod(evt)
          if(method === 'plait') {
            console.error('plait is a reserved method')
            return
          }
          method in this && // need to test if I can use this.hasOwnProperty()
          typeof this[method as keyof this] === 'function' &&
          //@ts-ignore: is callable
          this[method](evt, this.#trigger)
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
    const mo = new MutationObserver(mutationsList => {
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
      attributeFilter: [ dataTrigger ],
      childList: true,
      subtree: true,
    })
    return mo
  }
  #appendTemplate(template: HTMLTemplateElement){
    const root = this.shadowRoot as ShadowRoot
    !root.firstChild && root.appendChild(document.importNode((template).content, true))
  }
  #createTemplateObserver() {
    const mo = new MutationObserver(() => {
      const template = this.querySelector<HTMLTemplateElement>('template[shadowroot]')
      if(template) {
        mo.disconnect()
        this.#appendTemplate(template as HTMLTemplateElement)
      }
    })
    mo.observe(this, { childList: true })
    return mo
  }
  $(id: string) {
    return [ ...((this.shadowRoot as ShadowRoot).querySelectorAll(`[${dataTarget}="${id}"]`)) ]
  }
}

export const defineComponent = (tag: string, mixin: (base: typeof BaseComponent) => CustomElementConstructor) => {
  if (customElements.get(tag)) return
  customElements.define(tag, mixin(BaseComponent))
}
