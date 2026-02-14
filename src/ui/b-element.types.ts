import type {
  BSync,
  BThread,
  BThreads,
  EventDetails,
  Handlers,
  PlaitedTrigger,
  SnapshotMessage,
  Trigger,
} from '../main/behavioral.types.ts'
import { type BEHAVIORAL_TEMPLATE_IDENTIFIER, ELEMENT_CALLBACKS } from './b-element.constants.ts'
import type { CustomElementTag, FunctionTemplate, TemplateObject } from './create-template.types.ts'
import type { DesignTokenReference, HostStylesObject } from './css.types.ts'
import type { INSPECTOR_MESSAGE } from './inspector.ts'
import type { Emit } from './use-emit.ts'
/**
 * Valid insertion positions for DOM elements relative to a reference element.
 * Follows the insertAdjacentElement/HTML specification.
 *
 * Values:
 * - 'beforebegin': Before the reference element itself.
 * - 'afterbegin':  Inside the reference element, before its first child.
 * - 'beforeend':   Inside the reference element, after its last child.
 * - 'afterend':    After the reference element itself.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentElement
 */
export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'

/**
 * Core helper methods bound to elements within BehavioralElements.
 * Provides a safe and efficient way to manipulate DOM elements while maintaining
 * style encapsulation and proper event handling.
 */
export type Bindings = {
  /**
   * Replaces all children of the element with the provided content.
   * Handles style adoption and template processing automatically.
   *
   * @param template Content to render (JSX elements, strings, numbers, or fragments)
   */
  render(this: Element, ...template: (TemplateObject | string | number | DocumentFragment)[]): void

  /**
   * Inserts content at a specified position relative to the element.
   *
   * @param position Where to insert the content:
   *   - 'beforebegin': Before the element
   *   - 'afterbegin': Inside the element, before its first child
   *   - 'beforeend': Inside the element, after its last child
   *   - 'afterend': After the element
   * @param template Content to insert
   */
  insert(this: Element, position: Position, ...template: (TemplateObject | string | number | DocumentFragment)[]): void

  /**
   * Replaces the element itself with new content.
   *
   * @param template Content to replace the element with
   */
  replace(this: Element, ...template: (TemplateObject | string | number | DocumentFragment)[]): void

  /**
   * Gets or sets element attributes with type safety.
   *
   * @param attr Attribute name or object containing multiple attributes
   * @param val Value to set (when using string attr name)
   * @returns Current attribute value when getting a single attribute, undefined when setting
   */
  attr(
    this: Element,
    attr: string | Record<string, string | null | number | boolean>,
    val?: string | null | number | boolean,
  ): string | null | undefined
}

/**
 * Represents an HTML Element that has been augmented with Plaited's core helper methods (`Bindings`).
 * This allows for convenient and type-safe DOM manipulation within BehavioralElements.
 *
 * @template T - The specific type of the HTML Element being bound (e.g., `HTMLDivElement`, `HTMLButtonElement`). Defaults to `Element`.
 * @see Bindings
 */
export type BoundElement<T extends Element = Element> = T & Bindings
/**
 * Type for element matching strategies in attribute selectors.
 * Supports all CSS attribute selector operators.
 *
 * Values:
 * - '=':  Exact match
 * - '~=': Space-separated list contains
 * - '|=': Exact match or prefix followed by hyphen
 * - '^=': Starts with
 * - '$=': Ends with
 * - '*=': Contains
 */
export type SelectorMatch = '=' | '~=' | '|=' | '^=' | '$=' | '*='

/**
 * Extended HTMLElement interface for Plaited custom elements.
 * Defines the contract for custom elements created with `bElement`, including standard lifecycle callbacks
 * and Plaited-specific properties like `trigger` and `publicEvents`.
 *
 * @property trigger - A public method to dispatch events into the element's behavioral program.
 * @property publicEvents - An optional array of event type strings that this element allows to be triggered externally via its `trigger` method.
 * @property adoptedCallback - Called when the element is adopted into a new document.
 * @property attributeChangedCallback - Called when one of the element's `observedAttributes` changes.
 * @property connectedCallback - Called each time the element is added to the document's DOM.
 * @property disconnectedCallback - Called each time the element is removed from the document's DOM.
 * @property formAssociatedCallback - If `formAssociated` is true, called when the element becomes associated with a form.
 * @property formDisabledCallback - If `formAssociated` is true, called when the element's disabled state changes due to a parent `<fieldset>`.
 * @property formResetCallback - If `formAssociated` is true, called when the form is reset.
 * @property formStateRestoreCallback - If `formAssociated` is true, called when the browser attempts to restore the element's state.
 */
