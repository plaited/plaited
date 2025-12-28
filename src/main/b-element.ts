/**
 * @internal
 * BehavioralTemplate system bridging Custom Elements and behavioral programming.
 * Creates custom elements with Shadow DOM, event delegation, and BP integration.
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
import { useInspectorCallback } from './use-inspector-callback.ts'
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
 */
const getTriggerType = (event: Event, context: Element) => {
  const el =
    context.tagName !== 'SLOT' && event.currentTarget === context
      ? context
      : event.composedPath().find((el) => el instanceof ShadowRoot) === context.getRootNode()
        ? context
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
 * Creates Custom Elements with behavioral programming and Shadow DOM support.
 * Core building block for Plaited applications enabling declarative event handling,
 * reactive state management, and behavioral thread coordination.
 *
 * @template A Event details type for element-specific events
 * @param options BehavioralElement configuration including tag name, Shadow DOM template, and behavioral program
 * @returns BehavioralTemplate function for creating and rendering element instances
 *
 * @remarks
 * **Key Concepts:**
 * 1.  **BehavioralElement Definition:**
 *     *   Define custom element tags with a required hyphen (e.g., `my-element`).
 *     *   Utilize Shadow DOM for style and content encapsulation.
 *     *   Observe attributes for changes and reflect properties to attributes if needed.
 *     *   Enable form association for elements that should interact with HTML forms.
 * 2.  **Event & State Management:**
 *     *   Use `p-trigger` attribute for declarative event bindings in templates, mapping DOM events to behavioral program event types.
 *     *   Implement element logic within the `bProgram` function, which leverages behavioral programming principles.
 *     *   Manage complex state interactions and asynchronous flows using behavioral threads (`bThread`, `bSync`).
 *     *   Benefit from automatic event delegation for `p-trigger`'d events, enhancing performance.
 * 3.  **DOM Interactions:**
 *     *   Select elements within the Shadow DOM using the `$` query selector function provided in `BProgramArgs`, targeting elements with the `p-target` attribute.
 *     *   Manipulate selected elements using helper methods like `render`, `insert`, `attr` available on `BoundElement` instances.
 *     *   Interact with the Shadow DOM using standard APIs and manage content distribution with `<slot>` elements.
 *
 * **Best Practices:**
 * 1.  **Template Design:**
 *     *   Design templates with a clear, single purpose to promote reusability and maintainability.
 *     *   Use TypeScript to define types for template attributes, events, and event payloads for better type safety and developer experience.
 *     *   Leverage Shadow DOM for strong encapsulation of styles and markup.
 *     *   Adhere to Custom Elements API standards and conventions.
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
 * *   **Custom Element Lifecycle**: Utilize `onConnected`, `onDisconnected`, `onAttributeChanged`, etc., for managing custom element lifecycle logic.
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
            const bindings = getBindings(this.#root)
            this.#addListeners(this.#root.querySelectorAll<Element>(`[${P_TRIGGER}]`))
            assignHelpers(bindings, this.#root.querySelectorAll<Element>(`[${P_TARGET}]`))
            this.#shadowObserver = this.#getShadowObserver(bindings)
            const inspectorDefaultCallback = useInspectorCallback(tag)
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
            if (el.tagName === 'SLOT' && Boolean(el.assignedSlot)) continue
            !delegates.has(el) &&
              delegates.set(
                el,
                new DelegatedListener((event) => {
                  const type = el.getAttribute(P_TRIGGER) && getTriggerType(event, el)
                  type
                    ? this.#trigger?.({ type, detail: event })
                    : el.removeEventListener(event.type, delegates.get(el))
                }),
              )
            for (const [event] of getTriggerMap(el)) {
              el.addEventListener(event, delegates.get(el))
            }
          }
        }
        #getShadowObserver(bindings: Bindings) {
          const mo = new MutationObserver((mutationsList) => {
            const triggerElements = new Set<Element>()
            const targetElements = new Set<Element>()
            for (const mutation of mutationsList) {
              const addedNodesLength = mutation.addedNodes.length
              if (mutation.type === 'attributes') {
                const el = mutation.target
                if (isElement(el)) {
                  mutation.attributeName === P_TRIGGER && el.getAttribute(P_TRIGGER) && triggerElements.add(el)
                  mutation.attributeName === P_TARGET && el.getAttribute(P_TARGET) && targetElements.add(el)
                }
              } else if (addedNodesLength) {
                for (let i = 0; i < addedNodesLength; i++) {
                  const node = mutation.addedNodes[i]!
                  if (isElement(node)) {
                    node.hasAttribute(P_TRIGGER) && triggerElements.add(node)
                    node.hasAttribute(P_TARGET) && targetElements.add(node)

                    node.querySelectorAll(`[${P_TRIGGER}]`).forEach((el) => {
                      triggerElements.add(el)
                    })
                    node.querySelectorAll(`[${P_TARGET}]`).forEach((el) => {
                      targetElements.add(el)
                    })
                  }
                }
              }
            }

            triggerElements.size && this.#addListeners(Array.from(triggerElements))
            targetElements.size && assignHelpers(bindings, Array.from(targetElements))
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
  shadowDom.stylesheets.length &&
    shadowDom.html.unshift(`<style>${[...new Set(shadowDom.stylesheets)].join('')}</style>`)
  const ft = ({ children = [], ...attrs }: Attrs) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: {
            ...shadowDom,
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
