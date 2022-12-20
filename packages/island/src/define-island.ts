import {
  Track,
  baseDynamics,
  TriggerArgs,
  RulesFunc,
  TriggerFunc,
  Listener,
  Strategy,
} from '@plaited/behavioral'
import { dataTarget, dataTrigger } from './constants.js'
import { delegatedListener } from './delegated-listener.js'

export type Actions = (args: {
  $: (selector: string) => Element[],
  root: ShadowRoot
}) => Record<string, (payload?: any) => void>

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

const createIsland = ({
  tag,
  actions,
  connect,
  logger,
  mode = 'open',
  delegatesFocus,
  strands = {},
  strategy,
}:{
  tag: string
  actions?: Actions
  strands?: Record<string, RulesFunc>
  connect?: (recipient: string, cb: TriggerFunc) => () => void
  /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
  delegatesFocus?: boolean
  logger?: Listener
  strategy?: Strategy;
}) => class extends HTMLElement {
  #noDeclarativeShadow = false
  #trigger:  ({ eventName, payload, baseDynamic }: TriggerArgs) => void
  #id: string
  #shadowObserver: MutationObserver
  #templateObserver: MutationObserver
  internals_: ElementInternals
  #disconnect?: () => void 
  constructor() {
    super()
    this.internals_ = this.attachInternals()
    const shadow = this.internals_.shadowRoot
    if(!shadow) {
      this.attachShadow({ mode, delegatesFocus })
      this.#noDeclarativeShadow = true
    }
  }
  get #root(): ShadowRoot {
    return this.shadowRoot as ShadowRoot
  }
  random() {return this}
  connectedCallback() {
    const { feedback, trigger, stream } = new Track(strands, { strategy, dev: Boolean(logger) })
    this.#trigger = trigger
    logger && stream.subscribe(logger)
    const $ = (id: string) => {
      return [ ...(this.#root.querySelectorAll(`[${dataTarget}="${id}"]`)) ]
    }
    actions && feedback(actions({ $, root: this.#root }))
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
}

type CreateIslandParams = Parameters<typeof createIsland>[0]
export type BaseIsland = ReturnType<typeof createIsland>

export interface DefineIslandParams extends CreateIslandParams {
  mixin?: (base: BaseIsland) => CustomElementConstructor
}

export const defineIsland = ({ mixin, ...config }:DefineIslandParams) => {
  const tag = config.tag
  if (customElements.get(tag)) return
  customElements.define(tag, mixin ? mixin(createIsland(config)) : createIsland(config)) 
}
