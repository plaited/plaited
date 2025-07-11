import {
  type BSync,
  type BThread,
  bThread,
  bSync,
  type PlaitedTrigger,
  getPlaitedTrigger,
  type Handlers,
  type BThreads,
  type Disconnect,
  type Trigger,
  type UseFeedback,
  type UseSnapshot,
  type EventDetails,
  behavioral,
  getPublicTrigger,
} from '../behavioral.js'
import { delegates, DelegatedListener, canUseDOM } from '../utils.js'
import type { Attrs, TemplateObject, CustomElementTag } from './jsx.types.js'
import { P_TRIGGER, P_TARGET, BOOLEAN_ATTRS } from './jsx.constants.js'
import { createTemplate } from './create-template.js'
import { getDocumentFragment, assignHelpers, getBindings } from './assign-helpers.js'
import { PLAITED_TEMPLATE_IDENTIFIER, ELEMENT_CALLBACKS } from './plaited.constants.js'
import type { PlaitedTemplate, PlaitedElement, SelectorMatch, Bindings, BoundElement } from './plaited.types.js'

/**
 * Arguments passed to the `bProgram` function when defining a Plaited element.
 * Provides essential utilities and context for the element's behavior and lifecycle management.
 *
 * @property $ - A query selector function scoped to the component's shadow root.
 *   Accepts a `p-target` value and an optional `SelectorMatch` modifier (e.g., `*=` for contains).
 *   Returns a `NodeListOf<BoundElement<E>>` containing Plaited-enhanced elements.
 * @property root - A reference to the component's shadow root.
 * @property host - A reference to the custom element instance itself.
 * @property internals - The `ElementInternals` instance associated with the element,
 *   providing access to form association features, ARIA properties, etc. Available when `formAssociated: true`.
 * @property trigger - The trigger function for dispatching events within the component's
 *   behavioral program. Automatically manages disconnect callbacks.
 * @property bThreads - An interface for managing behavioral threads (`bThread` instances).
 * @property useSnapshot - A function to get the current state snapshot of the behavioral program.
 * @property bThread - A utility function for creating behavioral threads.
 * @property bSync - A utility function for defining synchronization points within behavioral threads.
 *
 * @example
 * How `BProgramArgs` are received in a `bProgram`:
 * ```ts
 * const MyComponent = bElement({
 *   tag: 'my-component',
 *   shadowDom: <div p-target="content">Hello</div>,
 *   bProgram: ({ $, host, root, internals, trigger, bThreads, useSnapshot, bThread, bSync }) => {
 *     // Use $ to query elements
 *     const [contentDiv] = $<HTMLDivElement>('content');
 *     console.log(contentDiv.textContent); // "Hello"
 *
 *     // Access host and root
 *     console.log(host.tagName); // "MY-COMPONENT"
 *     console.log(root.mode); // "open"
 *
 *     // Use trigger to dispatch events
 *     const handleClick = () => trigger({ type: 'my-event', detail: 'clicked' });
 *     contentDiv.addEventListener('click', handleClick);
 *
 *     // Define event handlers
 *     return {
 *       'my-event': (detail) => console.log('Event triggered:', detail),
 *       onConnected: () => console.log('Component connected!'),
 *     };
 *   }
 * });
 * ```
 */
