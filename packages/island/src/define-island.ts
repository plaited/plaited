import { Track, baseDynamics, TriggerArgs } from '@plaited/behavioral'
import { dataTarget, dataTrigger } from './constants'
import { delegatedListener } from './delegated-listener'
import { DefineIsland } from './types'
const matchAllEvents = (str: string) =>{
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g
  return [ ...str.matchAll(regexp) ].flatMap(([ , event ]) => event)
}
const getTriggerKey = (evt: Event) =>{
  const el = evt.currentTarget
  const type = evt.type
  //@ts-ignore: will be HTMLOrSVGElement
  return  el.dataset.trigger
    .trim()
    .split(/\s+/)
    .find((str: string) => str.includes(`${type}->`))
}

const filterAddedNodes = (nodes:NodeList) => {
  const elements:HTMLElement[] = []
  nodes.forEach(node => {
    if(node instanceof HTMLElement && node.dataset.trigger) elements.push(node)
  })
  return elements
}

export const defineIsland: DefineIsland = (
  tag,
  {
    actions,
    connect,
    logger,
    mode = 'open',
    delegatesFocus,
    strands = {},
    strategy,
  }
) => {
  if (customElements.get(tag)) return
  customElements.define(tag, class extends HTMLElement {
    #noDeclarativeShadow = false
    #trigger:  ({ eventName, payload, baseDynamic }: TriggerArgs) => void
    #id: string
    #shadowObserver: MutationObserver
    #templateObserver: MutationObserver
    #disconnect?: () => void 
    constructor() {
      super()
      const internals = this.attachInternals()
      const shadow = internals.shadowRoot
      if(!shadow) {
        this.attachShadow({ mode, delegatesFocus })
        this.#noDeclarativeShadow = true
      }
    }
    get #root(): ShadowRoot {
      return this.shadowRoot as ShadowRoot
    }
    connectedCallback() {
      const { feedback, trigger, stream } = new Track(strands, { strategy, dev: Boolean(logger) })
      this.#trigger = trigger
      logger && stream.subscribe(logger)
      const $ = (id: string) => {
        return [ ...(this.#root.querySelectorAll(`[${dataTarget}="${id}"]`)) ]
      }
      feedback(actions({ $, root: this.#root }))
      this.#id = this.id || tag
      if(connect){
        this.#disconnect = connect(this.#id, trigger)
        this.#trigger({ eventName: `connected->${this.#id}`, baseDynamic: baseDynamics.objectObject })
      }
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
      if (this.#disconnect) {
        this.#disconnect()
        this.#trigger({ eventName: `disconnected->${this.#id}`, baseDynamic: baseDynamics.objectObject })
      }
      this.#templateObserver && this.#templateObserver.disconnect()
      this.#shadowObserver.disconnect()
    }
    #delegateListeners(nodes?: HTMLElement[]) {
      const triggers = nodes || this.#root.querySelectorAll(`[${dataTrigger}]`)
      triggers.forEach(el => {
        if(!delegatedListener.has(el)) {
          delegatedListener.set(el, evt => {
            const triggerKey = getTriggerKey(evt)
            triggerKey && this.#trigger({
              eventName: triggerKey,
              payload: evt,
              baseDynamic: baseDynamics.objectPerson,
            })
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
      const root = this.#root
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
  })
}
