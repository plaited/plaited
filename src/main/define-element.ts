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
import { type PlaitedTrigger, getPlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { getPublicTrigger } from '../behavioral/get-public-trigger.js'
import { delegates, DelegatedListener } from '../utils/delegated-listener.js'
import { canUseDOM } from '../utils/can-use-dom.js'
import type { Attrs, TemplateObject, CustomElementTag } from '../jsx/jsx.types.js'
import { P_TRIGGER, P_TARGET, BOOLEAN_ATTRS } from '../jsx/jsx.constants.js'
import { createTemplate } from '../jsx/create-template.js'
import { getDocumentFragment, assignHelpers, getBindings } from './assign-helpers.js'
import { PLAITED_TEMPLATE_IDENTIFIER, ELEMENT_CALLBACKS } from './plaited.constants.js'
import type { PlaitedTemplate, PlaitedElement, SelectorMatch, Bindings, BoundElement } from './plaited.types.js'

/**
 * @description Arguments passed to the `bProgram` function when defining a Plaited element.
 * Provides essential utilities and context for the element's behavior and lifecycle management.
 *
 * @property {function} $ - A query selector function scoped to the component's shadow root.
 *   Accepts a `p-target` value and an optional `SelectorMatch` modifier (e.g., `*=` for contains).
 *   Returns a `NodeListOf<BoundElement<E>>` containing Plaited-enhanced elements.
 * @property {ShadowRoot} root - A reference to the component's shadow root.
 * @property {PlaitedElement} host - A reference to the custom element instance itself.
 * @property {ElementInternals} internals - The `ElementInternals` instance associated with the element,
 *   providing access to form association features, ARIA properties, etc. Available when `formAssociated: true`.
 * @property {PlaitedTrigger} trigger - The trigger function for dispatching events within the component's
 *   behavioral program. Automatically manages disconnect callbacks.
 * @property {BThreads} bThreads - An interface for managing behavioral threads (`bThread` instances).
 * @property {UseSnapshot} useSnapshot - A function to get the current state snapshot of the behavioral program.
 * @property {BThread} bThread - A utility function for creating behavioral threads.
 * @property {BSync} bSync - A utility function for defining synchronization points within behavioral threads.
 */
export type BProgramArgs = {
  $: <E extends Element = Element>(
    target: string,
    /** This options enables querySelectorAll and modified the attribute selector for p-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
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
 * @description Type definition mapping standard Custom Element lifecycle callbacks and
 * Form-Associated Custom Element callbacks to their handler function signatures within Plaited.
 * All handlers are optional and can be synchronous or asynchronous (`async`/`Promise`).
 *
 * @property {() => void | Promise<void>} [onAdopted] - Called when the element is moved to a new document (e.g., via `document.adoptNode`).
 * @property {(args: { name: string, oldValue: string | null, newValue: string | null }) => void | Promise<void>} [onAttributeChanged] - Called when an attribute listed in `observedAttributes` changes.
 * @property {() => void | Promise<void>} [onConnected] - Called when the element is first connected to the document's DOM. Ideal for setup, initial rendering, and event listeners.
 * @property {() => void | Promise<void>} [onDisconnected] - Called when the element is disconnected from the document's DOM. Ideal for cleanup (removing listeners, stopping timers/observers).
 * @property {(args: { form: HTMLFormElement }) => void | Promise<void>} [onFormAssociated] - Called when the element becomes associated with a form. Requires `formAssociated: true`.
 * @property {(args: { disabled: boolean }) => void | Promise<void>} [onFormDisabled] - Called when the element's disabled state changes due to the parent `<fieldset>`'s disabled state changing. Requires `formAssociated: true`.
 * @property {() => void | Promise<void>} [onFormReset] - Called when the associated form is reset. Requires `formAssociated: true`.
 * @property {(args: { state: unknown, reason: 'autocomplete' | 'restore' }) => void | Promise<void>} [onFormStateRestore] - Called when the browser tries to restore the element's state (e.g., during navigation or browser restart). Requires `formAssociated: true`.
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
 * @description Represents the combined type for handlers within a Plaited component's `bProgram`.
 * It merges the base behavioral program `Handlers` type (allowing any event type string as a key)
 * with the specific `PlaitedElementCallbackHandlers` for lifecycle and form events.
 *
 * It explicitly *excludes* `onAppend`, `onPrepend`, and `onReplaceChildren` handlers, as these
 * are managed internally when the `streamAssociated` option is enabled in `defineElement`.
 *
 * @template T - Can optionally extend `Handlers` to provide more specific types for custom events.
 * @example
 * ```typescript
 * type MyCustomEvents = {
 *   'user-login': (detail: { userId: string }) => void;
 *   'data-loaded': (detail: { data: Record<string, any> }) => Promise<void>;
 * }
 *
 * type MyComponentHandlers = PlaitedHandlers<MyCustomEvents>;
 *
 * const handlers: MyComponentHandlers = {
 *   // Custom event handlers
 *   'user-login': ({ userId }) => { console.log(`User ${userId} logged in.`); },
 *   'data-loaded': async ({ data }) => { await processData(data); },
 *
 *   // Lifecycle handler
 *   onConnected() { console.log('Component connected.'); },
 *
 *   // Form handler (if formAssociated: true)
 *   onFormReset() { resetComponentState(); },
 *
 *   // Invalid handlers (will cause type errors)
 *   // onAppend: () => {},
 * };
 * ```
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
 * @description Configuration object used to define a Plaited custom element.
 * Specifies the element's tag name, shadow DOM structure, behavior, and lifecycle hooks.
 *
 * @template A - A type extending `PlaitedHandlers` that defines the specific event handlers and lifecycle callbacks implemented in the `bProgram`.
 *
 * @property {CustomElementTag} tag - The tag name for the custom element (e.g., 'my-element'). Must contain a hyphen.
 * @property {TemplateObject} shadowDom - The Plaited template object defining the element's shadow DOM structure. Typically created using JSX (`h`).
 * @property {boolean} [delegatesFocus=true] - If `true`, focus requests on the host element are delegated to the first focusable element within its shadow DOM. Corresponds to `attachShadow({ delegatesFocus: ... })`.
 * @property {'open' | 'closed'} [mode='open'] - The encapsulation mode for the shadow DOM ('open' allows external JavaScript access, 'closed' restricts it). Corresponds to `attachShadow({ mode: ... })`.
 * @property {'named' | 'manual'} [slotAssignment='named'] - The slot assignment mode for the shadow DOM. 'named' is the default behavior. Corresponds to `attachShadow({ slotAssignment: ... })`.
 * @property {string[]} [observedAttributes=[]] - An array of attribute names that the element should observe for changes. Changes trigger the `onAttributeChanged` callback. Also makes these attributes available as properties on the host element instance.
 * @property {string[]} [publicEvents=[]] - An array of event types that the component allows to be triggered on itself(outside its own `bProgram`). Used by `host.trigger`.
 * @property {true} [formAssociated] - If `true`, registers the element as a Form-Associated Custom Element, enabling form-related callbacks (`onFormAssociated`, etc.) and interaction with the `ElementInternals` API.
 * @property {true} [streamAssociated] - If `true`, enables Plaited's stream-based DOM mutation handlers (`onAppend`, `onPrepend`, `onReplaceChildren`) within the `bProgram`. These handlers receive HTML strings to update the element's light DOM content.
 * @property {(this: PlaitedElement, args: BProgramArgs) => A & PlaitedElementCallbackHandlers} [bProgram] - The behavioral program function. It receives `BProgramArgs` (containing `$`, `trigger`, `host`, etc.) and should return an object containing event handlers and lifecycle callbacks defined by type `A`. The `this` context inside `bProgram` refers to the custom element instance.
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

/** @internal Interface extending GetElementArgs for internal use, making optional properties explicit. */
interface DefineElementArgs<A extends PlaitedHandlers>
  extends Omit<GetElementArgs<A>, 'delegatesFocus' | 'mode' | 'slotAssignment'> {
  delegatesFocus?: boolean
  mode?: 'open' | 'closed'
  slotAssignment?: 'named' | 'manual'
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
 * @description Defines a Plaited custom element and returns a template function for its usage.
 * This is the primary function for creating reusable Plaited components. It handles custom element registration,
 * shadow DOM setup, event delegation, attribute observation, lifecycle management, and behavioral programming integration.
 *
 * @template A - A type extending `PlaitedHandlers` defining the component's specific event handlers and lifecycle callbacks.
 * @param {DefineElementArgs<A>} config - The configuration object defining the element's properties and behavior. See `GetElementArgs` for details (note: `DefineElementArgs` makes some properties optional).
 * @returns {PlaitedTemplate} A Plaited template function (`(attrs: Attrs) => TemplateObject`).
 *   - When called (e.g., via JSX), it generates a `TemplateObject` representing the custom element instance, including its declarative shadow DOM structure.
 *   - This returned function also carries metadata:
 *     - `tag`: The custom element tag name.
 *     - `registry`: A Set of all Plaited component tags used within this component's template (including itself).
 *     - `$`: The Plaited template identifier symbol.
 *     - `publicEvents`: The array of declared public event types.
 *     - `observedAttributes`: The array of observed attribute names.
 *
 * @example
 * ```typescript
 * import { defineElement, h, PlaitedElement, BProgramArgs, PlaitedHandlers } from 'plaited';
 *
 * interface CounterHandlers extends PlaitedHandlers {
 *   increment: () => void;
 *   decrement: () => void;
 * }
 *
 * const Counter = defineElement<CounterHandlers>({
 *   tag: 'simple-counter',
 *   observedAttributes: ['initial-value'],
 *   shadowDom: (
 *     <>
 *       <button p-trigger={{ click: 'decrement' }}>-</button>
 *       <span p-target="count">0</span>
 *       <button p-trigger={{ click: 'increment' }}>+</button>
 *     </>
 *   ),
 *   bProgram({ $, host }) {
 *     let count = 0;
 *     const [countSpan] = $<HTMLSpanElement>('count');
 *
 *     return {
 *       onConnected() {
 *         count = parseInt(host['initial-value'] ?? '0', 10); // Access observed attribute as property
 *         countSpan.render(`${count}`);
 *       },
 *       increment() {
 *         count++;
 *         countSpan.render(`${count}`);
 *       },
 *       decrement() {
 *         count--;
 *         countSpan.render(`${count}`);
 *       },
 *     };
 *   },
 * });
 *
 * // Usage in another component or template:
 * const App = () => (
 *   <div>
 *     <Counter initial-value="10" />
 *   </div>
 * );
 * ```
 *
 * @remarks
 * - Automatically registers the custom element using `customElements.define` if it's not already defined and `canUseDOM()` is true.
 * - Sets up the shadow DOM based on the `shadowDom` template, `mode`, `delegatesFocus`, and `slotAssignment` options.
 * - Initializes the behavioral program (`bProgram`) and connects its handlers.
 * - Manages event delegation for elements with the `p-trigger` attribute within the shadow DOM.
 * - Binds helper methods (`render`, `insert`, `attr`, etc.) to elements selected via `$` or elements with `p-target` added later.
 * - Sets up a `MutationObserver` to handle dynamically added/modified elements with `p-trigger` or `p-target`.
 * - Handles automatic cleanup of listeners and observers during `disconnectedCallback`.
 * - Provides SSR-compatible template generation by returning a `PlaitedTemplate` function.
 */
export const defineElement = <A extends PlaitedHandlers>({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  slotAssignment = 'named',
  publicEvents,
  observedAttributes = [],
  streamAssociated,
  formAssociated,
  bProgram: callback,
}: DefineElementArgs<A>): PlaitedTemplate => {
  const events: string[] = [
    ...(publicEvents ?? []),
    ...(streamAssociated ?
      [ELEMENT_CALLBACKS.onAppend, ELEMENT_CALLBACKS.onPrepend, ELEMENT_CALLBACKS.onReplaceChildren]
    : []),
  ]
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
          const frag = getDocumentFragment(this.#root, shadowDom)
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
  const ft = ({ children = [], ...attrs }: Attrs) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: shadowDom,
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.registry = registry
  ft.tag = tag
  ft.$ = PLAITED_TEMPLATE_IDENTIFIER
  ft.publicEvents = events
  ft.observedAttributes = observedAttributes
  return ft
}
