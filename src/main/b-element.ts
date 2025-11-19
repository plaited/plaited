/**
 * @internal
 * @module b-element
 *
 * Purpose: Implements the BehavioralTemplate system that bridges Web Components and behavioral programming.
 * Creates custom elements with Shadow DOM, event handling, and behavioral program integration.
 *
 * Architecture:
 * - Extends HTMLElement with behavioral programming capabilities
 * - Manages Shadow DOM lifecycle and element bindings via p-target attributes
 * - Integrates event delegation system with p-trigger attributes
 * - Coordinates behavioral threads with DOM element lifecycle
 *
 * Dependencies:
 * - behavioral.ts: Core behavioral programming engine
 * - create-template.ts: JSX template creation
 * - use-plaited-trigger.ts: Internal trigger system
 * - use-public-trigger.ts: Public event trigger
 * - delegated-listener.ts: Event delegation
 *
 * Consumers: Application code creating custom elements with behavioral programming
 */

import type {
  PlaitedTrigger,
  Handlers,
  BThreads,
  Disconnect,
  Trigger,
  UseFeedback,
  UseSnapshot,
  EventDetails,
} from './behavioral.types.js'
import { behavioral } from './behavioral.js'
import { bThread, bSync } from './behavioral.utils.js'
import { usePlaitedTrigger } from './use-plaited-trigger.js'
import { usePublicTrigger } from './use-public-trigger.js'
import { canUseDOM } from '../utils.js'
import { delegates, DelegatedListener } from './delegated-listener.js'
import type { Attrs, TemplateObject, CustomElementTag } from './create-template.types.js'
import { P_TRIGGER, P_TARGET, BOOLEAN_ATTRS } from './create-template.constants.js'
import { createTemplate } from './create-template.js'
import { getDocumentFragment, assignHelpers, getBindings } from './b-element.utils.js'
import { BEHAVIORAL_TEMPLATE_IDENTIFIER, ELEMENT_CALLBACKS } from './b-element.constants.js'
import type {
  BehavioralTemplate,
  BehavioralElement,
  SelectorMatch,
  Bindings,
  BoundElement,
  BehavioralElementCallbackDetails,
  BProgramArgs,
} from './b-element.types.js'

/**
 * @internal
 * Type for lifecycle callback functions with optional detail payload.
 */
type Callback<T> = T extends void ? () => void | Promise<void> : (detail: T) => void | Promise<void>

/**
 * @internal
 * Type mapping for behavioral element lifecycle callbacks.
 */
type BehavioralElementCallbackHandlers = {
  [K in keyof BehavioralElementCallbackDetails]?: Callback<BehavioralElementCallbackDetails[K]>
}

/**
 * @internal
 * Parses the p-trigger attribute into a Map of event types to trigger names.
 */
const getTriggerMap = (el: Element) =>
  new Map((el.getAttribute(P_TRIGGER) as string).split(' ').map((pair) => pair.split(':')) as [string, string][])

/**
 * @internal
 * Determines the trigger type for an event by traversing the composed path and checking p-trigger attributes.
 */
const getTriggerType = (event: Event, context: Element) => {
  const el =
    context.tagName !== 'SLOT' && event.currentTarget === context ? context
    : event.composedPath().find((el) => el instanceof ShadowRoot) === context.getRootNode() ? context
    : undefined
  if (!el) return
  return getTriggerMap(el).get(event.type)
}

/**
 * @internal
 * Type guard to check if a Node is an Element.
 */
const isElement = (node: Node): node is Element => node.nodeType === 1

/**
 * Creates a Web Component with behavioral programming and Shadow DOM support.
 * Core building block for Plaited applications enabling declarative event handling,
 * reactive state management, and behavioral thread coordination.
 *
 * @template A Event details type for component-specific events
 * @param options Component configuration including tag name, Shadow DOM template, and behavioral program
 * @returns BehavioralTemplate function for creating and rendering element instances
 *
 * @example Simple counter component
 * ```tsx
 * const Counter = bElement({
 *   tag: 'my-counter',
 *   shadowDom: (
 *     <div>
 *       <button p-target="dec" p-trigger={{ click: 'DEC' }}>-</button>
 *       <span p-target="count">0</span>
 *       <button p-target="inc" p-trigger={{ click: 'INC' }}>+</button>
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     const [count] = $('count');
 *     let value = 0;
 *
 *     return {
 *       INC() {
 *         count.render(String(++value));
 *       },
 *       DEC() {
 *         count.render(String(--value));
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example Form-associated component with validation
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
       {...css.join(styles.symbol, hostStyles)}
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
 *
 * @see {@link BehavioralTemplate} for the return type structure
 * @see {@link BProgramArgs} for behavioral program arguments
 * @see {@link behavioral} for the behavioral programming engine
 * @see {@link bThread} for creating behavioral threads
 * @see {@link bSync} for synchronization points
 * @see {@link createStyles} for styling Shadow DOM children
 * @see {@link createHostStyles} for styling the host element
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
    (this: BehavioralElement, args: BProgramArgs): Handlers<A> & BehavioralElementCallbackHandlers
  }
}): BehavioralTemplate => {
  if (canUseDOM() && !customElements.get(tag)) {
    customElements.define(
      tag,
      class extends HTMLElement implements BehavioralElement {
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
          this.#trigger = usePlaitedTrigger(trigger, this.#disconnectSet)
          this.#useFeedback = useFeedback
          this.#useSnapshot = useSnapshot
          this.#bThreads = bThreads
          this.trigger = usePublicTrigger({
            trigger,
            publicEvents,
          })
        }
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
          this.#trigger<{
            type: typeof ELEMENT_CALLBACKS.onAttributeChanged
            detail: BehavioralElementCallbackDetails['onAttributeChanged']
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
            detail: BehavioralElementCallbackDetails['onFormAssociated']
          }>({
            type: ELEMENT_CALLBACKS.onFormAssociated,
            detail: form,
          })
        }
        formDisabledCallback(disabled: boolean) {
          this.#trigger<{
            type: typeof ELEMENT_CALLBACKS.onFormDisabled
            detail: BehavioralElementCallbackDetails['onFormDisabled']
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
            detail: BehavioralElementCallbackDetails['onFormStateRestore']
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
  ft.$ = BEHAVIORAL_TEMPLATE_IDENTIFIER
  ft.publicEvents = publicEvents
  ft.observedAttributes = observedAttributes
  return ft
}
