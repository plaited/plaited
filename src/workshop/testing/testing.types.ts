import type { BrowserContext } from 'playwright'
import type axe from 'axe-core'
import type { StoryParams } from '../workshop.types.js'
import type { Wait } from '../../utils/wait.js'
import type { PlaitedFixtureSnapshotMessage } from './testing.schema.js'

export type LogMessageDetail = {
  colorScheme: ColorScheme
  context: BrowserContext
  snapshot: PlaitedFixtureSnapshotMessage
} & StoryParams

type InstrumentedDetails<T> = T

export type WaitDetails = InstrumentedDetails<Parameters<Wait>>

/**
 * Parameters for the assertion function
 * @template T - The type of values being compared
 */
type AssertParams<T> = {
  given: string
  should: string
  actual: T
  expected: T
}

/**
 * Type definition for assertion function that provides structured comparison with detailed error reporting.
 * @template T - Type parameter representing the values being compared
 */
export type Assert = <T>(param: AssertParams<T>) => void

export type AssertDetails = InstrumentedDetails<Parameters<Assert>>

type AccessibilityCheckArgs = { exclude?: axe.ContextProp; rules?: axe.RuleObject; config?: Omit<axe.Spec, 'reporter'> }

export type AccessibilityCheck = (args: AccessibilityCheckArgs) => Promise<void>

export type AccessibilityCheckDetails = InstrumentedDetails<Parameters<AccessibilityCheck>>

/**
 * @description Type definition for a function that asynchronously finds an element
 * by a specific attribute name and value, searching through light and shadow DOM.
 *
 * @template T - The expected element type (HTMLElement or SVGElement) to be returned. Defaults to `HTMLElement | SVGElement`.
 * @param {string} attributeName - The name of the attribute to search for.
 * @param {string | RegExp} attributeValue - The exact string value or a regular expression pattern to match against the attribute's value.
 * @param {HTMLElement | SVGElement} [context=document] - An optional element within which to limit the search scope. Defaults to the entire `document`.
 * @returns {Promise<T | undefined>} A promise that resolves to the first element (of type T) with the matching attribute, or `undefined` if no match is found.
 */

export type FindByAttribute = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement,
) => Promise<T | undefined>

export type FindByAttributeDetails = InstrumentedDetails<Parameters<FindByAttribute>>

/**
 * @description Type definition for a function that asynchronously finds an element
 * containing specific text content, searching through light and shadow DOM.
 *
 * @template T - The expected HTMLElement type to be returned. Defaults to `HTMLElement`.
 * @param {string | RegExp} searchText - The exact string or regular expression pattern to match within the text content of elements.
 * @param {HTMLElement} [context=document.body] - An optional element within which to limit the search scope. Defaults to `document.body`.
 * @returns {Promise<T | undefined>} A promise that resolves to the first element (of type T) containing the matching text, or `undefined` if no match is found.
 */
export type FindByText = {
  <T extends HTMLElement = HTMLElement>(searchText: string | RegExp, context?: HTMLElement): Promise<T | undefined>
  name: string
}

export type FindByTextDetail = InstrumentedDetails<Parameters<FindByText>>

/**
 * Configuration options for DOM event dispatch.
 * Used to customize event behavior and include additional data.
 *
 * @typedef {Object} EventArguments
 * @property {boolean} [bubbles] - Whether the event bubbles up through the DOM tree. Defaults to true
 * @property {boolean} [composed] - Whether the event can cross shadow DOM boundaries. Defaults to true
 * @property {boolean} [cancelable] - Whether the event can be canceled. Defaults to true
 * @property {Record<string, unknown>} [detail] - Custom data to be included with the event. When provided, creates a CustomEvent
 *
 * @example
 * ```ts
 * const options: EventArguments = {
 *   bubbles: true,
 *   composed: true,
 *   detail: { value: 'test' }
 * };
 * ```
 */
export type FireEventOptions = {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: Record<string, unknown>
}

/**
 * Type definition for the event dispatching utility function.
 * Provides a type-safe way to dispatch both standard DOM events and custom events.
 *
 * @template T - Element type that will receive the event. Defaults to HTMLElement | SVGElement
 *
 * @param element - Target DOM element that will receive the event
 * @param eventName - The name/type of the event to dispatch (e.g., 'click', 'custom-event')
 * @param options - Optional configuration for the event {@link EventArguments}
 * @returns Promise that resolves after the event has been dispatched
 *
 * @example Dispatching a standard DOM event
 * ```ts
 * // Fire a click event on a button
 * const button = document.querySelector('button');
 * await fireEvent(button, 'click');
 * ```
 *
 * @example Dispatching a custom event with data
 * ```ts
 * // Fire a custom event with detail data
 * const element = document.getElementById('target');
 * await fireEvent(element, 'my-custom-event', {
 *   detail: {
 *     value: 42,
 *     name: 'test'
 *   }
 * });
 * ```
 *
 * @example Working with Shadow DOM
 * ```ts
 * // Fire event that crosses shadow DOM boundaries
 * await fireEvent(shadowRoot.querySelector('.btn'), 'change', {
 *   composed: true,  // Allow event to cross shadow DOM boundary
 *   detail: { updated: true }
 * });
 * ```
 *
 * @remarks
 * This type ensures type safety when:
 * - Working with different element types (HTML/SVG)
 * - Configuring event options
 * - Handling custom event data
 *
 * The implementation uses requestAnimationFrame for proper event timing
 * and returns a Promise for async operation handling.
 */
export type FireEvent = {
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    element: T,
    eventName: string,
    options?: FireEventOptions,
  ): Promise<void>
  name: string
}

export type FireEventDetail = InstrumentedDetails<Parameters<FireEvent>>

export type ColorScheme = 'light' | 'dark'
