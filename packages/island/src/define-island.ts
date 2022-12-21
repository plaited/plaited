import { dataTrigger, dataTarget } from './constants.js'
import { delegatedListener } from './delegated-listener.js'

const matchAllEvents = (str: string) =>{
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g
  return [ ...str.matchAll(regexp) ].flatMap(([ , event ]) => event)
}

const getTriggerMethod = (evt: Event) =>{
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

const filterAddedNodes = (nodes:NodeList) => {
  const elements:HTMLElement[] = []
  nodes.forEach(node => {
    if(node instanceof HTMLElement && node.dataset.trigger) elements.push(node)
  })
  return elements
}

export class BaseIsland extends HTMLElement {
  #noDeclarativeShadow = false
  #shadowObserver: MutationObserver
  #templateObserver: MutationObserver
  internals_: ElementInternals
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
  }
  disconnectedCallback() {
    this.#templateObserver && this.#templateObserver.disconnect()
    this.#shadowObserver.disconnect()
  }
  #delegateListeners(nodes?: HTMLElement[]) {
    const triggers = nodes || (this.shadowRoot as ShadowRoot).querySelectorAll(`[${dataTrigger}]`)
    triggers.forEach(el => {
      if(!delegatedListener.has(el)) {
        delegatedListener.set(el, evt => {
          const method = getTriggerMethod(evt)
          //@ts-ignore: this method will be implemented byt the subclass
          this[method](evt)
        })
      }
      //@ts-ignore: will be HTMLOrSVGElement
      const triggers = matchAllEvents(el.dataset.trigger)
      for (const event of triggers) {
        el.addEventListener(event, delegatedListener.get(el))
      }
    })
  }
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

export const defineIsland = (tag: string, mixin: (base: typeof BaseIsland) => CustomElementConstructor) => {
  if (customElements.get(tag)) return
  customElements.define(tag, mixin(BaseIsland))
}
