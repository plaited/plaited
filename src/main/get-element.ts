import type { TemplateObject, CustomElementTag } from '../jsx/jsx.types.js'
import { BOOLEAN_ATTRS } from '../jsx/jsx.constants.js'
import { type BSync, type BThread, bThread, bSync } from '../behavioral/b-thread.js'
import {
  type Handlers,
  type BThreads,
  type Disconnect,
  type Trigger,
  type UseFeedback,
  type UseSnapshot,
  bProgram,
} from '../behavioral/b-program.js'
import { P_TRIGGER, P_TARGET } from '../jsx/jsx.constants.js'
import {
  type Query,
  type SelectorMatch,
  type BoundElement,
  getDocumentFragment,
  assignHelpers,
  getBoundElements,
} from './assign-helpers.js'
import { addListeners } from './add-listeners.js'
import { getShadowObserver } from './get-shadow-observer.js'
import { getPublicTrigger } from '../behavioral/get-public-trigger.js'
import { canUseDOM } from '../utils/can-use-dom.js'
import { ELEMENT_CALLBACKS } from './plaited.constants.js'
import { type PlaitedTrigger, getPlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import type { PlaitedElement } from './plaited.types.js'

/**
 * Arguments passed to component's connected callback.
 * Provides core utilities and context for component initialization.
 *
 * @property $ Query selector for shadow DOM elements
 * @property root Component's shadow root
 * @property host Reference to component instance
 * @property internals ElementInternals instance
 * @property trigger Event trigger function
 * @property bThreads Behavioral thread management
 * @property useSnapshot State snapshot utility
 * @property bThread Thread creation utility
 * @property bSync Synchronization utility
 */
export type BProgramArgs = {
  $: Query
  root: ShadowRoot
  host: PlaitedElement
  internals: ElementInternals
  trigger: PlaitedTrigger
  bThreads: BThreads
  useSnapshot: UseSnapshot
  bThread: BThread
  bSync: BSync
}
/**
 * Type definition for all lifecycle and form-associated callback handlers in Plaited elements.
 * All callbacks optionally support async operations.
 *
 * Lifecycle Callbacks:
 * @property onAdopted Called when element is moved to new document
 * @property onAttributeChanged Called when observed attribute changes
 * @property onConnected Called when element is added to DOM
 * @property onDisconnected Called when element is removed from DOM
 *
 * Form Association Callbacks:
 * @property onFormAssociated Called when element is associated with a form
 * @property onFormDisabled Called when associated form is disabled/enabled
 * @property onFormReset Called when associated form is reset
 * @property onFormStateRestore Called when form state is restored
 *
 *
 * @remarks
 * - All callbacks are optional
 * - All callbacks can be async (return Promise)
 * - Form callbacks only fire if element is form-associated
 * - Attribute callbacks only fire for observed attributes
 * - Handlers receive strongly-typed arguments
 * - Maintains proper 'this' binding in callbacks
 */
export type PlaitedElementCallbackHandlers = {
  [ELEMENT_CALLBACKS.onAdopted]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onAttributeChanged]?: (args: {
    name: string
    oldValue: string | null
    newValue: string | null
  }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onConnected]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onDisconnected]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormAssociated]?: (args: { form: HTMLFormElement }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormDisabled]?: (args: { disabled: boolean }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormReset]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormStateRestore]?: (args: {
    state: unknown
    reason: 'autocomplete' | 'restore'
  }) => void | Promise<void>
}
/**
 * Extended handlers type that combines behavioral program handlers with lifecycle callbacks,
 * explicitly excluding DOM mutation handlers that are managed internally.
 *
 * @extends {Handlers} Base behavioral program handlers
 *
 * Excluded Handlers:
 * - onAppend: Managed by stream association
 * - onPrepend: Managed by stream association
 * - onReplaceChildren: Managed by stream association
 *
 * @example
 * ```ts
 * type MyHandlers = PlaitedHandlers & {
 *   UPDATE: (data: MyData) => void;
 *   RESET: () => void;
 * };
 *
 * const handlers: MyHandlers = {
 *   // Custom event handlers
 *   UPDATE(data) {
 *     console.log('Update received:', data);
 *   },
 *   RESET() {
 *     console.log('Reset triggered');
 *   },
 *
 *   // Lifecycle handlers
 *   onConnected() {
 *     console.log('Element connected');
 *   },
 *
 *   // ❌ These are not allowed (managed internally)
 *   // onAppend: () => {}, // Type error
 *   // onPrepend: () => {}, // Type error
 *   // onReplaceChildren: () => {} // Type error
 * };
 * ```
 *
 * @remarks
 * - Combines behavioral and lifecycle handlers
 * - Prevents manual DOM mutation handling
 * - Ensures proper stream handling
 * - Maintains type safety
 * - Allows custom event handlers
 * - Preserves lifecycle callbacks
 *
 * @see streamAssociated option in GetElementArgs for DOM mutation handling
 */
