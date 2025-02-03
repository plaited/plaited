import type { Attrs, FunctionTemplate } from '../jsx/jsx.types.js'
import type { StylesObject } from '../style/css.types.js'
import type { wait } from '../utils/wait.js'
import type { assert } from './assert.js'
import type { findByAttribute } from './find-by-attribute.js'
import type { findByText } from './find-by-text.js'
import type { fireEvent } from './fire-event.js'
import type { match } from './match.js'
import type { throws } from './throws.js'
import type { TEST_EXCEPTION, UNKNOWN_ERROR, TEST_PASSED } from './assert.constants.js'

/**
 * Size scale for test viewports.
 * 1-8 represent predefined sizes, 'rel' for relative sizing.
 */
export type Scale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'rel'
/**
 * Test configuration parameters.
 * @property a11y Accessibility testing configuration
 * @property description Test description
 * @property headers Custom headers factory for test environment
 * @property module scale for testing UI
 * @property styles Additional styles for test context
 * @property timeout Test timeout in milliseconds
 */
export type Params = {
  a11y?: Record<string, string> | false
  description?: string
  headers?: (env: NodeJS.ProcessEnv) => Headers
  scale?: Scale
  styles?: StylesObject
  timeout?: number // Defaults to 5_000 ms
}

/**
 * Helper type to extract parameter types from function templates.
 * @template T Function template type
 */
export type Args<T extends FunctionTemplate> = Parameters<T>[0]
/**
 * Metadata configuration for test stories.
 * @template T Attributes type for the template
 */
export type Meta<T extends Attrs = Attrs> = {
  args?: Attrs
  parameters?: Params
  template?: FunctionTemplate<T>
}
/**
 * Test play function type for interaction testing.
 * Provides utilities for assertion and DOM manipulation.
 *
 * @example
 * ```ts
 * const play: Play = async ({
 *   assert,
 *   findByText,
 *   fireEvent,
 *   hostElement
 * }) => {
 *   const button = await findByText('Click me');
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
 * Story object type for defining component test scenarios.
 * @template T Attributes type for the template
 *
 * @example
 * ```ts
 * const Primary: StoryObj = {
 *   args: { title: 'Hello' },
 *   parameters: { scale: 2 },
 *   play: async ({ assert }) => {
 *     // Test interactions
 *   }
 * };
 * ```
 */
export type StoryObj<T extends Attrs = Attrs> = {
  args?: Attrs
  parameters?: Params
  play?: Play
  template?: FunctionTemplate<T>
}
/**
 * Required test parameters with resolved defaults.
 * Used internally for test execution.
 */
export type TestParams = {
  a11y?: false | Record<string, string>
  description?: string
  scale?: Scale
  timeout: number
}
/**
 * Event type for failed test scenarios.
 * Includes detailed error information and test context.
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
 * Event type for successful test completion.
 * Includes test route information.
 */
export type PassedTestEvent = {
  address: string
  type: typeof TEST_PASSED
  detail: {
    route: string
  }
}
