import type { BThreads, Disconnect, Trigger, UseFeedback, UseRestrictedTrigger, UseSnapshot } from '../main.ts'
import { behavioral } from '../main.ts'
import { canUseDOM } from '../utils.ts'
import { ELEMENT_CALLBACKS } from './control-elements.constants.ts'
import type {
  OnAdoptedMessage,
  OnAttributeChangedMessage,
  OnConnectedMessage,
  OnDisconnectedMessage,
  OnFormAssociatedMessage,
  OnFormDisabledMessage,
  OnFormResetMessage,
  OnFormStateRestoreMessage,
} from './control-elements.schemas.ts'
import { controller } from './controller.ts'
import { BOOLEAN_ATTRS } from './create-template.constants.ts'
import { createTemplate, Fragment } from './create-template.ts'
import type { Attrs, CustomElementTag, FunctionTemplate } from './create-template.types.ts'

export const CONTROLLER_TEMPLATE_IDENTIFIER = '🎛️' as const

export type ControllerTemplate = FunctionTemplate & {
  tag: CustomElementTag
  observedAttributes: string[]
  $: typeof CONTROLLER_TEMPLATE_IDENTIFIER
}

export const controlElements = ({
  tag,
  observedAttributes = [],
  formAssociated,
}: {
  tag: CustomElementTag
  observedAttributes?: string[]
  formAssociated?: true
}): ControllerTemplate => {
  if (canUseDOM() && !customElements.get(tag)) {
    customElements.define(
      tag,
      class extends HTMLElement {
        static observedAttributes = observedAttributes
        static formAssociated = formAssociated
        #disconnectSet = new Set<Disconnect>()
        #trigger: Trigger
        #useFeedback: UseFeedback
        #bThreads: BThreads
        #useRestrictedTrigger: UseRestrictedTrigger
        #useSnapshot: UseSnapshot
        constructor() {
          super()
          const { trigger, useFeedback, bThreads, useRestrictedTrigger, useSnapshot } = behavioral()
          this.#trigger = trigger
          this.#useFeedback = useFeedback
          this.#bThreads = bThreads
          this.#useRestrictedTrigger = useRestrictedTrigger
          this.#useSnapshot = useSnapshot
        }
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
          this.#trigger<OnAttributeChangedMessage>({
            type: ELEMENT_CALLBACKS.on_attribute_changed,
            detail: { name, oldValue, newValue },
          })
        }
        adoptedCallback() {
          this.#trigger<OnAdoptedMessage>({ type: ELEMENT_CALLBACKS.on_adopted })
        }
        connectedCallback() {
          for (const attr of observedAttributes) {
            Reflect.defineProperty(this, attr, {
              get() {
                return BOOLEAN_ATTRS.has(attr) ? this.hasAttribute(attr) : this.getAttribute(attr)
              },
              set(value: unknown) {
                BOOLEAN_ATTRS.has(attr) ? this.toggleAttribute(attr, value) : this.setAttribute(attr, `${value}`)
              },
            })
          }
          controller({
            root: this,
            trigger: this.#trigger,
            bThreads: this.#bThreads,
            useFeedback: this.#useFeedback,
            disconnectSet: this.#disconnectSet,
            useRestrictedTrigger: this.#useRestrictedTrigger,
            useSnapshot: this.#useSnapshot,
          })
          this.#trigger<OnConnectedMessage>({ type: ELEMENT_CALLBACKS.on_connected })
        }
        disconnectedCallback() {
          for (const cb of this.#disconnectSet) void cb()
          this.#disconnectSet.clear()
          this.#trigger<OnDisconnectedMessage>({ type: ELEMENT_CALLBACKS.on_disconnected })
        }
        formAssociatedCallback(form: HTMLFormElement) {
          this.#trigger<OnFormAssociatedMessage>({
            type: ELEMENT_CALLBACKS.on_form_associated,
            detail: form,
          })
        }
        formDisabledCallback(disabled: boolean) {
          this.#trigger<OnFormDisabledMessage>({
            type: ELEMENT_CALLBACKS.on_form_disabled,
            detail: disabled,
          })
        }
        formResetCallback() {
          this.#trigger<OnFormResetMessage>({ type: ELEMENT_CALLBACKS.on_form_reset })
        }
        formStateRestoreCallback(state: unknown, reason: 'autocomplete' | 'restore') {
          this.#trigger<OnFormStateRestoreMessage>({
            type: ELEMENT_CALLBACKS.on_form_state_restore,
            detail: { state, reason },
          })
        }
      },
    )
  }
  const ft = ({ children = [], ...attrs }: Attrs) => {
    const tpl = Fragment({ children })
    tpl.registry.push(tag)
    return createTemplate(tag, { ...attrs, children: tpl })
  }
  ft.tag = tag
  ft.$ = CONTROLLER_TEMPLATE_IDENTIFIER
  ft.observedAttributes = observedAttributes
  return ft
}
