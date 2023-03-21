/// <reference lib="dom.iterable" />
import { dataTarget, dataTrigger } from './constants.ts'
import {
  filterAddedNodes,
  filterSlottedElements,
  getTriggerKey,
  matchAllEvents,
} from './utils.ts'
import { Trigger } from '../behavioral/mod.ts'
import { useBehavioral } from './use-behavioral.ts'
import { IslandElementConstructor, IslandElementOptions } from './types.ts'
import { delegatedListener } from './delegated-listener.ts'

/**
 * A typescript function for instantiating Plaited Island Elements
 */
export const isle = ({
  mode = 'open',
  delegatesFocus = true,
  styles,
  tag,
  ...bProgramOptions
}: IslandElementOptions, IslandElement: IslandElementConstructor) => {
  return class extends IslandElement {
    #noDeclarativeShadow = false
    #shadowObserver?: MutationObserver
    #templateObserver?: MutationObserver
    #disconnect?: () => void
    internals_: ElementInternals
    #trigger: Trigger
    // deno-lint-ignore no-explicit-any
    constructor(...arg: any[]) {
      super(arg)
      this.internals_ = this.attachInternals()
      let root = this.internals_.shadowRoot
      !root && (root = this.attachShadow({ mode, delegatesFocus }))
      !root.firstChild && (this.#noDeclarativeShadow = true)
      this.#attachStyles(root)
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
      this.#connectSlotTriggers()
      this.#connectShadowTriggers()
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
    #attachStyles(root: ShadowRoot) {
      if (!root) return
      const sheets = Array.isArray(styles) ? [...new Set(styles)] : [styles]
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(sheets.join(''))
      root.adoptedStyleSheets = [sheet]
    }
    #connectSlotTriggers() {
      const root = this.internals_.shadowRoot
      root &&
        root.querySelectorAll<HTMLSlotElement>('slot').forEach((slot) => {
          // We do not wish to observer nested slots
          // each island/custom element is responsible for it's own slots
          // We also do not wish to observe non named slots for event binding
          if (slot.hasAttribute('slot') || !slot.hasAttribute('name')) return
          const delegateSlottedElements = () => {
            const elements = filterSlottedElements(slot)
            elements.length && this.#delegateListeners(elements)
          }
          delegateSlottedElements()
          delegatedListener.set(slot, delegateSlottedElements)
          slot.addEventListener('slotchange', delegatedListener.get(slot))
        })
    }
    #connectShadowTriggers() {
      const root = this.internals_.shadowRoot
      if (root) {
        const els = [
          ...root.querySelectorAll<HTMLElement>(`[${dataTrigger}]`),
        ].filter((el) => !el.hasAttribute('slot'))
        els.length && this.#delegateListeners(els)
      }
    }
    #delegateListeners(
      nodes:
        | (HTMLElement | SVGElement)[]
        | NodeListOf<HTMLElement | SVGElement>,
    ) {
      nodes.forEach((el) => {
        !delegatedListener.has(el) && delegatedListener.set(el, (evt) => {
          const triggerKey = getTriggerKey(evt)
          triggerKey && this.#trigger({
            event: triggerKey,
            detail: evt as unknown as Record<string, unknown>,
          })
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
              this.#connectShadowTriggers()
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
        )]
        root.querySelectorAll<HTMLSlotElement>('slot').forEach((slot) => {
          // We do not wish to observer nested slots each island/custom element is responsible for it's own slots
          if (slot.hasAttribute('slot')) return
          for (const el of slot.assignedElements()) {
            if (
              el instanceof HTMLElement ||
              el instanceof SVGElement
            ) {
              el.dataset.target === target && elements.push(el as T)
            }
          }
        })
      }
      return elements
    }
    static define() {
      if (customElements.get(tag)) return
      customElements.define(tag, this)
    }
  }
}
