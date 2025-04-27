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
 * Creates a template function for defining Plaited components with built-in SSR support.
 * Combines custom element definition with template generation for server and client rendering.
 *
 * @template A Type extending PlaitedHandlers for component behavior
 * @param config Component configuration with template and behavior
 * @returns Template function with metadata for component registration
 *
 * Features:
 * - Server-side rendering support
 * - Custom element registration
 * - Shadow DOM template generation
 * - Event delegation setup
 * - Attribute observation
 * - Stream mutation support
 *
 * @example
 import type { type FT, defineElement, useSignal } from 'plaited'

 const store = useSignal<number>(0)

 const Publisher = defineElement({
   tag: 'publisher-component',
   shadowDom: (
     <button
       p-trigger={{ click: 'increment' }}
       p-target='button'
     >
       increment
     </button>
   ),
   publicEvents: ['add'],
   bProgram({ bThreads, bThread, bSync }) {
     bThreads.set({
       onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
     })
     return {
       increment() {
         store.set(store.get() + 1)
       },
     }
   },
 })

 const Subscriber = defineElement({
   tag: 'subscriber-component',
   shadowDom: <h1 p-target='count'>{store.get()}</h1>,
   publicEvents: ['update'],
   bProgram({ $, trigger }) {
     store.listen('update', trigger)
     return {
       update(value: number) {
         const [count] = $('count')
         count.render(`${value}`)
       },
     }
   },
 })

 export const Fixture: FT = () => (
   <>
     <Publisher />
     <Subscriber />
   </>
 )

 *
 * @remarks
 * - Generates both client and server templates
 * - Handles declarative shadow DOM
 * - Manages component registration
 * - Provides SSR-compatible output
 * - Maintains type safety
 * - Handles hydration automatically
 *
 * Return Value Properties:
 * - registry: Set of registered child plaited elements tags
 * - tag: Component's custom element tag
 * - $: Template identifier
 * - publicEvents: Available event types
 * - observedAttributes: Observed attribute names
 *
 * Default Configuration:
 * - mode: 'open'
 * - delegatesFocus: true
 * - slotAssignment: 'named'
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
