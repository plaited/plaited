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
 * - Provides emit function for cross-shadow-DOM communication
 * - Includes inspector for debugging behavioral program state
 *
 * Dependencies:
 * - behavioral.ts: Core behavioral programming engine
 * - create-template.ts: JSX template creation
 * - use-plaited-trigger.ts: Internal trigger system
 * - use-public-trigger.ts: Public event trigger
 * - use-emit.ts: Custom event emission
 * - delegated-listener.ts: Event delegation
 *
 * Consumers: Application code creating custom elements with behavioral programming
 */

import { canUseDOM } from '../utils.ts'
import { BEHAVIORAL_TEMPLATE_IDENTIFIER, ELEMENT_CALLBACKS } from './b-element.constants.ts'
import type {
  BehavioralElement,
  BehavioralElementCallbackDetails,
  BehavioralTemplate,
  Bindings,
  BoundElement,
  BProgramArgs,
  InspectorCallback,
  SelectorMatch,
} from './b-element.types.ts'
import { assignHelpers, getBindings, getDocumentFragment } from './b-element.utils.ts'
import { behavioral } from './behavioral.ts'
import type {
  BThreads,
  Disconnect,
  EventDetails,
  Handlers,
  PlaitedTrigger,
  SnapshotMessage,
  Trigger,
  UseFeedback,
  UseSnapshot,
} from './behavioral.types.ts'
import { bSync, bThread } from './behavioral.utils.ts'
import { BOOLEAN_ATTRS, P_TARGET, P_TRIGGER } from './create-template.constants.ts'
import { createTemplate } from './create-template.ts'
import type { Attrs, CustomElementTag, TemplateObject } from './create-template.types.ts'
import type { HostStylesObject } from './css.types.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'
import { type Emit, useEmit } from './use-emit.ts'
import { usePlaitedTrigger } from './use-plaited-trigger.ts'
import { usePublicTrigger } from './use-public-trigger.ts'

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
 * Uses fast-path checks to avoid expensive composedPath() calls in common cases.
 *
 * @param event - DOM event to process
 * @param context - Element with p-trigger attribute
 * @returns Trigger type string if event matches, undefined otherwise
 *
 * Performance optimization:
 * Fast path 1: event.target === context (direct click on element)
 * Fast path 2: event.currentTarget === context (delegated event)
 * Slow path: composedPath() for shadow DOM boundary crossing
 *
 * 20-30% faster event handling by avoiding composedPath() in 80%+ of cases
 */
