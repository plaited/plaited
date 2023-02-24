/// <reference lib="dom.iterable" />
import { dataTarget, dataTrigger } from './constants.ts'
import { filterAddedNodes, getTriggerKey, matchAllEvents } from './utils.ts'
import { Trigger } from '../behavioral/mod.ts'
import { useBehavioral } from './use-behavioral.ts'
import { IslandElementConstructor, IslandElementOptions } from './types.ts'
import { delegatedListener } from './delegated-listener.ts'

/**
 * A typescript decorator for instantiating Plaited Island Elements
 */
export const controller = ({
  mode = 'open',
  delegatesFocus = true,
  styles,
  ...rest
}: IslandElementOptions = {}) => {
  return <T extends IslandElementConstructor>(
    IslandElement: T,
  ) => {
    return class extends IslandElement {
      #noDeclarativeShadow = false
      #shadowObserver?: MutationObserver
      #templateObserver?: MutationObserver
      #disconnect: () => void
      internals_: ElementInternals
      #trigger: Trigger
      // deno-lint-ignore no-explicit-any
      constructor(...arg: any[]) {
        super(arg)
        this.internals_ = this.attachInternals()
        let root = this.internals_.shadowRoot
        if (!root) {
          root = this.attachShadow({ mode, delegatesFocus })
          this.#noDeclarativeShadow = true
        }
        const sheets = Array.isArray(styles) ? [...new Set(styles)] : [styles]
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(sheets.join(''))
        root.adoptedStyleSheets = [sheet]
      }
      connectedCallback() {
        if (super.connectedCallback) {
          super.connectedCallback()
        }
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
        const { disconnect, trigger, add, feedback, lastEvent } = useBehavioral(
          {
            context: this,
            ...rest,
          },
        )
        this.plait({
          $: this.$.bind(this),
          add,
          context: this,
          feedback,
          trigger,
          lastEvent,
        })
        this.#disconnect = disconnect
        this.#trigger = trigger
        this.#trigger({
          type: `connected->${this.id || this.tagName.toLowerCase()}`,
        })
      }
      disconnectedCallback() {
        if (super.disconnectedCallback) {
          super.disconnectedCallback()
        }

        this.#trigger({
          type: `disconnected->${this.id || this.tagName.toLowerCase()}`,
        })
        this.#templateObserver && this.#templateObserver.disconnect()
        this.#shadowObserver && this.#shadowObserver.disconnect()
        this.#disconnect()
      }
      #delegateListeners(nodes?: HTMLElement[]) {
        const root = this.internals_.shadowRoot
        if (root) {
          const triggers = nodes || root.querySelectorAll(`[${dataTrigger}]`)
          triggers.forEach((el) => {
            if (!delegatedListener.has(el)) {
              delegatedListener.set(el, (evt) => {
                const triggerKey = getTriggerKey(evt)
                triggerKey && this.#trigger({
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
            'template[shadowroot]',
          )
          if (template) {
            mo.disconnect()
            this.#appendTemplate(template)
          }
        })
        mo.observe(this, { childList: true })
        return mo
      }
      $<T = Element>(target: string): T[] | never[] {
        const root = this.internals_.shadowRoot
        const selection = root
          ? root.querySelectorAll(
            `[${dataTarget}="${target}"]`,
          ) as unknown as T[]
          : []
        return [...selection]
      }
      static define(tag: string) {
        if (customElements.get(tag)) return
        customElements.define(tag, this)
      }
    }
  }
}
