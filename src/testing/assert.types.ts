import type { Attrs, FunctionTemplate } from '../jsx/jsx.types.js'
import type { StylesObject } from '../styling/css.types.js'
import type { wait } from '../utils/wait.js'
import type { assert } from './assert.js'
import type { findByAttribute } from './find-by-attribute.js'
import type { findByText } from './find-by-text.js'
import type { fireEvent } from './fire-event.js'
import type { match } from './match.js'
import type { throws } from './throws.js'
import type { TEST_EXCEPTION, UNKNOWN_ERROR, TEST_PASSED } from './assert.constants.js'

/**
 * Defines Modnet module scale of visual implementation.
 * - `1` to `8`
 * - `'rel'`: Indicates a relative scale.
 */
export type Scale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'rel'
/**
 * Configuration parameters for a specific story test.
 * These options control the testing environment and behavior for a single story.
 *
 * @property {Record<string, string> | false} [a11y] - Accessibility testing configuration. If set to an object, enables Axe-core checks with the specified rules. If `false`, disables a11y checks for this story.
 * @property {string} [description] - A description of the story's purpose or the scenario it tests. Often displayed in test reports.
 * @property {(env: NodeJS.ProcessEnv) => Headers} [headers] - A factory function to create custom HTTP headers for server-side rendering or fetching within the test environment.
 * @property {Scale} [scale] - The viewport size scale to use when rendering and testing this story. See `Scale` type.
 * @property {StylesObject} [styles] - Additional CSS styles to apply specifically to the context of this story test. Useful for overriding global styles or adding test-specific visual aids.
 * @property {number} [timeout=5000] - The maximum time (in milliseconds) allowed for the story's `play` function to complete. Defaults to `DEFAULT_PLAY_TIMEOUT` (5000ms).
 */
export type Params = {
  a11y?: Record<string, string> | false
  headers?: (env: NodeJS.ProcessEnv) => Headers
  scale?: Scale
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
 * Defines the signature for a story's `play` function, which encapsulates test interactions
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
 *   const button = await findByText('Submit');
 *   assert(button instanceof HTMLButtonElement, 'Button should be found');
 *   await fireEvent.click(button);
 *   assert(hostElement.textContent.includes('Clicked'));
 * };
 * ```
 */
export type Play = (args: {
  assert: typeof assert
  findByAttribute: typeof findByAttribute
  findByText: typeof findByText
  fireEvent: typeof fireEvent
  hostElement: Element
  match: typeof match
  throws: typeof throws
  wait: typeof wait
}) => Promise<void>

/**
 * Represents a story object definition where the `play` function is mandatory.
 * Use this type when defining stories that include interaction tests or assertions.
 *
 * @template T - The type of attributes/props expected by the story's template. Defaults to `Attrs`.
 * @property {T} [args] - Optional props/attributes passed to the story's template function.
 * @property {string} description - A mandatory description of the story's purpose or test scenario.
 * @property {Params} [parameters] - Optional parameters to configure the test environment for this story (e.g., viewport scale, timeout).
 * @property {Play} play - The required asynchronous function containing test interactions and assertions using the provided testing utilities.
 * @property {FunctionTemplate<T>} [template] - An optional Plaited template function used to render the component for this story. If omitted, a default template might be used based on convention.
 */
export type PlayStoryObj<T extends Attrs = Attrs> = {
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
 * @property {string} description - A mandatory description of the story's purpose.
 * @property {Params} [parameters] - Optional parameters to configure the test environment for this story.
 * @property {Play} [play] - An optional asynchronous function for test interactions and assertions.
 * @property {FunctionTemplate<T>} [template] - An optional Plaited template function used to render the component for this story.
 */
export type TemplateStoryObj<T extends Attrs = Attrs> = {
  args?: Attrs
  description: string
  parameters?: Params
  play?: Play
  template?: FunctionTemplate<T>
}

/**
 * Represents a single story definition within a `.stories.ts` or `.stories.tsx` file.
 * It configures how a component is rendered and tested. Can be either a `PlayStoryObj`
 * (requiring a `play` function) or a `TemplateStoryObj` (where `play` is optional).
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
 *   parameters: { scale: 1 } // Specify viewport scale
 * };
 * ```
 */
export type StoryObj<T extends Attrs = Attrs> = PlayStoryObj<T> | TemplateStoryObj<T>
/**
 * Represents the resolved test parameters used internally during test execution,
 * after merging story-specific parameters with defaults.
 * @internal
 */
export type TestParams = {
  a11y?: false | Record<string, string>
  description?: string
  scale?: Scale
  timeout: number
}
/**
 * Represents the data structure sent from the test fixture to the runner
 * when a test fails due to an assertion, timeout, missing parameters, or an unknown error.
 *
 * @property {string} address - The identifier of the test runner (e.g., `PLAITED_RUNNER`).
 * @property {typeof TEST_EXCEPTION | typeof UNKNOWN_ERROR} type - The type of failure event.
 * @property {object} detail - Contextual information about the failed test.
 * @property {string} detail.route - The unique route identifier of the story.
 * @property {string} detail.file - The source file path of the story.
 * @property {string} detail.story - The exported name of the story object.
 * @property {string} detail.url - The URL of the test page when the error occurred.
 * @property {string} detail.type - A string code representing the specific error type (e.g., `ASSERTION_ERROR`, `TIMEOUT_ERROR`).
 */
export type FailedTestEvent = {
  address: string
  type: typeof TEST_EXCEPTION | typeof UNKNOWN_ERROR
  detail: {
    route: string
    file: string
    story: string
    url: string
    type: string
  }
}
/**
 * Represents the data structure sent from the test fixture to the runner
 * when a test completes successfully (either its `play` function finished without error
 * or it had no `play` function).
 *
 * @property {string} address - The identifier of the test runner (e.g., `PLAITED_RUNNER`).
 * @property {typeof TEST_PASSED} type - Indicates a successful test completion.
 * @property {object} detail - Contextual information about the passed test.
 * @property {string} detail.route - The unique route identifier of the story that passed.
 */
export type PassedTestEvent = {
  address: string
  type: typeof TEST_PASSED
  detail: {
    route: string
  }
}