export type PlaitedHandlers = Handlers & {
  [ELEMENT_CALLBACKS.onAppend]?: never
  [ELEMENT_CALLBACKS.onPrepend]?: never
  [ELEMENT_CALLBACKS.onReplaceChildren]?: never
}

type RequirePlaitedElementCallbackHandlers = Required<PlaitedElementCallbackHandlers>

type PlaitedElementCallbackParameters = {
  [K in keyof RequirePlaitedElementCallbackHandlers]: Parameters<RequirePlaitedElementCallbackHandlers[K]> extends (
    undefined
  ) ?
    undefined
  : Parameters<RequirePlaitedElementCallbackHandlers[K]>[0]
}
/**
 * Configuration options for creating a Plaited custom element.
 * Defines element behavior, structure, and capabilities.
 *
 * @template A Type extending PlaitedHandlers for element's event handling
 *
 * Properties:
 * @property tag Custom element tag name (must contain hyphen)
 * @property shadowDom Shadow DOM template definition
 * @property delegatesFocus Whether to delegate focus through shadow DOM
 * @property mode Shadow root encapsulation mode
 * @property slotAssignment Slot content distribution strategy
 * @property observedAttributes Array of attributes to watch for changes
 * @property publicEvents Array of exposed event types
 * @property formAssociated Enable form-associated custom element features
 * @property streamAssociated Enable stream-based DOM mutations
 * @property bProgram Behavioral program definition with lifecycle hooks
 *
 * @example Basic Element
 * ```ts
 * const config: GetElementArgs<MyHandlers> = {
 *   tag: 'my-element',
 *   shadowDom: template,
 *   mode: 'open',
 *   delegatesFocus: false,
 *   slotAssignment: 'named',
 *   observedAttributes: ['disabled', 'value'],
 *   publicEvents: ['change', 'input'],
 *   bProgram({ $, trigger }) {
 *     return {
 *       onConnected() {
 *         console.log('Connected');
 *       },
 *       onChange(detail) {
 *         trigger({ type: 'update', detail });
 *       }
 *     };
 *   }
 * };
 * ```
 *
 * @example Form Association
 * ```ts
 * const formConfig: GetElementArgs<FormHandlers> = {
 *   ...config,
 *   formAssociated: true,
 *   bProgram({ $, trigger, internals }) {
 *     return {
 *       onFormAssociated({ form }) {
 *         console.log('Associated with:', form);
 *       },
 *       onFormReset() {
 *         internals.setFormValue('');
 *       }
 *     };
 *   }
 * };
 * ```
 *
 * @example Stream Association
 * ```ts
 * const streamConfig: GetElementArgs<StreamHandlers> = {
 *   ...config,
 *   streamAssociated: true,
 *   // Enables automatic handling of DOM mutations
 *   // through onAppend, onPrepend, onReplaceChildren
 * };
 * ```
 *
 * @remarks
 * - Custom element tag must contain a hyphen
 * - Mode 'closed' provides stronger encapsulation
 * - Form association enables form-specific callbacks
 * - Stream association enables DOM mutation handlers
 * - Observed attributes trigger attributeChanged
 * - Public events are exposed outside shadow DOM
 */