export type BProgramArgs = {
  $: <E extends Element = Element>(
    target: string,
    /**
     * This option enables querySelectorAll and modifies the attribute selector for p-target
     * @default {all: false, mod: "="}
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}
     */
    match?: SelectorMatch,
  ) => NodeListOf<BoundElement<E>>
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
 * Type definition mapping standard Custom Element lifecycle callbacks and
 * Form-Associated Custom Element callbacks to their handler function signatures within Plaited.
 * All handlers are optional and can be synchronous or asynchronous (`async`/`Promise`).
 *
 * @property onAdopted - Called when the element is moved to a new document (e.g., via `document.adoptNode`).
 *   Receives no arguments.
 * @property onAttributeChanged - Called when an attribute listed in `observedAttributes` changes.
 *   Receives an object with `name`, `oldValue`, and `newValue`.
 * @property onConnected - Called when the element is first connected to the document's DOM.
 *   Ideal for setup, initial rendering, and event listeners. Receives no arguments.
 * @property onDisconnected - Called when the element is disconnected from the document's DOM.
 *   Ideal for cleanup (removing listeners, stopping timers/observers). Receives no arguments.
 * @property onFormAssociated - Called when the element becomes associated with a form.
 *   Requires `formAssociated: true`. Receives the associated `HTMLFormElement`.
 * @property onFormDisabled - Called when the element's disabled state changes due to the parent
 *   `<fieldset>`'s disabled state changing. Requires `formAssociated: true`. Receives a boolean indicating the disabled state.
 * @property onFormReset - Called when the associated form is reset.
 *   Requires `formAssociated: true`. Receives no arguments.
 * @property onFormStateRestore - Called when the browser tries to restore the element's state
 *   (e.g., during navigation or browser restart). Requires `formAssociated: true`.
 *   Receives an object with `state` (the restored state) and `reason` ('autocomplete' or 'restore').
 */
export type PlaitedElementCallbackDetails = {
  [ELEMENT_CALLBACKS.onAdopted]: void
  [ELEMENT_CALLBACKS.onAttributeChanged]: {
    name: string
    oldValue: string | null
    newValue: string | null
  }
  [ELEMENT_CALLBACKS.onConnected]: void
  [ELEMENT_CALLBACKS.onDisconnected]: void
  [ELEMENT_CALLBACKS.onFormAssociated]: HTMLFormElement
  [ELEMENT_CALLBACKS.onFormDisabled]: boolean
  [ELEMENT_CALLBACKS.onFormReset]: void
  [ELEMENT_CALLBACKS.onFormStateRestore]: {
    state: unknown
    reason: 'autocomplete' | 'restore'
  }
}
type Callback<T> = T extends void ? () => void | Promise<void> : (detail: T) => void | Promise<void>
type PlaitedElementCallbackHandlers = {
  [K in keyof PlaitedElementCallbackDetails]?: Callback<PlaitedElementCallbackDetails[K]>
}

const getTriggerMap = (el: Element) =>
  new Map((el.getAttribute(P_TRIGGER) as string).split(' ').map((pair) => pair.split(':')) as [string, string][])

/** get trigger for elements respective event from triggerTypeMap */
const getTriggerType = (event: Event, context: Element) => {
  const el =
    context.tagName !== 'SLOT' && event.currentTarget === context ? context
    : event.composedPath().find((el) => el instanceof ShadowRoot) === context.getRootNode() ? context
    : undefined
  if (!el) return
  return getTriggerMap(el).get(event.type)
}

const isElement = (node: Node): node is Element => node.nodeType === 1

/**
 * Creates a reusable Web Component with behavioral programming, event delegation, and shadow DOM support.
 * The `bElement` function is the core building block of Plaited applications, providing a
 * declarative way to create custom elements with robust state management and DOM interactions.
 *
 * @template A - Generic type extending `EventDetails` for component-specific events and their payload types.
 * @param options - Configuration options for the element.
 * @param options.tag - Custom element tag name (must contain a hyphen, e.g., `my-element`).
 * @param options.shadowDom - The shadow DOM template for the component, typically created using JSX or `createTemplate`.
 * @param [options.mode='open'] - Shadow root mode (`'open'` or `'closed'`). Defaults to `'open'`.
 * @param [options.delegatesFocus=true] - Whether focus should be delegated from the host to the shadow DOM. Defaults to `true`.
 * @param [options.slotAssignment='named'] - The slot assignment mode for the shadow DOM (`'named'` or `'manual'`). Defaults to `'named'`.
 * @param [options.observedAttributes=[]] - An array of attribute names to observe for changes. Changes trigger `onAttributeChanged`.
 * @param [options.formAssociated] - If `true`, the element will be form-associated, enabling features like `ElementInternals`, form lifecycle callbacks, and participation in form submission.
 * @param [options.publicEvents=[]] - An array of event types (strings) that can be triggered externally on the element instance using its `trigger` method.
 * @param [options.bProgram] - The behavioral program function that defines the element's logic, event handlers, and lifecycle callback implementations. It receives `BProgramArgs` as its argument.
 * @returns A PlaitedTemplate function. When called, this function creates an instance of the custom element, returning a `TemplateObject` that can be rendered or used in other templates. The function itself also carries metadata like `tag`, `registry`, `publicEvents`, and `observedAttributes`.
 *
 * @example
 * Basic Counter Component
 * ```tsx
 * const Counter = bElement({
 *   tag: 'my-counter',
 *   shadowDom: (
 *     <div>
 *       <button p-target="decBtn" p-trigger={{ click: 'DECREMENT' }}>-</button>
 *       <span p-target="count">0</span>
 *       <button p-target="incBtn" p-trigger={{ click: 'INCREMENT' }}>+</button>
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     const [countEl] = $('count');
 *     let count = 0;
 *
 *     return {
 *       INCREMENT() {
 *         count++;
 *         countEl.render(`${count}`);
 *       },
 *       DECREMENT() {
 *         count--;
 *         countEl.render(`${count}`);
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example
 * Form-Associated Component
 * ```tsx
 * interface FormFieldEvents {
 *   'value-change': (evt: ChangeEvent & { target: HTMLInputElement }) => void;
 *   validate: () => void;
 * }
 *
 * const FormField = bElement<FormFieldEvents>({
 *   tag: 'form-field',
 *   formAssociated: true,
 *   observedAttributes: ['label', 'required'],
 *   shadowDom: (
 *     <div>
 *       <label p-target="label" />
 *       <input
 *         p-target="input"
 *         p-trigger={{
 *           change: 'value-change',
 *           blur: 'validate'
 *         }}
 *       />
 *       <span p-target="error" />
 *     </div>
 *   ),
 *   bProgram({ $, host, internals }) {
 *     const [label] = $('label');
 *     const [input] = $<HTMLInputElement>('input');
 *     const [error] = $('error');
 *
 *     return {
 *       onConnected() {
 *         label.render(host.label || '');
 *         input.attr({ required: host.required });
 *       },
 *       onAttributeChanged({ name, newValue }) {
 *         if (name === 'label') {
 *           label.render(newValue || '');
 *         }
 *       },
 *       'value-change'({ target }) {
 *         const value = target.value
 *         internals.setFormValue(value);
 *       },
 *       validate() {
 *         const isValid = input.checkValidity();
 *         if (!isValid) {
 *           error.render('This field is required');
 *           internals.setValidity({
 *             valueMissing: true
 *           }, 'This field is required');
 *         } else {
 *           error.render('');
 *           internals.setValidity({});
 *         }
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example
 * Component with Behavioral Threads
 * ```tsx
 * const styles = css.create({
  symbol: {
     height: '16px',
     width: '16px',
     backgroundColor: 'var(--fill)',
     gridArea: 'input',
   },
 })

 const hostStyles = css.host({
   display: 'inline-grid',
   '--fill': {
     default: 'lightblue',
     ':state(checked)': 'blue',
     ':state(disabled)': 'grey',
   },
 })

 // Type for events specific to ToggleInput
 interface ToggleInputEvents extends EventDetails {
   click: MouseEvent & { target: HTMLInputElement };
   checked: boolean;
   disabled: boolean;
   valueChange: string | null;
 }

 export const ToggleInput = bElement<ToggleInputEvents>({
   tag: 'toggle-input',
   observedAttributes: ['disabled', 'checked', 'value'],
   formAssociated: true,
   shadowDom: (
     <div
       p-target='symbol'
       {...css.assign(styles.symbol, hostStyles)}
       p-trigger={{ click: 'click' }}
     />
   ),
   bProgram({ trigger, internals, root, bThreads, bSync, bThread }) {
     bThreads.set({
       onDisabled: bThread(
         [
           bSync({
             block: [
               // Block 'checked' and 'valueChange' events if the component is disabled
               ({ type }) => type === 'checked' && internals.states.has('disabled'),
               ({ type }) => type === 'valueChange' && internals.states.has('disabled'),
             ],
           }),
         ],
         true, // `true` indicates this thread should be active on initialization
       ),
     })
     return {
       click() {
         // Toggle the 'checked' state
         trigger({ type: 'checked', detail: !internals.states.has('checked') });
       },
       checked(val) {
         root.host.toggleAttribute('checked', val); // Reflect state to attribute
         if (val) {
           internals.states.add('checked');
           // Set form value, using 'value' attribute if present, otherwise default to 'checked'
           internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked');
         } else {
           internals.states.delete('checked');
           internals.setFormValue('off'); // Or null, depending on desired form data
         }
       },
       disabled(val) {
         // Reflect 'disabled' state to ElementInternals
         if (val) {
           internals.states.add('disabled');
         } else {
           internals.states.delete('disabled');
         }
       },
       valueChange(val) {
         // Update form value if 'value' attribute changes and component is checked
         const isChecked = internals.states.has('checked');
         if (val && isChecked) {
           internals.setFormValue('on', val);
         } else if (isChecked) {
           // Fallback to default 'on' value if 'value' is removed but still checked
           internals.setFormValue('on', 'checked');
         }
       },
       onAttributeChanged({ name, newValue }) {
         // Trigger internal events based on attribute changes
         if (name === 'checked') trigger({ type: 'checked', detail: typeof newValue === 'string' });
         if (name === 'disabled') trigger({ type: 'disabled', detail: typeof newValue === 'string' });
         if (name === 'value') trigger({ type: 'valueChange', detail: newValue });
       },
       onConnected() {
         // Initialize states from attributes when connected
         if (root.host.hasAttribute('checked')) {
           internals.states.add('checked');
           internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked');
         }
         if (root.host.hasAttribute('disabled')) {
           internals.states.add('disabled');
         }
       },
     }
   },
 })
 * ```
 *
 * @remarks
 * **Key Concepts:**
 * 1.  **Component Definition:**
 *     *   Define custom element tags with a required hyphen (e.g., `my-element`).
 *     *   Utilize Shadow DOM for style and content encapsulation.
 *     *   Observe attributes for changes and reflect properties to attributes if needed.
 *     *   Enable form association for elements that should interact with HTML forms.
 * 2.  **Event & State Management:**
 *     *   Use `p-trigger` attribute for declarative event bindings in templates, mapping DOM events to behavioral program event types.
 *     *   Implement component logic within the `bProgram` function, which leverages behavioral programming principles.
 *     *   Manage complex state interactions and asynchronous flows using behavioral threads (`bThread`, `bSync`).
 *     *   Benefit from automatic event delegation for `p-trigger`'d events, enhancing performance.
 * 3.  **DOM Interactions:**
 *     *   Select elements within the Shadow DOM using the `$` query selector function provided in `BProgramArgs`, targeting elements with the `p-target` attribute.
 *     *   Manipulate selected elements using helper methods like `render`, `insert`, `attr` available on `BoundElement` instances.
 *     *   Interact with the Shadow DOM using standard APIs and manage content distribution with `<slot>` elements.
 *
 * **Best Practices:**
 * 1.  **Component Design:**
 *     *   Design components with a clear, single purpose to promote reusability and maintainability.
 *     *   Use TypeScript to define types for component properties, events, and event payloads for better type safety and developer experience.
 *     *   Leverage Shadow DOM for strong encapsulation of styles and markup.
 *     *   Adhere to Web Components standards and conventions.
 * 2.  **State Management:**
 *     *   Employ behavioral threads for managing intricate state logic, especially involving asynchronous operations or multiple event dependencies.
 *     *   Strive for immutable state patterns where possible within event handlers to simplify reasoning about state changes.
 *     *   Perform necessary cleanup (e.g., removing event listeners, clearing timers/intervals, disconnecting observers) in the `onDisconnected` callback.
 *     *   Utilize the `ElementInternals` API (via `internals` in `BProgramArgs`) for managing form-related state, accessibility properties, and custom states.
 * 3.  **Performance:**
 *     *   Minimize direct DOM queries by using `p-target` and the `$` selector.
 *     *   Rely on `p-trigger` for efficient event delegation.
 *     *   Batch DOM updates if performing multiple manipulations in a single handler, though Plaited's helpers often optimize this.
 *     *   Ensure all resources (listeners, observers, threads) are properly cleaned up in `onDisconnected` to prevent memory leaks.
 *
 * **Plaited-Specific Conventions:**
 * *   **Event Documentation**: Always document event types and payloads for `bProgram` handlers and `publicEvents`.
 * *   **Component Lifecycle**: Utilize `onConnected`, `onDisconnected`, `onAttributeChanged`, etc., for managing component lifecycle logic.
 * *   **Signal/Trigger Patterns**: Understand that `trigger` (from `BProgramArgs`) is used to send events/data into the behavioral program.
 * *   **Shadow DOM**: Be mindful of style scoping and how to cross shadow boundaries if necessary (e.g., CSS custom properties, `::part`).
 */
export const bElement = <A extends EventDetails>({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  slotAssignment = 'named',
  publicEvents = [],
  observedAttributes = [],
  formAssociated,
  bProgram: callback,
}: {
  tag: CustomElementTag
  shadowDom: TemplateObject
  delegatesFocus?: boolean
  mode?: 'open' | 'closed'
  slotAssignment?: 'named' | 'manual'
  observedAttributes?: string[]
  publicEvents?: string[]
  formAssociated?: true
  bProgram?: {
    (this: PlaitedElement, args: BProgramArgs): Handlers<A> & PlaitedElementCallbackHandlers
  }
}): PlaitedTemplate => {
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
          this.attachShadow({ mode, delegatesFocus, slotAssignment })
          const frag = getDocumentFragment(this.#root, shadowDom)
          this.#root.replaceChildren(frag)
          const { trigger, useFeedback, useSnapshot, bThreads } = behavioral()
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
          this.#trigger<{
            type: typeof ELEMENT_CALLBACKS.onAttributeChanged
            detail: PlaitedElementCallbackDetails['onAttributeChanged']
          }>({
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
            // Get dom helper bindings
            const bindings = getBindings(this.#root)
            // Delegate listeners nodes with p-trigger directive on connection or upgrade
            this.#addListeners(this.#root.querySelectorAll<Element>(`[${P_TRIGGER}]`))
            // Bind DOM helpers to nodes with p-target directive on connection or upgrade
            assignHelpers(bindings, this.#root.querySelectorAll<Element>(`[${P_TARGET}]`))
            // Create a shadow observer to watch for modification & addition of nodes with p-this.#trigger directive
            this.#shadowObserver = this.#getShadowObserver(bindings)
            // bind connectedCallback to the custom element with the following arguments
            const handlers = callback.bind(this)({
              $: <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
                this.#root.querySelectorAll<BoundElement<T>>(`[${P_TARGET}${match}"${target}"]`),
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
            this.#disconnectSet.add(this.#useFeedback(handlers))
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
          this.#trigger<{
            type: typeof ELEMENT_CALLBACKS.onFormAssociated
            detail: PlaitedElementCallbackDetails['onFormAssociated']
          }>({
            type: ELEMENT_CALLBACKS.onFormAssociated,
            detail: form,
          })
        }
        formDisabledCallback(disabled: boolean) {
          this.#trigger<{
            type: typeof ELEMENT_CALLBACKS.onFormDisabled
            detail: PlaitedElementCallbackDetails['onFormDisabled']
          }>({
            type: ELEMENT_CALLBACKS.onFormDisabled,
            detail: disabled,
          })
        }
        formResetCallback() {
          this.#trigger({ type: ELEMENT_CALLBACKS.onFormReset })
        }
        formStateRestoreCallback(state: unknown, reason: 'autocomplete' | 'restore') {
          this.#trigger<{
            type: typeof ELEMENT_CALLBACKS.onFormStateRestore
            detail: PlaitedElementCallbackDetails['onFormStateRestore']
          }>({
            type: ELEMENT_CALLBACKS.onFormStateRestore,
            detail: { state, reason },
          })
        }
        #addListeners(elements: NodeListOf<Element> | Element[]) {
          const length = elements.length
          for (let i = 0; i < length; i++) {
            const el = elements[i]
            if (el.tagName === 'SLOT' && Boolean(el.assignedSlot)) continue // skip nested slots
            !delegates.has(el) &&
              delegates.set(
                el,
                new DelegatedListener((event) => {
                  const type = el.getAttribute(P_TRIGGER) && getTriggerType(event, el)
                  type ?
                    /** if key is present in `p-trigger` trigger event on instance's bProgram */
                    this.#trigger?.({ type, detail: event })
                  : /** if key is not present in `p-trigger` remove event listener for this event on Element */
                    el.removeEventListener(event.type, delegates.get(el))
                }),
              )
            for (const [event] of getTriggerMap(el)) {
              // add event listeners for each event type
              el.addEventListener(event, delegates.get(el))
            }
          }
        }
        #getShadowObserver(bindings: Bindings) {
          /**  Observes the addition of nodes to the shadow dom and changes to and child's p-trigger attribute */
          const mo = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
              if (mutation.type === 'attributes') {
                const el = mutation.target
                if (isElement(el)) {
                  mutation.attributeName === P_TRIGGER && el.getAttribute(P_TRIGGER) && this.#addListeners([el])
                  mutation.attributeName === P_TARGET && el.getAttribute(P_TARGET) && assignHelpers(bindings, [el])
                }
              } else if (mutation.addedNodes.length) {
                const length = mutation.addedNodes.length
                for (let i = 0; i < length; i++) {
                  const node = mutation.addedNodes[i]
                  if (isElement(node)) {
                    this.#addListeners(
                      node.hasAttribute(P_TRIGGER) ?
                        [node, ...node.querySelectorAll(`[${P_TRIGGER}]`)]
                      : node.querySelectorAll(`[${P_TRIGGER}]`),
                    )

                    assignHelpers(
                      bindings,
                      node.hasAttribute(P_TARGET) ?
                        [node, ...node.querySelectorAll(`[${P_TARGET}]`)]
                      : node.querySelectorAll(`[${P_TARGET}]`),
                    )
                  }
                }
              }
            }
          })
          mo.observe(this.#root, {
            attributeFilter: [P_TRIGGER, P_TARGET],
            childList: true,
            subtree: true,
          })
          return mo
        }
      },
    )
  }
  const registry = new Set<string>([...shadowDom.registry, tag])
  /** We continue to hoist our stylesheet until we  create a custom element then we add it to front of the html array*/
  shadowDom.stylesheets.length && shadowDom.html.unshift(`<style>${shadowDom.stylesheets.join('')}</style>`)
  const ft = ({ children = [], ...attrs }: Attrs) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: {
            ...shadowDom,
            /** Having hoisted our stylsheets we reset the stylesheet array on the TemplateObject */
            stylesheets: [],
          },
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.registry = registry
  ft.tag = tag
  ft.$ = PLAITED_TEMPLATE_IDENTIFIER
  ft.publicEvents = publicEvents
  ft.observedAttributes = observedAttributes
  return ft
}