export interface BehavioralElement extends HTMLElement {
  // Custom Methods and properties
  trigger: Trigger
  readonly publicEvents?: string[]
  adoptedCallback?: (this: BehavioralElement) => void
  attributeChangedCallback?: (
    this: BehavioralElement,
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ) => void
  connectedCallback(this: BehavioralElement): void
  disconnectedCallback(this: BehavioralElement): void
  formAssociatedCallback(this: BehavioralElement, form: HTMLFormElement): void
  formDisabledCallback(this: BehavioralElement, disabled: boolean): void
  formResetCallback(this: BehavioralElement): void
  formStateRestoreCallback(this: BehavioralElement, state: unknown, reason: 'autocomplete' | 'restore'): void
}
/**
/**
 * Represents a BehavioralElement template function, extending the base `FunctionTemplate`.
 * This type includes metadata essential for Plaited's custom element registration and rendering system.
 * It is typically the return type of `bElement`.
 *
 * @property registry - A set of custom element tag names that are defined by this template or its dependencies,
 *                      used by Plaited to ensure custom elements are defined before use.
 * @property tag - The custom element tag name (e.g., 'my-element') associated with this BehavioralElement.
 * @property observedAttributes - An array of attribute names that instances of this custom element will observe for changes,
 *                                triggering `attributeChangedCallback`.
 * @property publicEvents - An array of event type strings that can be externally dispatched on the element instance
 *                          using its `trigger` method.
 * @property $ - A unique symbol (`BEHAVIORAL_TEMPLATE_IDENTIFIER`) acting as a type guard to identify
 *               this object as a Plaited-specific template function.
 */
export type BehavioralTemplate = FunctionTemplate & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  hostStyles: HostStylesObject | DesignTokenReference
  $: typeof BEHAVIORAL_TEMPLATE_IDENTIFIER
}

export type InspectorMessageDetail = {
  element: CustomElementTag
  message: SnapshotMessage
}

export type InspectorMessage = {
  type: typeof INSPECTOR_MESSAGE
  detail: InspectorMessageDetail
}

/**
 * @internal
 * Callback function for receiving behavioral program state snapshots.
 * Invoked on each state update when inspector is active.
 *
 * @param arg - Snapshot message containing current program state
 *
 * @see {@link Inspector} for inspector lifecycle
 * @see {@link SnapshotMessage} for snapshot structure
 */
export type InspectorCallback = (args: InspectorMessage) => void | Promise<void>

/**
 * @internal
 * Debugging inspector for observing behavioral program state.
 * Provides callbacks to monitor state snapshots during program execution.
 *
 * @property assign - Register a callback to receive state snapshots
 * @property reset - Reset callback back to the default console.table logger
 * @property on - Start sending snapshots to the assigned callback
 * @property off - Stop sending snapshots to the assigned callback
 *
 * @remarks
 * - Used for debugging and development tools
 * - Callbacks receive full program state on each update
 * - Must call `off()` to prevent unnecessary snapshot generation
 * - Use `reset()` to restore default console.table logging behavior
 *
 * @see {@link BProgramArgs} for usage in bProgram
 * @see {@link InspectorCallback} for callback signature
 */
export type Inspector = {
  on: () => void
  off: () => void
}

/**
 * Context and utilities provided to the behavioral program of a BehavioralElement.
 * Contains DOM access, lifecycle hooks, and behavioral programming primitives.
 *
 * @remarks
 * **Progressive Enhancement Levels:**
 * - **Level 2** (Server-first): Use `$`, `trigger`, `attr()` on bound elements
 * - **Level 2.5** (Client reactions): Add `$`, `trigger`, `attr()` for toggles
 * - **Level 3** (Complex choreography): Use `bThreads`, `bThread`, `bSync`, `internals`
 *
 * **Core API** (recommended):
 * - `$` — Query selector scoped to shadow root using p-target attributes
 * - `trigger` — Event dispatcher with automatic cleanup
 * - `internals` — ElementInternals API for form association and states
 * - `bThreads` — Behavioral thread management
 * - `bThread` — Thread creation utility
 * - `bSync` — Synchronization point utility
 * - `inspector` — Debugging inspector for observing program state
 *
 * **Escape hatch** (for advanced use cases):
 * - `root` — Direct shadowRoot reference
 * - `host` — Custom element instance
 * - `emit` — Custom event dispatcher for cross-island communication
 *
 * @see {@link bElement} for BehavioralElement creation
 * @see {@link BoundElement} for element helper methods (render, insert, replace, attr)
 * @see {@link useEmit} for emit function details
 * @see {@link Inspector} for inspector usage
 */