export type GetElementArgs<A extends PlaitedHandlers> = {
  tag: CustomElementTag
  shadowDom: TemplateObject
  delegatesFocus: boolean
  mode: 'open' | 'closed'
  slotAssignment: 'named' | 'manual'
  observedAttributes?: string[]
  publicEvents?: string[]
  formAssociated?: true
  streamAssociated?: true
  bProgram?: {
    (this: PlaitedElement, args: BProgramArgs): A & PlaitedElementCallbackHandlers
  }
}

const createDocumentFragment = (html: string) => {
  const tpl = document.createElement('template')
  tpl.setHTMLUnsafe(html)
  return tpl.content
}
/**
 * Creates and registers a custom element with Plaited's behavioral programming model.
 * Provides comprehensive custom element functionality with shadow DOM, form association,
 * and behavioral programming integration.
 *
 * @template A Type extending PlaitedHandlers for element's event handling
 * @param config Element configuration and behavior definition
 *
 * Features:
 * - Shadow DOM encapsulation
 * - Form association support
 * - Event delegation
 * - Attribute observation
 * - Stream-based DOM mutations
 * - Behavioral programming model
 * - Automatic cleanup
 *
 * @example Basic Custom Element
 * ```ts
 * const MyElement = getElement({
 *   tag: 'my-element',
 *   shadowDom: html`
 *     <div p-target="container">
 *       <slot></slot>
 *     </div>
 *   `,
 *   mode: 'open',
 *   delegatesFocus: false,
 *   slotAssignment: 'named',
 *   observedAttributes: ['disabled'],
 *   publicEvents: ['change'],
 *
 *   bProgram({ $, trigger }) {
 *     const [container] = $('container');
 *
 *     return {
 *       onConnected() {
 *         console.log('Element connected');
 *       },
 *
 *       onAttributeChanged({ name, newValue }) {
 *         if (name === 'disabled') {
 *           container.attr('disabled', newValue);
 *         }
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example Form-Associated Element
 * ```ts
 * const FormElement = getElement({
 *   tag: 'form-element',
 *   formAssociated: true,
 *   // ... other config
 *
 *   bProgram({ internals, trigger }) {
 *     return {
 *       onFormAssociated({ form }) {
 *         console.log('Associated with form:', form);
 *       },
 *
 *       UPDATE_VALUE({ value }) {
 *         internals.setFormValue(value);
 *         trigger({
 *           type: 'change',
 *           detail: value
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example Stream-Associated Element
 * ```ts
 * const StreamElement = getElement({
 *   tag: 'stream-element',
 *   streamAssociated: true,
 *   // ... other config
 *
 *   bProgram({ trigger }) {
 *     return {
 *       // DOM mutations handled automatically
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * - Only registers if element isn't already defined
 * - Requires DOM environment (checks with canUseDOM)
 * - Automatically manages element lifecycle
 * - Handles attribute reflection
 * - Manages event delegation
 * - Provides automatic cleanup
 * - Maintains type safety
 *
 * Private Fields:
 * - #internals: ElementInternals instance
 * - #root: Shadow root reference
 * - #query: Shadow DOM query utility
 * - #shadowObserver: Mutation observer for p-trigger
 * - #trigger: Internal event trigger
 * - #useFeedback: Event feedback utility
 * - #useSnapshot: State snapshot utility
 * - #bThreads: Behavioral thread management
 * - #disconnectSet: Cleanup callback storage
 *
 */
