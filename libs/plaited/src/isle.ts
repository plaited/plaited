import { Children, createTemplate, dataTarget, dataTrigger, Fragment } from '@plaited/jsx'
import { trueTypeOf } from '@plaited/utils'
import { Trigger } from '@plaited/behavioral'
import { useBehavioral } from './use-behavioral.js'
import {
  ISLElement,
  ISLElementConstructor,
  ISLElementOptions,
  PlaitProps,
  DataSlotPayload,
  ElementData,
} from './types.js'
import { delegatedListener } from './delegated-listener.js'
import { sugar, SugaredElement, sugarForEach } from './use-sugar.js'
import { elementRegister } from './register.js'

const compileElementData = (data:ElementData | ElementData[]): Children => {
  const elementData = Array.isArray(data) ? data : [ data ]
  console.log(elementData)
  return elementData.map(({ $el, $children, $slots, $attrs = {} }) => {
    console.log({ $el })
    return createTemplate(
      elementRegister.get($el) || $el, 
      {
        ...$attrs,
        children: $children ? compileElementData($children) : undefined,
        slots: $slots ? compileElementData($slots) : undefined,
      }
    )
  })
}

// It takes the value of a data-target attribute and return all the events happening in it. minus the method identifier
// so iof the event was data-target="click->doSomething" it would return ["click"]
export const matchAllEvents = (str: string) => {
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g
  return [ ...str.matchAll(regexp) ].flatMap(([ , event ]) => event)
}

// returns the request/action name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// note triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
export const getTriggerKey = (
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


const traverseNodes = (node: Node, arr: Node[]) => {
  if (node.nodeType === 1) {
    if ((node as Element).hasAttribute('data-trigger') || node instanceof HTMLSlotElement) {
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
                context: this,
                trigger,
                ...rest,
              })
              this.#shadowObserver = this.#createShadowObserver()
              this.#disconnect = disconnect
              this.#trigger = trigger
              const slots = this.shadowRoot?.querySelectorAll<HTMLSlotElement>(`slot[name]`)
              slots && slots.forEach(slot => {
                this.#delegateDataSlotChange(slot)
              })
            }
          }
          #delegateDataSlotChange(slot: HTMLSlotElement) {
            if(!delegatedListener.has(slot)) {
              delegatedListener.set(slot, _ => {
                slot.assignedElements().forEach(el => {
                  // TODO: add logic here to support **type="application/ld+json"** we're going to use this for importing elements
                  if(el instanceof HTMLScriptElement &&  el.type === 'application/json') {
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
                    obj && this.$(obj.$target)?.render(
                      Fragment({ children: compileElementData(obj.$data) }), obj.$position
                    )
                  }
                })
              })
            }
            slot.addEventListener('slotchange', delegatedListener.get(slot)) 
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
          #delegateListeners(nodes:Node[] |NodeList) {
            nodes.forEach(el => {
              if (el.nodeType === 1) { // Node is of type Element which in the browser mean HTMLElement | SVGElement
                if ((el as Element).tagName === 'SLOT' ) { // Element is an instance of a slot so we don't bind event listeners for triggers
                  el.hasAttribute('name') && this.#delegateDataSlotChange(el)
                  return
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