export type BProgramArgs = {
  /** Query selector scoped to shadow root using p-target attributes */
  $: <E extends Element = Element>(
    target: string,
    /**
     * This option enables querySelectorAll and modifies the attribute selector for p-target
     * @default {all: false, mod: "="}
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}
     */
    match?: SelectorMatch,
  ) => NodeListOf<BoundElement<E>>
  /**
   * Direct reference to the BehavioralElement's shadowRoot.
   * Prefer using `$()` for scoped queries instead of accessing root directly.
   * @see {@link $} for the recommended query API
   */
  root: ShadowRoot
  /**
   * Direct reference to the custom element instance.
   * Prefer using `trigger` and `emit` for communication instead of accessing host directly.
   */
  host: BehavioralElement
  /** ElementInternals API for form association, accessibility states, and custom states */
  internals: ElementInternals
  /** Event dispatcher with automatic cleanup for injecting events into the behavioral program */
  trigger: PlaitedTrigger
  /** Behavioral thread management for adding and checking thread status */
  bThreads: BThreads
  /** Debugging inspector for observing behavioral program state snapshots */
  inspector: Inspector
  /**
   * Custom event dispatcher for outbound BehavioralElement communication.
   * Used in Pattern B (child → parent) to dispatch events that cross shadow DOM boundaries.
   *
   * @see {@link useEmit} for emit function details
   */
  emit: Emit
  /** Thread creation utility for composing synchronization steps */
  bThread: BThread
  /** Synchronization point utility for declaring behavioral intentions */
  bSync: BSync
}

/**
 * Lifecycle callbacks for BehavioralElements.
 * Maps standard Custom Element and Form-Associated callbacks to handlers.
 *
 * @property onAdopted - Called when element is moved to a new document
 * @property onAttributeChanged - Called when an observed attribute changes (receives name, oldValue, newValue)
 * @property onConnected - Called when element is added to DOM - ideal for setup
 * @property onDisconnected - Called when element is removed from DOM - ideal for cleanup
 * @property onFormAssociated - Called when associated with a form (requires formAssociated: true)
 * @property onFormDisabled - Called when disabled state changes via fieldset (requires formAssociated: true)
 * @property onFormReset - Called when associated form is reset (requires formAssociated: true)
 * @property onFormStateRestore - Called when browser restores element state (requires formAssociated: true)
 */
/**
 * Configuration object for creating a BehavioralElement with `bElement()`.
 * Defines the custom element tag, Shadow DOM template, behavioral program, and options.
 *
 * @template A Event details type map for element-specific events, enabling type-safe handlers
 *
 * @property tag - Custom element tag name (must contain a hyphen, e.g., 'my-element')
 * @property shadowDom - Template object defining the Shadow DOM content, created via JSX
 * @property mode - Shadow DOM mode ('open' or 'closed'). Defaults to 'open'
 * @property delegatesFocus - Whether focus is delegated to shadow content. Defaults to true
 * @property slotAssignment - Slot assignment mode ('named' or 'manual'). Defaults to 'named'
 * @property observedAttributes - Attribute names to observe for changes via attributeChangedCallback
 * @property publicEvents - Event types that can be triggered externally via the element's trigger method
 * @property hostStyles - Styles applied to the host element itself
 * @property formAssociated - Set to true to make the element form-associated (enables ElementInternals form APIs)
 * @property bProgram - Behavioral program function that defines the element's interactive logic
 *
 * @see {@link bElement} for creating BehavioralElements
 * @see {@link BProgramArgs} for behavioral program arguments
 * @see src/ui/tests/hydration.stories.tsx for declarative shadow DOM usage
 * @see src/ui/tests/form-associated.stories.tsx for form association patterns
 */
export type BElementConfig<A extends EventDetails> = {
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
}

/**
 * @internal
 * Type mapping for behavioral element lifecycle callbacks.
 */
type BehavioralElementCallbackHandlers = {
  [K in keyof BehavioralElementCallbackDetails]?: Callback<BehavioralElementCallbackDetails[K]>
}

/**
 * @internal
 * Type for lifecycle callback functions with optional detail payload.
 */
type Callback<T> = T extends void ? () => void | Promise<void> : (detail: T) => void | Promise<void>

export type BehavioralElementCallbackDetails = {
  [ELEMENT_CALLBACKS.onAdopted]: undefined
  [ELEMENT_CALLBACKS.onAttributeChanged]: {
    name: string
    oldValue: string | null
    newValue: string | null
  }
  [ELEMENT_CALLBACKS.onConnected]: undefined
  [ELEMENT_CALLBACKS.onDisconnected]: undefined
  [ELEMENT_CALLBACKS.onFormAssociated]: HTMLFormElement
  [ELEMENT_CALLBACKS.onFormDisabled]: boolean
  [ELEMENT_CALLBACKS.onFormReset]: undefined
  [ELEMENT_CALLBACKS.onFormStateRestore]: {
    state: unknown
    reason: 'autocomplete' | 'restore'
  }
}