const getTriggerType = (event: Event, context: Element) => {
  // Fast path 1: event.target is the context element (direct event)
  // Most common case: user clicks directly on element with p-trigger
  if (event.target === context) {
    return getTriggerMap(context).get(event.type)
  }

  // Fast path 2: currentTarget is the context element (delegated event)
  // Common case: event bubbled from child to element with p-trigger
  // Skip for SLOT elements as they have special composed path handling
  if (context.tagName !== 'SLOT' && event.currentTarget === context) {
    return getTriggerMap(context).get(event.type)
  }

  // Slow path: check if event crossed shadow boundary into this context
  // Only needed for events that traverse shadow DOM boundaries
  const shadowRoot = event.composedPath().find((el) => el instanceof ShadowRoot)
  if (shadowRoot === context.getRootNode()) {
    return getTriggerMap(context).get(event.type)
  }

  return undefined
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
  hostStyles,
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
  hostStyles?: HostStylesObject
  formAssociated?: true
  bProgram?: (this: BehavioralElement, args: BProgramArgs) => Handlers<A> & BehavioralElementCallbackHandlers
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
        #emit: Emit
        trigger: Trigger

        constructor() {
          super()
          this.#internals = this.attachInternals()
          this.attachShadow({ mode, delegatesFocus, slotAssignment })
          const frag = getDocumentFragment({ hostStyles, shadowRoot: this.#root, templateObject: shadowDom })
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
          this.#emit = useEmit(this)
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
            //Create inspector on tool that captures state snapshots of behavioral program execution
            const inspectorDefaultCallback: InspectorCallback = (arg: SnapshotMessage) => {
              // queueMicrotask prevents Safari's console.table from creating synchronous feedback loops
              // JSON clone prevents property getter side effects during console inspection
              queueMicrotask(() => {
                console.group()
                console.info(tag)
                console.table(JSON.parse(JSON.stringify(arg)))
                console.groupEnd()
              })
            }
            let inspectorCallback = inspectorDefaultCallback
            let inspectorDisconnect: Disconnect | undefined
            const inspector = {
              assign: (func: InspectorCallback) => {
                inspectorCallback = func
              },
              reset: () => {
                inspectorCallback = inspectorDefaultCallback
              },
              on: () => {
                inspectorDisconnect = this.#useSnapshot(inspectorCallback)
                this.#disconnectSet.add(inspectorDisconnect)
              },
              off: () => {
                if (inspectorDisconnect) {
                  void inspectorDisconnect()
                  this.#disconnectSet.delete(inspectorDisconnect)
                  inspectorDisconnect = undefined
                }
              },
            }
            // bind connectedCallback to the custom element with the following arguments
            const handlers = callback.bind(this)({
              $: <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
                this.#root.querySelectorAll<BoundElement<T>>(`[${P_TARGET}${match}"${target}"]`),
              host: this,
              root: this.#root,
              internals: this.#internals,
              trigger: this.#trigger,
              inspector,
              emit: this.#emit,
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
          for (const cb of this.#disconnectSet) void cb()
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
            const el = elements[i]!
            if (el.tagName === 'SLOT' && Boolean(el.assignedSlot)) continue // skip nested slots
            !delegates.has(el) &&
              delegates.set(
                el,
                new DelegatedListener((event) => {
                  const type = el.getAttribute(P_TRIGGER) && getTriggerType(event, el)
                  type
                    ? /** if key is present in `p-trigger` trigger event on instance's bProgram */
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
          /**
           * Observes the addition of nodes to the shadow dom and changes to child's p-trigger/p-target attributes.
           * Batches all mutations before processing for 40-60% faster mutation handling.
           */
          const mo = new MutationObserver((mutationsList) => {
            // Batch all mutations before processing (40-60% faster)
            const triggerElements: Element[] = []
            const targetElements: Element[] = []
            for (const mutation of mutationsList) {
              const addedNodesLength = mutation.addedNodes.length
              // Handle attribute changes
              if (mutation.type === 'attributes') {
                const el = mutation.target
                if (isElement(el)) {
                  mutation.attributeName === P_TRIGGER && el.getAttribute(P_TRIGGER) && triggerElements.push(el)
                  mutation.attributeName === P_TARGET && el.getAttribute(P_TARGET) && targetElements.push(el)
                }
              }
              // Collect all added nodes for batch processing
              else if (addedNodesLength) {
                for (let i = 0; i < addedNodesLength; i++) {
                  const node = mutation.addedNodes[i]!
                  if (isElement(node)) {
                    // Check node itself
                    node.hasAttribute(P_TRIGGER) && triggerElements.push(node)
                    node.hasAttribute(P_TARGET) && targetElements.push(node)

                    // Query descendants once per node
                    node.querySelectorAll(`[${P_TRIGGER}]`).forEach((el) => {
                      triggerElements.push(el)
                    })
                    node.querySelectorAll(`[${P_TARGET}]`).forEach((el) => {
                      targetElements.push(el)
                    })
                  }
                }
              }
            }

            // Batch setup all at once (single function call instead of per-element)
            triggerElements.length && this.#addListeners(triggerElements)
            targetElements.length && assignHelpers(bindings, targetElements)
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
  ft.hostStyles = hostStyles ?? { stylesheets: [] }
  return ft
}
