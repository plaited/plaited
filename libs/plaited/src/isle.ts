import { createTemplate, dataTarget, dataTrigger, Fragment } from '@plaited/jsx'
import { trueTypeOf } from '@plaited/utils'
import { Trigger } from '@plaited/behavioral'
import { useBehavioral } from './use-behavioral.js'
import {
  ISLElement,
  ISLElementConstructor,
  ISLElementOptions,
  PlaitProps,
  DataSlotPayload,
} from './types.js'
import { delegatedListener } from './delegated-listener.js'
import { sugar, SugaredElement, sugarForEach } from './use-sugar.js'
import {
  compileElementData,
  getTriggerKey,
  matchAllEvents,
  traverseNodes,
  dataSlotSelector,
} from './isle-utils.js'

/**
 * A typescript function for instantiating Plaited Island Elements
 */
export const isle = (
  {
    mode = 'open',
    delegatesFocus = true,
    tag,
    ...bProgramOptions
  }: ISLElementOptions,
  mixin: (base: ISLElementConstructor) => ISLElementConstructor = base =>
    class extends base {}
) => {
  const define = () => {
    if (customElements.get(tag)) {
      console.error(`${tag} already defined`)
      return
    }
    customElements.define(
      tag,
      mixin(
        class extends HTMLElement implements ISLElement {
          #shadowObserver?: MutationObserver
          #templateObserver?: MutationObserver
          #disconnect?: () => void
          internals_: ElementInternals
          #trigger: Trigger
          //@ts-ignore: implemented by subclass
          abstract plait?: (props: PlaitProps) => void | Promise<void>
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
            /** Warn ourselves not to overwrite the trigger method */
            if (this.#trigger !== this.constructor.prototype.trigger) {
              throw new Error(
                'trigger cannot be overridden in a subclass.'
              )
            }
          }
          connectedCallback() {
            if (!this.internals_.shadowRoot?.firstChild) {
              const template = this.querySelector<HTMLTemplateElement>(
                'template[shadowrootmode]'
              )
              template
                ? this.#appendTemplate(template)
                : (this.#templateObserver = this.#createTemplateObserver())
            }
            if (this.plait) {
              this.#delegateListeners( // just connected/upgraded then delegate listeners nodes with data-trigger attribute
                this.#root.querySelectorAll<HTMLElement>(
                  `[${dataTrigger}]`
                )
              )
              const { disconnect, trigger, ...rest } = useBehavioral(
                {
                  context: this,
                  ...bProgramOptions,
                }
              )
              this.plait({
                $: this.$.bind(this),
                host: this,
                trigger,
                ...rest,
              })
              this.#shadowObserver = this.#createShadowObserver()
              this.#disconnect = disconnect
              this.#trigger = trigger
              const slots = this.shadowRoot?.querySelectorAll<HTMLSlotElement>(dataSlotSelector)
              slots && slots.forEach(slot => {
                slot.assignedElements().forEach(el => el instanceof HTMLScriptElement &&  this.#renderSlotData(el))
                this.#delegateDataSlotChange(slot)
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
            const slots = this.shadowRoot?.querySelectorAll<HTMLSlotElement>(dataSlotSelector)
            slots && slots.forEach(slot => {
              slot.assignedElements().length && slot.removeEventListener('slotchange', delegatedListener.get(slot))
            })
          }
          #renderSlotData(el: HTMLScriptElement) {
            // TODO: add logic here to support **type="application/ld+json"** we're going to use this for importing elements
            if(el.type === 'application/json') {
              let obj: DataSlotPayload | undefined
              try {
                const parsed = JSON.parse(el.textContent ?? '{}')
                const { $target, $position, $data } = parsed
                if(trueTypeOf($target) !== 'string') throw new Error(`Invalid $target value [${$target}}]`)
                if(
                  $position &&
                    ![ 'beforebegin', 'afterbegin', 'beforeend', 'afterend' ].includes($position)
                ) throw new Error(`Invalid $position value [${$position}]`)
                if(
                  trueTypeOf($data) !== 'object'
                ) throw new Error(`Invalid $data value [${$data}]`)
                obj = parsed
              } catch(err) {
                console.error(err)
              }
              if(obj) {
                const { $data } = obj
                this.$(obj.$target)?.render(
                  Fragment({
                    children: Array.isArray($data)
                        ? $data.map(data => compileElementData(data))
                        : compileElementData($data),
                  }), obj.$position
                )
              }
            }
          }
          #delegateDataSlotChange(slot: HTMLSlotElement) {
            if(!delegatedListener.has(slot)) {
              delegatedListener.set(slot, _ => {
                slot.assignedElements().forEach(el => el instanceof HTMLScriptElement &&  this.#renderSlotData(el))
              })
            }
            slot.addEventListener('slotchange', delegatedListener.get(slot)) 
          }
          #delegateListeners(nodes:Node[] |NodeList) {
            nodes.forEach(el => {
              if (el.nodeType === 1) { // Node is of type Element which in the browser mean HTMLElement | SVGElement
                if ((el as Element).tagName === 'SLOT'){ // Element is an instance of a slot
                  if(el.hasAttribute('slot')) return // This is a nested slot we ignore it
                  if(!el.hasAttribute(dataTrigger)) return this.#delegateDataSlotChange(el) // This slot is not nested or a trigger slot so we can use it as a data slot
                }
                !delegatedListener.has(el) &&
                  delegatedListener.set(el, event => { // Delegated listener does not have element then delegate it's callback
                    const triggerKey = getTriggerKey(
                      event,
                      el as HTMLElement | SVGElement
                    )
                    triggerKey
                      /** if key is present in `data-trigger` trigger event on instance's bProgram */
                      ? this.#trigger<Event>({
                        type: triggerKey,
                        detail: event,
                      })
                      /** if key is not present in `data-trigger` remove event listener for this event on Element */
                      : el.removeEventListener(
                        event.type,
                        delegatedListener.get(el)
                      )
                  })
                const triggers = (el as HTMLElement | SVGElement).dataset
                  .trigger /** get element triggers if it has them */
                if (triggers) {
                  const events = matchAllEvents(triggers) /** get event type */
                  for (const event of events) {
                    /** loop through and set event listeners on delegated object */
                    el.addEventListener(event, delegatedListener.get(el))
                  }
                }
              }
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
          ): SugaredElement<T> | undefined;
          $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
            target: string,
            opts?: {
              all: boolean;
              mod: '=' | '~=' | '|=' | '^=' | '$=' | '*=';
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
              const elements: SugaredElement<T>[] = []
              this.#root.querySelectorAll<T>(selector)
                .forEach(element => elements.push(Object.assign(element, sugar)))
              return Object.assign(elements, sugarForEach)
            }
            const element = this.#root.querySelector<T>(selector)
            if (!element) return
            return Object.assign(element, sugar)        
          }
        }   
      )
    )
  }
  define['template'] = <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends Record<string, any> = Record<string, any>,
  >(
      props: T
    ) => createTemplate<T>(tag, props)
  return define
}
