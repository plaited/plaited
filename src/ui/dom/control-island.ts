import type { AddBThreads, Disconnect, Trigger, UseFeedback, UseSnapshot } from '../../behavioral.ts'
import { behavioral } from '../../behavioral.ts'
import { keyMirror } from '../../utils.ts'
import { createStyles } from '../css/styles.ts'
import { controller } from '../protocol/controller.ts'
import { canUseDOM } from '../render/can-use-dom.ts'
import { BOOLEAN_ATTRS } from '../render/template.constants.ts'
import { createTemplate, Fragment } from '../render/template.ts'
import type { CustomElementTag, ElementAttributeList, FunctionTemplate } from '../render/template.types.ts'

const styles = createStyles({
  controller: { display: 'contents' },
})

/**
 * Custom element lifecycle callback event types, exposed as BP event types.
 *
 * @remarks
 * Each callback maps to a `BPEvent.type` that `controlIsland` fires into
 * its behavioral program when the corresponding Custom Element lifecycle
 * method is invoked by the browser.
 *
 * @public
 */
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

/**
 * Maps element callback event types to their detail payloads.
 *
 * @remarks
 * Use as the `Details` type parameter for `behavioral<BehavioralElementCallbackDetails>()`
 * to get type-safe handler signatures for all lifecycle callbacks.
 *
 * @public
 */
export type BehavioralElementCallbackDetails = {
  [M in ElementCallbackMessage as M['type']]: M['detail']
}

/**
 * Brand identifier stamped onto `ControllerTemplate` function objects.
 *
 * @remarks
 * Used at runtime to distinguish controller template functions from
 * plain `FunctionTemplate` instances.
 *
 * @public
 */
export const CONTROLLER_TEMPLATE_IDENTIFIER = '🎛️' as const

/**
 * A template function branded as a controller island entry point.
 *
 * @remarks
 * Returned by `controlIsland()`. Carries `tag`, `observedAttributes`, and
 * the `$` brand so consumers can identify it as a controller template.
 *
 * @public
 */
export type ControllerTemplate = FunctionTemplate<ElementAttributeList['controlIsland']> & {
  tag: CustomElementTag
  observedAttributes: string[]
  $: typeof CONTROLLER_TEMPLATE_IDENTIFIER
}

/**
 * Defines and registers a Custom Element that hosts a behavioral program.
 *
 * @remarks
 * On first call (in a DOM environment), registers the custom element via
 * `customElements.define()`. The element constructor creates a `behavioral()`
 * instance and uses the host trigger surface for lifecycle/event ingress.
 *
 * Lifecycle callbacks (`connectedCallback`, `attributeChangedCallback`, etc.)
 * are forwarded as typed BP events into the element's behavioral program.
 *
 * @param options.tag - Custom element tag name (must contain a hyphen)
 * @param options.observedAttributes - Attribute names to observe for changes
 * @param options.formAssociated - If `true`, associates the element with a form
 * @returns A branded `ControllerTemplate` function for use in SSR templates
 *
 * @public
 */
export const controlIsland = ({
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
        #addBThreads: AddBThreads
        #useSnapshot: UseSnapshot
        constructor() {
          super()
          const { trigger, useFeedback, addBThreads, useSnapshot } = behavioral()
          this.#trigger = trigger
          this.#useFeedback = useFeedback
          this.#addBThreads = addBThreads
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
            addBThreads: this.#addBThreads,
            useFeedback: this.#useFeedback,
            disconnectSet: this.#disconnectSet,
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
  const ft: ControllerTemplate = ({ children = [], ...attrs }) => {
    const tpl = Fragment({ children })
    tpl.registry.push(tag)
    return createTemplate(tag, { ...attrs, ...styles.controller, children: tpl })
  }
  ft.tag = tag
  ft.$ = CONTROLLER_TEMPLATE_IDENTIFIER
  ft.observedAttributes = observedAttributes
  return ft
}
