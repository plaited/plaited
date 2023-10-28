/**
 * A function for instantiating PlaitedElements
 * @param {PlaitedElementOptions} options - Options for the PlaitedElement
 * @param {function} mixin - A function that takes a base PlaitedElementConstructor and returns a new constructor with additional functionality
 * @returns {void}
 * @alias cc
 */
import { Template, dataTarget, dataTrigger } from '@plaited/jsx'
import { Trigger } from '@plaited/behavioral'
import { initBProgram } from './init-b-program.js'
import {
  PlaitedElement,
  PlaitedElementConstructor,
  CreateComponent,
  PlaitProps,
  SelectorMod,
} from './types.js'
import { delegatedListener } from './delegated-listener.js'
import { assignSugar, SugaredElement, assignSugarForEach, createTemplateElement } from './sugar.js'

const regexp = /\b[\w-]+\b(?=->[\w-]+)/g
// It takes the value of a data-target attribute and return all the events happening in it. minus the method identifier
// so iof the event was data-target="click->doSomething" it would return ["click"]
const matchAllEvents = (str: string) => {
  return  Array.from(str.matchAll(regexp), match => match[0])
}
// returns the request/action name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// note triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
const getTriggerType = (
  e: Event,
  context: HTMLElement | SVGElement
): string => {
  const el = e.currentTarget === context
    ? context
    // check if closest slot from the element that invoked the event is the instances slot
    : e.composedPath().find(slot =>
      ((slot as Element)?.tagName === 'SLOT') && slot ===
          context
    )
    ? context
    : undefined

  if (!el) return ''
  const pre = `${e.type}->`
  const trigger = el.dataset.trigger ?? ''
  const key = trigger.trim().split(/\s+/).find((str: string) =>
    str.includes(pre)
  )
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
const observedTriggersCache = new WeakMap<PlaitedElement, [string, string][]>()
// Check if instance's constructor has any observedTriggers
const getObservedTriggerEntries = (host: PlaitedElement) => {
  if(observedTriggersCache.has(host)) return observedTriggersCache.get(host)
  const observedTriggers = (host.constructor as PlaitedElementConstructor)?.observedTriggers
  if(!observedTriggers) return
  const entries = Object.entries(observedTriggers)
  if(entries.length) {
    observedTriggersCache.set(host, entries)
    return entries
  }
}
/**
 * A typescript function for instantiating PlaitedElements
 */
export const createComponent:CreateComponent = (
  {
    mode = 'open',
    delegatesFocus = true,
    tag,
    ...bProgramOptions
  },
  mixin = base =>
    class extends base {}
) => {
  const _tag = tag.toLowerCase()
  //  Adds a definition for Plaited Element to the custom element registry
  const define = () => {
    if (customElements.get(_tag)) {
      console.error(`${_tag} already defined`)
      return
    }
    customElements.define(
      _tag,
      mixin(
        class extends HTMLElement implements PlaitedElement {
          #shadowObserver?: MutationObserver
          #templateObserver?: MutationObserver
          #disconnect?: () => void
          internals_: ElementInternals
          #trigger: Trigger
          plait?(props: PlaitProps): void | Promise<void>
          static template?: Template
          static observedTriggers?: Record<string, string>
          #root: ShadowRoot
          #template = (this.constructor as PlaitedElementConstructor).template
          constructor() {
            super()
            this.internals_ = this.attachInternals()
            if (this.internals_.shadowRoot) {
              this.#root = this.internals_.shadowRoot
            } else {
              /** no declarative shadow dom then create a shadowRoot */
              this.#root = this.attachShadow({ mode, delegatesFocus })
            }
            if(this.#template) {
              const { content, stylesheets } = this.#template
              const adoptedStyleSheets: CSSStyleSheet[]  = []
              for(const style of stylesheets) {
                const sheet = new CSSStyleSheet()
                sheet.replaceSync(style)
                adoptedStyleSheets.push(sheet)
              }
              this.#root.adoptedStyleSheets = adoptedStyleSheets
              const tpl = createTemplateElement(content)
              this.#root.replaceChildren(tpl.content.cloneNode(true))
            }
          }
          connectedCallback() {
            if (!this.#template || !this.internals_.shadowRoot?.firstChild) {
              const template = this.querySelector<HTMLTemplateElement>(
                'template[shadowrootmode]'
              )
              template
                ? this.#appendTemplate(template)
                : (this.#templateObserver = this.#createTemplateObserver())
            }
            if (this.plait) {
              const { disconnect, trigger, ...rest } = initBProgram(
                {
                  host: this,
                  ...bProgramOptions,
                }
              )
              this.#trigger = trigger // listeners need trigger to be available on instance
              this.#delegateObservedTriggers() //just connected/upgraded then delegate observed triggers
              this.#delegateListeners( // just connected/upgraded then delegate listeners nodes with data-trigger attribute
                Array.from(this.#root.querySelectorAll<HTMLElement>(
                  `[${dataTrigger}]`
                ))
              )
              this.#disconnect = disconnect
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
            this.#templateObserver && this.#templateObserver.disconnect()
            this.#shadowObserver && this.#shadowObserver.disconnect()
            if (this.#disconnect) {
              this.#trigger({
                type: `disconnected->${this.id || this.tagName.toLowerCase()}`,
              })
              this.#disconnect()
            }
          }
          #delegateObservedTriggers() {
            const observedEntries = getObservedTriggerEntries(this)
            if(observedEntries) {
              !delegatedListener.has(this) && this.#createDelegatedListener(this)
              for (const [ event ] of observedEntries) {
                this.addEventListener(event, delegatedListener.get(this))
              }
            }
          }
          #getObservedTriggerType(el: HTMLElement | SVGElement, event:Event) {
            if(el !== this) return
            const entries = getObservedTriggerEntries(this)
            if(entries) {
              const entry = entries.find(([ key ]) => key === event.type)
              if(entry) return entry[1]
            }
          }
          #delegateListeners(nodes:Node[]) {
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
            delegatedListener.set(el, event => { // Delegated listener does not have element then delegate it's callback
              const triggerType = getTriggerType(event, el) || this.#getObservedTriggerType(el, event)
              triggerType
                /** if key is present in `data-trigger` trigger event on instance's bProgram */
                ? this.#trigger<Event>({
                  type: triggerType,
                  detail: event,
                })
                /** if key is not present in `data-trigger` remove event listener for this event on Element */
                : el.removeEventListener(
                  event.type,
                  delegatedListener.get(el)
                )
            })
          }
          // Observes the addition of nodes to the shadow dom and changes to and child's data-trigger attribute
          #createShadowObserver() {
            const mo = new MutationObserver(mutationsList => {
              for (const mutation of mutationsList) {
                if (mutation.type === 'attributes') {
                  const el = mutation.target
                  if (el.nodeType === 1) {
                    this.#delegateListeners([ el ])
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
              attributeFilter: [ dataTrigger ],
              childList: true,
              subtree: true,
            })
            return mo
          }
          #appendTemplate(template: HTMLTemplateElement) {
            !this.#root.firstChild &&
              this.#root.appendChild(
                document.importNode(template.content, true)
              )
            template.remove()
          }
          #createTemplateObserver() {
            const mo = new MutationObserver(() => {
              const template = this.querySelector<HTMLTemplateElement>(
                'template[shadowrootmode]'
              )
              if (template) {
                mo.disconnect()
                this.#appendTemplate(template)
              }
            })
            mo.observe(this, { childList: true })
            return mo
          }
          /** we're bringing the bling back!!! */
          $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
            target: string,
            opts?: {
              all?: false;
              mod?: SelectorMod;
            }
          ): SugaredElement<T> | undefined;
          $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
            target: string,
            opts?: {
              all: true;
              mod?: SelectorMod;
            },
          ): SugaredElement<T>[];
          $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
            target: string,
            { all = false, mod = '=' } = {}
          ):
            | SugaredElement<T>
            | undefined
            | SugaredElement<T>[] {
            const selector = `[${dataTarget}${mod}"${target}"]`
            if (all) {
              return assignSugarForEach(this.#root.querySelectorAll<T>(selector))
            }
            const element = this.#root.querySelector<T>(selector)
            if (!element) return
            return assignSugar<T>(element)        
          }
        }   
      )
    )
  }
  define.tag = _tag
  return define
}

/**
 * This function is an alias for {@link createComponent}.
 * @function
 * @see {@link createComponent}
 */
export const cc = createComponent
