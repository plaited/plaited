/// <reference lib="dom.iterable" />
import { dataTarget, dataTrigger } from './constants.ts'
import {
  canUseSlot,
  filterAddedNodes,
  getTriggerKey,
  matchAllEvents,
} from './utils.ts'
import { Trigger } from '../behavioral/mod.ts'
import { useBehavioral } from './use-behavioral.ts'
import { ISLElementConstructor, ISLElementOptions } from './types.ts'
import { delegatedListener } from './delegated-listener.ts'

/**
 * A typescript function for instantiating Plaited Island Elements
 */
export const isle = ({
  mode = 'open',
  delegatesFocus = true,
  tag,
  ...bProgramOptions
}: ISLElementOptions, island: ISLElementConstructor) => {
  return class extends island {
    #noDeclarativeShadow = false
    #shadowObserver?: MutationObserver
    #templateObserver?: MutationObserver
    #disconnect?: () => void
    internals_: ElementInternals
    #trigger: Trigger
    constructor() {
      super()
      this.internals_ = this.attachInternals()
      let root = this.internals_.shadowRoot
      !root && (root = this.attachShadow({ mode, delegatesFocus }))
      !root.firstChild && (this.#noDeclarativeShadow = true)
    }
    connectedCallback() {
      super.connectedCallback && super.connectedCallback()
      if (this.#noDeclarativeShadow) {
        const template = this.querySelector<HTMLTemplateElement>(
          'template[shadowrootmode]',
        )
        template
          ? this.#appendTemplate(template)
          : (this.#templateObserver = this.#createTemplateObserver())
      }
      this.#connectTriggers()
      this.#shadowObserver = this.#createShadowObserver()
      const { disconnect, trigger, ...rest } = useBehavioral(
        {
          context: this,
          ...bProgramOptions,
        },
      )
      this.plait({
        $: this.$.bind(this),
        context: this,
        trigger,
        ...rest,
      })
      this.#disconnect = disconnect
      this.#trigger = trigger
    }
    disconnectedCallback() {
      super.disconnectedCallback && super.disconnectedCallback()
      this.#templateObserver && this.#templateObserver.disconnect()
      this.#shadowObserver && this.#shadowObserver.disconnect()
      if (this.#disconnect) {
        this.#trigger({
          event: `disconnected->${this.id || this.tagName.toLowerCase()}`,
        })
        this.#disconnect()
      }
    }
    #connectTriggers() {
      const root = this.internals_.shadowRoot
      if (root) {
        const els = [
          ...root.querySelectorAll<HTMLElement>(`[${dataTrigger}]`),
          // No binding of nested slots events
        ].filter((el) => el instanceof HTMLSlotElement ? canUseSlot(el) : true)
        els.length && this.#delegateListeners(els)
      }
    }
    #delegateListeners(
      nodes:
        | (HTMLElement | SVGElement)[]
        | NodeListOf<HTMLElement | SVGElement>,
    ) {
      nodes.forEach((el) => {
        !delegatedListener.has(el) && delegatedListener.set(el, (event) => {
          const triggerKey = getTriggerKey(event, el)
          triggerKey
            /** if key is present in `data-trigger` trigger event on instance's bProgram */
            ? this.#trigger<{ event: Event }>({
              event: triggerKey,
              detail: { event },
            })
            /** if key is not present in `data-trigger` remove event listener for this event */
            : el.removeEventListener(event.type, delegatedListener.get(el))
        })
        const triggers = el.dataset.trigger
        if (triggers) {
          const events = matchAllEvents(triggers)
          for (const event of events) {
            el.addEventListener(event, delegatedListener.get(el))
          }
        }
      })
    }
    // Observes the addition of nodes to the shadow dom and changes to and child's data-trigger attribute
    #createShadowObserver() {
      const root = this.internals_.shadowRoot
      if (root) {
        const mo = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            if (mutation.addedNodes.length) {
              const els = filterAddedNodes(mutation.addedNodes)
              els.length && this.#delegateListeners(els)
            }
            if (mutation.type === 'attributes') {
              this.#connectTriggers()
            }
          }
        })
        mo.observe(root, {
          attributeFilter: [dataTrigger],
          childList: true,
          subtree: true,
        })
        return mo
      }
    }
    #appendTemplate(template: HTMLTemplateElement) {
      const root = this.internals_.shadowRoot
      if (root) {
        !root.firstChild &&
          root.appendChild(document.importNode((template).content, true))
        template.remove()
      }
    }
    #createTemplateObserver() {
      const mo = new MutationObserver(() => {
        const template = this.querySelector<HTMLTemplateElement>(
          'template[shadowrootmode]',
        )
        if (template) {
          mo.disconnect()
          this.#appendTemplate(template)
        }
      })
      mo.observe(this, { childList: true })
      return mo
    }
    $<T extends (HTMLElement | SVGElement)>(target: string): T[] {
      const root = this.internals_.shadowRoot
      let elements: T[] = []
      if (root) {
        elements = [...root.querySelectorAll<T>(
          `[${dataTarget}="${target}"]`,
        )].filter((el) => el instanceof HTMLSlotElement ? canUseSlot(el) : true)
      }
      return elements
    }
    static define() {
      if (customElements.get(tag)) return
      customElements.define(tag, this)
    }
  }
}
