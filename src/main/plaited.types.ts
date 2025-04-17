import type { Trigger } from '../behavioral/b-program.js'
import type { CustomElementTag, FunctionTemplate } from '../jsx/jsx.types.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from './plaited.constants.js'

export type { Position, SelectorMatch } from './assign-dom-helpers.js'
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
