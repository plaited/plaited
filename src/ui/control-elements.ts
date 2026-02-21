import type { BThreads, Disconnect, Trigger, UseFeedback, UseSnapshot } from '../behavioral.ts'
import { behavioral } from '../behavioral.ts'
import { canUseDOM, keyMirror } from '../utils.ts'
import { RESTRICTED_EVENTS } from './controller.constants.ts'
import { controller } from './controller.ts'
import { BOOLEAN_ATTRS } from './create-template.constants.ts'
import { createTemplate, Fragment } from './create-template.ts'
import type { Attrs, CustomElementTag, FunctionTemplate } from './create-template.types.ts'

export const ELEMENT_CALLBACKS = keyMirror(
  'on_adopted',
  'on_attribute_changed',
  'on_connected',
  'on_disconnected',
  'on_form_associated',
  'on_form_disabled',
  'on_form_reset',
  'on_form_state_restore',
)

// ─── Element Callback Message Types ─────────────────────────────────────────

/** @public */
export type OnAdoptedMessage = {
  type: typeof ELEMENT_CALLBACKS.on_adopted
  detail?: undefined
}

/** @public */
export type OnAttributeChangedMessage = {
  type: typeof ELEMENT_CALLBACKS.on_attribute_changed
  detail: {
    name: string
    oldValue: string | null
    newValue: string | null
  }
}

/** @public */
export type OnConnectedMessage = {
  type: typeof ELEMENT_CALLBACKS.on_connected
  detail?: undefined
}

/** @public */
export type OnDisconnectedMessage = {
  type: typeof ELEMENT_CALLBACKS.on_disconnected
  detail?: undefined
}

/** @public */
export type OnFormAssociatedMessage = {
  type: typeof ELEMENT_CALLBACKS.on_form_associated
  detail: HTMLFormElement
}

/** @public */
export type OnFormDisabledMessage = {
  type: typeof ELEMENT_CALLBACKS.on_form_disabled
  detail: boolean
}

/** @public */
export type OnFormResetMessage = {
  type: typeof ELEMENT_CALLBACKS.on_form_reset
  detail?: undefined
}

/** @public */
export type OnFormStateRestoreMessage = {
  type: typeof ELEMENT_CALLBACKS.on_form_state_restore
  detail: {
    state: unknown
    reason: 'autocomplete' | 'restore'
  }
}

// ─── Derived Handler Type ───────────────────────────────────────────────────

type ElementCallbackMessage =
  | OnAdoptedMessage
  | OnAttributeChangedMessage
  | OnConnectedMessage
  | OnDisconnectedMessage
  | OnFormAssociatedMessage
  | OnFormDisabledMessage
  | OnFormResetMessage
  | OnFormStateRestoreMessage

export type BehavioralElementCallbackDetails = {
  [M in ElementCallbackMessage as M['type']]: M['detail']
}

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
        #restrictedTrigger: Trigger
        #useSnapshot: UseSnapshot
        constructor() {
          super()
          const { trigger, useFeedback, bThreads, useRestrictedTrigger, useSnapshot } = behavioral()
          this.#trigger = trigger
          this.#useFeedback = useFeedback
          this.#bThreads = bThreads
          this.#restrictedTrigger = useRestrictedTrigger(
            ...Object.values(RESTRICTED_EVENTS),
            ...Object.values(ELEMENT_CALLBACKS),
          )
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
            restrictedTrigger: this.#restrictedTrigger,
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