export const getElement = <A extends PlaitedHandlers>({
  tag,
  formAssociated,
  publicEvents,
  observedAttributes = [],
  shadowDom,
  delegatesFocus,
  mode,
  slotAssignment,
  streamAssociated,
  bProgram: callback,
}: GetElementArgs<A>) => {
  if (canUseDOM() && !customElements.get(tag)) {
    customElements.define(
      tag,
      class extends HTMLElement implements PlaitedElement {
        static observedAttributes = [...observedAttributes]
        static formAssociated = formAssociated
        get publicEvents() {
          return publicEvents
        }
        #internals: ElementInternals
        get #root() {
          return this.#internals.shadowRoot as ShadowRoot
        }
        #shadowObserver?: MutationObserver
        #trigger: PlaitedTrigger
        #useFeedback: UseFeedback
        #useSnapshot: UseSnapshot
        #bThreads: BThreads
        #disconnectSet = new Set<Disconnect>()
        trigger: Trigger
        constructor() {
          super()
          this.#internals = this.attachInternals()
          const frag = getDocumentFragment(this.#root, [shadowDom])
          this.attachShadow({ mode, delegatesFocus, slotAssignment })
          this.#root.replaceChildren(frag)
          const { trigger, useFeedback, useSnapshot, bThreads } = bProgram()
          this.#trigger = getPlaitedTrigger(trigger, this.#disconnectSet)
          this.#useFeedback = useFeedback
          this.#useSnapshot = useSnapshot
          this.#bThreads = bThreads
          this.trigger = getPublicTrigger({
            trigger,
            publicEvents,
          })
        }
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
          this.#trigger<PlaitedElementCallbackParameters['onAttributeChanged']>({
            type: ELEMENT_CALLBACKS.onAttributeChanged,
            detail: { name, oldValue, newValue },
          })
        }
        adoptedCallback() {
          this.#trigger({ type: ELEMENT_CALLBACKS.onAdopted })
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
          if (callback) {
            // Delegate listeners nodes with p-trigger directive on connection or upgrade
            addListeners(Array.from(this.#root.querySelectorAll<Element>(`[${P_TRIGGER}]`)), this.#trigger)
            // Bind DOM helpers to nodes with p-target directive on connection or upgrade
            assignHelpers(
              getBoundElements(this.#root),
              Array.from(this.#root.querySelectorAll<Element>(`[${P_TARGET}]`)),
            )
            // Create a shadow observer to watch for modification & addition of nodes with p-this.#trigger directive
            this.#shadowObserver = getShadowObserver(this.#root, this.#trigger)
            // bind connectedCallback to the custom element with the following arguments
            const handlers = callback.bind(this)({
              $: <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
                Array.from(
                  this.#root.querySelectorAll<Element>(`[${P_TARGET}${match}"${target}"]`),
                ) as BoundElement<T>[],
              host: this,
              root: this.#root,
              internals: this.#internals,
              trigger: this.#trigger,
              useSnapshot: this.#useSnapshot,
              bThreads: this.#bThreads,
              bThread,
              bSync,
            })
            // Subscribe feedback handlers to behavioral program and add disconnect callback to disconnect set
            this.#disconnectSet.add(
              this.#useFeedback({
                ...handlers,
                ...(streamAssociated && {
                  [ELEMENT_CALLBACKS.onAppend]: (html: string) => this.append(createDocumentFragment(html)),
                  [ELEMENT_CALLBACKS.onPrepend]: (html: string) => this.prepend(createDocumentFragment(html)),
                  [ELEMENT_CALLBACKS.onReplaceChildren]: (html: string) =>
                    this.replaceChildren(createDocumentFragment(html)),
                }),
              }),
            )
          }
          this.#trigger({ type: ELEMENT_CALLBACKS.onConnected })
        }
        disconnectedCallback() {
          this.#shadowObserver?.disconnect()
          for (const cb of this.#disconnectSet) cb()
          this.#disconnectSet.clear()
          this.#trigger({ type: ELEMENT_CALLBACKS.onDisconnected })
        }
        formAssociatedCallback(form: HTMLFormElement) {
          this.#trigger<PlaitedElementCallbackParameters['onFormAssociated']>({
            type: ELEMENT_CALLBACKS.onFormAssociated,
            detail: { form },
          })
        }
        formDisabledCallback(disabled: boolean) {
          this.#trigger<PlaitedElementCallbackParameters['onFormDisabled']>({
            type: ELEMENT_CALLBACKS.onFormDisabled,
            detail: { disabled },
          })
        }
        formResetCallback() {
          this.#trigger({ type: ELEMENT_CALLBACKS.onFormReset })
        }
        formStateRestoreCallback(state: unknown, reason: 'autocomplete' | 'restore') {
          this.#trigger<PlaitedElementCallbackParameters['onFormStateRestore']>({
            type: ELEMENT_CALLBACKS.onFormStateRestore,
            detail: { state, reason },
          })
        }
      },
    )
  }
}
