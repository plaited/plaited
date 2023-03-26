/// <reference lib="dom.iterable" />
import { dataTarget, dataTrigger } from './constants.ts'
import { canUseSlot, getTriggerKey, matchAllEvents } from './utils.ts'
import { Trigger } from '../behavioral/mod.ts'
import { useBehavioral } from './use-behavioral.ts'
import {
  ISLElement,
  ISLElementConstructor,
  ISLElementOptions,
  IsleTemplateProps,
  PlaitProps,
} from './types.ts'
import { delegatedListener } from './delegated-listener.ts'
import { wire } from './wire.ts'
import { html } from './html.ts'
import { template } from './template.ts'
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
  mixin: (base: ISLElementConstructor) => ISLElementConstructor = (base) =>
    class extends base {},
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
          plait?: (props: PlaitProps) => void | Promise<void>

          constructor() {
            super()
            this.internals_ = this.attachInternals()
            !this.internals_.shadowRoot &&
              this.attachShadow({ mode, delegatesFocus }) // no declarative shadowdom then connect one
          }
          connectedCallback() {
            if (!this.internals_.shadowRoot?.firstChild) {
              const template = this.querySelector<HTMLTemplateElement>(
                'template[shadowrootmode]',
              )
              template
                ? this.#appendTemplate(template)
                : (this.#templateObserver = this.#createTemplateObserver())
            }
            if (this.plait) {
              this.internals_.shadowRoot && this.#delegateListeners( // just connected/upgraded then delegate listeners nodes with data-trigger attribute
                this.internals_.shadowRoot.querySelectorAll<HTMLElement>(
                  `[${dataTrigger}]`,
                ),
              )
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
              this.#shadowObserver = this.#createShadowObserver()
              this.#disconnect = disconnect
              this.#trigger = trigger
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
          #delegateListeners(
            nodes:
              | (HTMLElement | SVGElement)[]
              | NodeList,
          ) {
            nodes.forEach((el) => {
              if (el.nodeType === 1) { // Node is of type Element
                if (
                  (el as HTMLElement).tagName === 'SLOT' && // Element is an instance of a slot
                  !canUseSlot(el as HTMLSlotElement)
                ) return // Element is not a slot we can use return callback
                !delegatedListener.has(el) &&
                  delegatedListener.set(el, (event) => { // Delegated listener does not have element then delegate it's callback
                    const triggerKey = getTriggerKey(
                      event,
                      el as HTMLElement | SVGElement,
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
                        delegatedListener.get(el),
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
            const mo = new MutationObserver((mutationsList) => {
              for (const mutation of mutationsList) {
                if (mutation.addedNodes.length) {
                  this.#delegateListeners(mutation.addedNodes)
                }
                if (mutation.type === 'attributes') {
                  this.internals_.shadowRoot && this.#delegateListeners(
                    this.internals_.shadowRoot.querySelectorAll<HTMLElement>(
                      `[${dataTrigger}]`,
                    ),
                  )
                }
              }
            })
            this.internals_.shadowRoot &&
              mo.observe(this.internals_.shadowRoot, {
                attributeFilter: [dataTrigger],
                childList: true,
                subtree: true,
              })
            return mo
          }
          #appendTemplate(template: HTMLTemplateElement) {
            if (this.internals_.shadowRoot) {
              !this.internals_.shadowRoot.firstChild &&
                this.internals_.shadowRoot.appendChild(
                  document.importNode((template).content, true),
                )
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
            if (this.internals_.shadowRoot) {
              return [...this.internals_.shadowRoot.querySelectorAll<T>(
                `[${dataTarget}="${target}"]`,
              )].filter((el) =>
                el.tagName === 'SLOT' ? canUseSlot(el as HTMLSlotElement) : true
              )
            }
            return []
          }
        },
      ),
    )
  }
  define['template'] = template<IsleTemplateProps>(({
    styles,
    shadow,
    light,
    ...rest
  }) => {
    const stylesheet = styles &&
      html`<style>${typeof styles === 'string' ? styles : [...styles]}</style>`
    return html`
  <${tag} ${wire({ ...rest })}>
    <template
      shadowrootmode="${mode}"
      ${delegatesFocus && 'shadowrootdelegatesfocus'}
    >
      ${stylesheet}
      ${shadow}
    </template>
    ${light}
  </${tag}>
  `
  })
  return define
}
