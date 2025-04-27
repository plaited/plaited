import type { Trigger } from '../behavioral/b-program.js'
import type { CustomElementTag, FunctionTemplate, TemplateObject } from '../jsx/jsx.types.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from './plaited.constants.js'

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

export type Bindings = {
  render(this: Element, ...template: (TemplateObject | string | number | DocumentFragment)[]): void
  insert(this: Element, position: Position, ...template: (TemplateObject | string | number | DocumentFragment)[]): void
  replace(this: Element, ...template: (TemplateObject | string | number | DocumentFragment)[]): void
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

export type Query = <T extends Element = Element>(
  target: string,
  /** This options enables querySelectorAll and modified the attribute selector for p-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
  match?: SelectorMatch,
) => BoundElement<T>[]

/**
 * Extended HTMLElement interface for Plaited custom elements.
 * Includes lifecycle callbacks and custom functionality.
 *
 * @interface
 * @extends HTMLElement
 * @property trigger Event triggering function
 * @property publicEvents List of exposed event types
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
 * @property registry Set of registered component identifiers
 * @property tag Custom element tag name
 * @property observedAttributes List of attributes to watch
 * @property publicEvents List of exposed event types
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
