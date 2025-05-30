import type { Trigger } from '../behavioral/b-program.js'
import type { CustomElementTag, FunctionTemplate, TemplateObject } from '../jsx/jsx.types.js'
import { type PLAITED_TEMPLATE_IDENTIFIER } from './plaited.constants.js'
/**
 * Valid insertion positions for DOM elements relative to a reference element.
 * Follows the insertAdjacentElement/HTML specification.
 *
 * @type {string}
 * Values:
 * - 'beforebegin': Before the reference element itself
 * - 'afterbegin':  Inside the reference element, before its first child
 * - 'beforeend':   Inside the reference element, after its last child
 * - 'afterend':    After the reference element itself
 *
 * @example
 * // Visual representation:
 * // <!-- beforebegin -->
 * // <div>           // reference element
 * //   <!-- afterbegin -->
 * //   content
 * //   <!-- beforeend -->
 * // </div>
 * // <!-- afterend -->
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentElement
 */
export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'

/**
 * Core helper methods bound to elements within Plaited components.
 * Provides a safe and efficient way to manipulate DOM elements while maintaining
 * style encapsulation and proper event handling.
 *
 * @interface Bindings
 * @example
 * Using bindings in a component:
 * ```tsx
 * bProgram: ({ $ }) => {
 *   const [content] = $('content');
 *
 *   return {
 *     UPDATE_CONTENT: ({ text }) => {
 *       content.render(<p>{text}</p>);
 *     },
 *     INSERT_HEADER: ({ title }) => {
 *       content.insert('beforebegin', <h1>{title}</h1>);
 *     }
 *   };
 * }
 * ```
 */
export type Bindings = {
  /**
   * Replaces all children of the element with the provided content.
   * Handles style adoption and template processing automatically.
   *
   * @param template Content to render (JSX elements, strings, numbers, or fragments)
   * @example
   * ```tsx
   * const [container] = $('main');
   *
   * // Replace with JSX content
   * container.render(
   *   <div class="content">
   *     <h1>New Content</h1>
   *     <p>Some text</p>
   *   </div>
   * );
   *
   * // Replace with text
   * container.render('Simple text');
   * ```
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
   * @example
   * ```tsx
   * const [list] = $('todo-list');
   *
   * // Add new item at the end
   * list.insert('beforeend',
   *   <li class="todo-item">New task</li>
   * );
   *
   * // Add header before the list
   * list.insert('beforebegin',
   *   <h2>Todo Items:</h2>
   * );
   * ```
   */
  insert(this: Element, position: Position, ...template: (TemplateObject | string | number | DocumentFragment)[]): void

  /**
   * Replaces the element itself with new content.
   *
   * @param template Content to replace the element with
   * @example
   * ```tsx
   * const [oldMessage] = $('message');
   *
   * // Replace with new element
   * oldMessage.replace(
   *   <div class="new-message">
   *     <strong>Updated!</strong>
   *     <p>New content here</p>
   *   </div>
   * );
   * ```
   */
  replace(this: Element, ...template: (TemplateObject | string | number | DocumentFragment)[]): void

  /**
   * Gets or sets element attributes with type safety.
   *
   * @param attr Attribute name or object containing multiple attributes
   * @param val Value to set (when using string attr name)
   * @returns Current attribute value when getting a single attribute
   * @example
   * ```tsx
   * const [button] = $('submit-btn');
   *
   * // Set multiple attributes
   * button.attr({
   *   'aria-label': 'Submit form',
   *   'data-state': 'ready',
   *   disabled: false
   * });
   *
   * // Get single attribute
   * const state = button.attr('data-state');
   *
   * // Set single attribute
   * button.attr('aria-expanded', 'true');
   *
   * // Remove single attribute
   * button.attr('disabled', 'null);
   * ```
   */
  attr(this: Element, attr: Record<string, string | null | number | boolean>, val?: never): void
  attr(this: Element, attr: string, val?: string | null | number | boolean): string | null | void
}

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
 * Includes lifecycle callbacks and custom functionality.
 *
 * @interface
 * @extends HTMLElement
 * @property trigger public Event triggering function
 * @property publicEvents List of exposed Event types
 * @property adoptedCallback Called when element is moved to new document
 * @property attributeChangedCallback Called on attribute changes
 * @property connectedCallback Called when element is added to DOM
 * @property disconnectedCallback Called when element is removed from DOM
 * @property formAssociatedCallback Called when element is associated with a form
 * @property formDisabledCallback Called when associated form is disabled
 * @property formResetCallback Called when associated form is reset
 * @property formStateRestoreCallback Called when form state is restored
 */
export interface PlaitedElement extends HTMLElement {
  // Custom Methods and properties
  trigger: Trigger
  readonly publicEvents?: string[]
  adoptedCallback?: { (this: PlaitedElement): void }
  attributeChangedCallback?: {
    (this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void
  }
  connectedCallback(this: PlaitedElement): void
  disconnectedCallback(this: PlaitedElement): void
  formAssociatedCallback(this: PlaitedElement, form: HTMLFormElement): void
  formDisabledCallback(this: PlaitedElement, disabled: boolean): void
  formResetCallback(this: PlaitedElement): void
  formStateRestoreCallback(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void
}
/**
 * Extended FunctionTemplate type for Plaited component templates.
 * Includes component metadata and identification.
 *
 * @extends FunctionTemplate
 * @property registry Set of registered  web component identifiers
 * @property tag Custom element tag name
 * @property observedAttributes List of attributes to watch
 * @property publicEvents List of exposed public event types
 * @property $ Template identifier
 */
export type PlaitedTemplate = FunctionTemplate & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
}
/**
 * Type for JSON-serializable message details.
 * Supports nested objects and arrays of primitive values.
 */
export type JSONDetail = string | number | boolean | null | JsonObject | JsonArray
/**
 * Helper type for JSON objects with string keys and JSONDetail values.
 * @internal
 */
type JsonObject = {
  [key: string]: JSONDetail
}
/**
 * Helper type for arrays of JSONDetail values.
 * @internal
 */
type JsonArray = Array<JSONDetail>
/**
 * Structure for messages in the Plaited system.
 * Includes routing and payload information.
 *
 * @template D Type of detail data, must be JSON-serializable
 * @property address Routing information for the message
 * @property type Message type identifier
 * @property detail Optional payload data
 *
 * @example
 * const message: PlaitedMessage = {
 *   address: 'component-id',
 *   type: 'UPDATE',
 *   detail: { value: 42 }
 * };
 */
export type PlaitedMessage<D extends JSONDetail = JSONDetail> = {
  address: string
  type: string
  detail?: D
}
