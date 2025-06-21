import type { BrowserContextOptions } from 'playwright'
import type axe from 'axe-core'
import type { Attrs, FunctionTemplate } from '../../jsx/jsx.types.js'
import type { StylesObject } from '../../main/css.types.js'
import type { Wait } from '../../utils/wait.js'
import type { Match, Throws } from './plaited-fixture.utils.js'
import { FIXTURE_EVENTS } from './plaited-fixture.constants.js'

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

type InstrumentedDetails<T> = T

export type AssertDetails = InstrumentedDetails<Parameters<Assert>>

export type WaitDetails = InstrumentedDetails<Parameters<Wait>>

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

/**
 * @internal Configuration parameters for a specific story test.
 * These options control the testing environment and behavior for a single story.
 *
 * @property {Record<string, string> | false} [a11y] - Accessibility testing configuration. If set to an object, enables Axe-core checks with the specified rules. If `false`, disables a11y checks for this story.
 * @property {string} [description] - A description of the story's usage or the scenario it tests. Often displayed in test reports.
 * @property {(env: NodeJS.ProcessEnv) => Record<string, string |string[]>} [cookies] - A factory function to create custom HTTP cookies for server-side rendering or fetching within the test environment.
 * @property {Scale} [scale] - The Agentic Card Scale to use when rendering and testing this story. See `Scale` type.
 * @property {StylesObject} [styles] - Additional CSS styles to apply specifically to the context of this story test. Useful for overriding global styles or adding test-specific visual aids.
 * @property {number} [timeout=5000] - The maximum time (in milliseconds) allowed for the story's `play` function to complete. Defaults to `DEFAULT_PLAY_TIMEOUT` (5000ms).
 */
export type Params = {
  headers?: (env: NodeJS.ProcessEnv) => Headers | Promise<Headers>
  recordVideo?: BrowserContextOptions['recordVideo']
  styles?: StylesObject
  timeout?: number // Defaults to 5_000 ms
}

/**
 * Utility type to extract the argument/props type from a Plaited FunctionTemplate.
 * @template T - The FunctionTemplate type (e.g., `(props: { title: string }) => Template`).
 * @example type ButtonArgs = Args<typeof ButtonTemplate>; // { title: string }
 */
export type Args<T extends FunctionTemplate> = Parameters<T>[0]

/**
 * @internal Defines the signature for a story's `play` function, which encapsulates test interactions
 * and assertions for a component story. It receives a set of testing utilities as an argument.
 *
 * @param {object} args - An object containing testing utilities.
 * @param {typeof assert} args.assert - Function for making assertions within the test.
 * @param {typeof findByAttribute} args.findByAttribute - Utility to find elements by attribute value within the story's host element.
 * @param {typeof findByText} args.findByText - Utility to find elements by their text content within the story's host element.
 * @param {typeof fireEvent} args.fireEvent - Utilities for dispatching DOM events (e.g., click, input).
 * @param {Element} args.hostElement - The root DOM element where the story component is rendered.
 * @param {typeof match} args.match - Utility for flexible matching of strings or regular expressions.
 * @param {typeof throws} args.throws - Utility for asserting that a function throws an error.
 * @param {typeof wait} args.wait - Utility to pause execution for a specified duration.
 * @returns {Promise<void>} A promise that resolves when the play function completes.
 *
 * @example
 * ```ts
 * const play: Play = async ({ assert, findByText, fireEvent, hostElement }) => {
 let button = await findByAttribute('p-target', 'button')
 const header = await findByAttribute('p-target', 'header')
 assert({
   given: 'render',
   should: 'header should contain string',
   actual: header?.textContent,
   expected: 'Hello',
 })
 button && (await fireEvent(button, 'click'))
 assert({
   given: 'clicking button',
   should: 'append string to header',
   actual: header?.innerHTML,
   expected: 'Hello World!',
 })
 button = await findByAttribute('p-target', 'button')
 assert({
   given: 'clicking button',
   should: 'be disabled',
   actual: (button as HTMLButtonElement)?.disabled,
   expected: true,
 })
 * };
 * ```
 */
export type Play = (args: {
  assert: Assert
  findByAttribute: FindByAttribute
  findByText: FindByText
  fireEvent: FireEvent
  hostElement: Element
  match: Match
  throws: Throws
  wait: Wait
  accessibilityCheck: AccessibilityCheck
}) => Promise<void>

/**
 * Represents a story object definition where the `play` function is mandatory.
 * Use this type when defining stories that include interaction tests or assertions.
 *
 * @template T - The type of attributes/props expected by the story's template. Defaults to `Attrs`.
 * @property {T} [args] - Optional props/attributes passed to the story's template function.
 * @property {string} description - A mandatory description of the story's usage or test scenario.
 * @property {Params} [parameters] - Optional parameters to configure the test environment for this story (e.g., Agentic Card Scale, timeout).
 * @property {Play} play - The required asynchronous function containing test interactions and assertions using the provided testing utilities.
 * @property {FunctionTemplate<T>} [template] - An optional Plaited template function used to render the component for this story. If omitted, a default template might be used based on convention.
 */
export type InteractionStoryObj<T extends Attrs = Attrs> = {
  args?: Attrs
  description: string
  parameters?: Params
  play: Play
  template?: FunctionTemplate<T>
}
/**
 * Represents a story object definition where the `play` function is optional.
 * Use this type for stories primarily focused on visual rendering or when interaction tests are not needed.
 *
 * @template T - The type of attributes/props expected by the story's template. Defaults to `Attrs`.
 * @property {T} [args] - Optional props/attributes passed to the story's template function.
 * @property {string} description - A mandatory description of the story's usage.
 * @property {Params} [parameters] - Optional parameters to configure the test environment for this story.
 * @property {Play} [play] - An optional asynchronous function for test interactions and assertions.
 * @property {FunctionTemplate<T>} [template] - An optional Plaited template function used to render the component for this story.
 */
export type SnapshotStoryObj<T extends Attrs = Attrs> = {
  args?: Attrs
  description: string
  parameters?: Params
  play?: never
  template?: FunctionTemplate<T>
}

/**
 * Represents a single story definition within a `.stories.ts` or `.stories.tsx` file.
 * It configures how a component is rendered and tested. Can be either a `InteractionStoryObj`
 * (requiring a `play` function) or a `SnapshotStoryObj` (where `play` is optional).
 *
 * @template T - The type of attributes/props expected by the story's template. Defaults to `Attrs`.
 *
 * @example With Play Function
 * ```ts
 * export const Interactive: StoryObj<{ label: string }> = {
 *   description: "Tests button click interaction",
 *   args: { label: 'Click Me' },
 *   play: async ({ findByText, fireEvent }) => {
 *     const button = await findByText('Click Me');
 *     await fireEvent.click(button);
 *     // ... assertions
 *   }
 * };
 * ```
 * @example Without Play Function (Visual Test)
 * ```ts
 * export const DefaultView: StoryObj = {
 *   description: "Displays the component in its default state",
 *   args: { initialValue: 'Some text' },
 *   parameters: { scale: 1 } // Specify Agentic Card scale
 * };
 * ```
 */
export type StoryObj<T extends Attrs = Attrs> = InteractionStoryObj<T> | SnapshotStoryObj<T>

export type TestFailureEventDetail = {
  [K in
    | typeof FIXTURE_EVENTS.accessibility_violation
    | typeof FIXTURE_EVENTS.failed_assertion
    | typeof FIXTURE_EVENTS.missing_assertion_parameter
    | typeof FIXTURE_EVENTS.unknown_error]?: unknown
}
