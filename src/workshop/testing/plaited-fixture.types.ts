import type { Attrs, FunctionTemplate } from '../../jsx/jsx.types.js'
import type { StylesObject } from '../../main/css.types.js'
import type { Wait } from '../../utils/wait.js'
import type { Assert } from './use-assert.js'
import type { FindByAttribute } from './use-find-by-attribute.js'
import type { FindByText } from './use-find-by-text.js'
import type { FireEvent } from './use-fire-event.js'
import type { Match } from './match.js'
import type { Throws } from './throws.js'
import { FIXTURE_EVENTS, SCALE } from './plaited-fixture.constants.js'

export type A11yConfig = {
  exclude?: string | string[]
  disableRules?: string | string[]
}

/**
 * @internal Configuration parameters for a specific story test.
 * These options control the testing environment and behavior for a single story.
 *
 * @property {Record<string, string> | false} [a11y] - Accessibility testing configuration. If set to an object, enables Axe-core checks with the specified rules. If `false`, disables a11y checks for this story.
 * @property {string} [description] - A description of the story's usage or the scenario it tests. Often displayed in test reports.
 * @property {(env: NodeJS.ProcessEnv) => Headers} [headers] - A factory function to create custom HTTP headers for server-side rendering or fetching within the test environment.
 * @property {Scale} [scale] - The Agentic Card Scale to use when rendering and testing this story. See `Scale` type.
 * @property {StylesObject} [styles] - Additional CSS styles to apply specifically to the context of this story test. Useful for overriding global styles or adding test-specific visual aids.
 * @property {number} [timeout=5000] - The maximum time (in milliseconds) allowed for the story's `play` function to complete. Defaults to `DEFAULT_PLAY_TIMEOUT` (5000ms).
 */
export type Params = {
  a11y?: false | A11yConfig
  scale?: keyof typeof SCALE
  styles?: StylesObject
  timeout?: number // Defaults to 5_000 ms
  headers?: (env: NodeJS.ProcessEnv) => Headers | Promise<Headers>
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

/**
 * Represents the data structure sent from the test fixture to the runner
 * when a test fails due to an failed assertion, missing parameters, or unknown error in the client
 *
 * @property {object} event - Test Failure Event.
 * @property {typeof MISSING_ASSERTION_PARAMETER | typeof FAILED_ASSERTION |  typeof UNKNOWN_ERROR} event.type - The type of failure event.
 * @property {object} event.detail - Contextual information about the failed test.
 * @property {string} event.detail.name - Unknown error name if present.
 * @property {string} event.detail.message - Error message indicating missing parameters.
 * @property {string} event.detail.url - The URL of the test page when the error occurred.
 * @property {string} event.detail.trace - A string representing the stack trace of the error.
 */
export type TestFailureEvent = {
  type:
    | typeof FIXTURE_EVENTS.FAILED_ASSERTION
    | typeof FIXTURE_EVENTS.MISSING_ASSERTION_PARAMETER
    | typeof FIXTURE_EVENTS.UNKNOWN_ERROR
  detail: {
    name: string
    message: string
    url: string
    trace: string
  }
}

export type SnapshotDetail = {
  route: string
  entry: string
  exportName: string
  story: SnapshotStoryObj
}
