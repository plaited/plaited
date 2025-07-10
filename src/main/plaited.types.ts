import type { Trigger } from '../behavioral.js'
import type { CustomElementTag, FunctionTemplate, TemplateObject } from './jsx.types.js'
import { type PLAITED_TEMPLATE_IDENTIFIER } from './plaited.constants.js'
import type { StylesObject } from './css.types.js'
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
   * button.attr('disabled', null);
   * ```
   */
  attr(
    this: Element,
    attr: Record<string, string | null | number | boolean> & { class?: StylesObject | string | null },
    val?: never,
  ): void
  attr(this: Element, attr: string, val?: string | null | number | boolean): string | null | void
  attr(this: Element, attr: 'class', val?: StylesObject | string | null): string | null | void
}

/**
 * Represents an HTML Element that has been augmented with Plaited's core helper methods (`Bindings`).
 * This allows for convenient and type-safe DOM manipulation within Plaited components.
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
/**
 * Represents a Plaited component template function, extending the base `FunctionTemplate`.
 * This type includes metadata essential for Plaited's custom element registration and rendering system.
 * It is typically the return type of `bElement`.
 *
 * @property registry - A set of custom element tag names that are defined by this component or its dependencies,
 *                      used by Plaited to ensure components are defined before use.
 * @property tag - The custom element tag name (e.g., 'my-component') associated with this Plaited component.
 * @property observedAttributes - An array of attribute names that instances of this custom element will observe for changes,
 *                                triggering `attributeChangedCallback`.
 * @property publicEvents - An array of event type strings that can be externally dispatched on the component instance
 *                          using its `trigger` method.
 * @property $ - A unique symbol (`PLAITED_TEMPLATE_IDENTIFIER`) acting as a type guard to identify
 *               this object as a Plaited-specific template function.
 */
export type PlaitedTemplate = FunctionTemplate & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
}
