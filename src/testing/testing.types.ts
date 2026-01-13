import type axe from 'axe-core'
import type { FunctionTemplate, HostStylesObject, TemplateObject } from '../ui.ts'
import type { Wait } from '../utils.ts'
import type { __PLAITED_RUNNER__, STORY_IDENTIFIER, STORY_TYPES } from './testing.constants.ts'
import type { RunnerMessage } from './testing.schemas.ts'
import type { Match, Throws } from './testing.utils.ts'

/**
 * Parameters for structured test assertions.
 * @template T - Type of values being compared
 */
export type AssertParams<T = unknown> = {
  given: string
  should: string
  actual: T
  expected: T
}

/**
 * Assertion function for structured testing with detailed error reporting.
 * @template T - Type of values being compared
 */
export type Assert = <T>(param: AssertParams<T>) => void

export type AccessibilityCheckParams = {
  exclude?: axe.ContextProp
  rules?: axe.RuleObject
  config?: Omit<axe.Spec, 'reporter'>
}

/**
 * Performs accessibility testing using axe-core.
 * Validates elements against WCAG standards.
 *
 * @param args - Axe-core configuration options
 * @returns Promise that resolves if no violations found
 * @throws {AccessibilityError} When violations detected
 */
export type AccessibilityCheck = (param: AccessibilityCheckParams) => Promise<void>

export type FindByAttributeArgs = [
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement,
]
/**
 * Finds elements by attribute value across shadow DOM boundaries.
 *
 * @template T - Element type to return
 * @param attributeName - Attribute to search for
 * @param attributeValue - Value or pattern to match
 * @param context - Search scope (defaults to document)
 * @returns Promise resolving to found element or undefined
 */
export type FindByAttribute = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  ...args: FindByAttributeArgs
) => Promise<T | undefined>

export type FindByTestIdArgs = [testId: string | RegExp, context?: HTMLElement | SVGElement]

export type FindByTestId = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  ...args: FindByTestIdArgs
) => Promise<T | undefined>

export type FindByTargetArgs = [pTarget: string | RegExp, context?: HTMLElement | SVGElement]

export type FindByTarget = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  ...args: FindByTargetArgs
) => Promise<T | undefined>

export type FindByTextArgs = [searchText: string | RegExp, context?: HTMLElement]
/**
 * Finds elements by text content across shadow DOM boundaries.
 *
 * @template T - HTMLElement type to return
 * @param searchText - Text or pattern to match
 * @param context - Search scope (defaults to document.body)
 * @returns Promise resolving to found element or undefined
 */
export type FindByText = {
  <T extends HTMLElement = HTMLElement>(...args: FindByTextArgs): Promise<T | undefined>
  name: string
}

/**
 * Configuration for dispatching DOM events.
 *
 * @property bubbles - Event propagates up (default: true)
 * @property composed - Crosses shadow DOM (default: true)
 * @property cancelable - Can be prevented (default: true)
 * @property detail - Custom event data
 */
export type FireEventOptions = {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: Record<string, unknown>
}

export type FireEventArgs<T extends HTMLElement | SVGElement = HTMLElement | SVGElement> = [
  element: T,
  eventName: string,
  options?: FireEventOptions,
]
/**
 * Dispatches DOM events for testing interactions.
 *
 * @template T - Element type receiving the event
 * @param element - Target element
 * @param eventName - Event type to dispatch
 * @param options - Event configuration
 * @returns Promise resolving after dispatch
 *
 * @see {@link FireEventOptions} for configuration
 */
export type FireEvent = {
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(...args: FireEventArgs<T>): Promise<void>
  name: string
}

/**
 * @internal Configuration parameters for a specific story test.
 * These options control the testing environment and behavior for a single story.
 *
 * @property headers - An optional factory function to create custom HTTP `Headers` for server-side rendering or network requests within the test. It receives the Node.js process environment.
 * @property styles - Optional `StylesObject` containing additional CSS styles to apply specifically to the context of this story test. Useful for overriding global styles or adding test-specific visual aids.
 * @property [timeout=5000] - Optional. The maximum time (in milliseconds) allowed for the story's `play` function to complete. Defaults to 5000ms.
 */
export type Params = {
  headers?: (env: NodeJS.ProcessEnv) => Headers | Promise<Headers>
  styles?: HostStylesObject
  timeout?: number // Defaults to 5_000 ms
}

/**
 * Extracts props type from a FunctionTemplate.
 * @template T - FunctionTemplate to extract from
 */
export type Args<T extends FunctionTemplate> = Parameters<T>[0]

/**
 * @internal Defines the signature for a story's `play` function, which encapsulates test interactions
 * and assertions for a plaited story. It receives a set of testing utilities as an argument.
 *
 * @param {object} args - An object containing testing utilities.
 * @param {typeof assert} args.assert - Function for making assertions within the test.
 * @param {typeof findByAttribute} args.findByAttribute - Utility to find elements by attribute value within the story's host element.
 * @param {typeof findByText} args.findByText - Utility to find elements by their text content within the story's host element.
 * @param {typeof fireEvent} args.fireEvent - Utilities for dispatching DOM events (e.g., click, input).
 * @param {Element} args.hostElement - The root DOM element where the story is rendered.
 * @param {typeof match} args.match - Utility for flexible matching of strings or regular expressions.
 * @param {typeof throws} args.throws - Utility for asserting that a function throws an error.
 * @param {typeof wait} args.wait - Utility to pause execution for a specified duration.
 * @returns {Promise<void>} A promise that resolves when the play function completes.
 */
export type Play = (args: {
  assert: Assert
  findByAttribute: FindByAttribute
  findByTarget: FindByTarget
  findByText: FindByText
  findByTestId: FindByTestId
  fireEvent: FireEvent
  match: Match
  throws: Throws
  wait: Wait
  accessibilityCheck: AccessibilityCheck
}) => Promise<void>

/**
 * Story with required interaction testing.
 *
 * @template T - Template props type
 * @property args - Story props
 * @property intent - Natural language description of what the story demonstrates or tests
 * @property parameters - Test configuration
 * @property play - Required test function
 * @property template - Story template
 */
export type InteractionStoryObj<T extends FunctionTemplate = FunctionTemplate> = {
  args?: Args<T>
  intent: string
  parameters?: Params
  play: Play
  template?: T
}
/**
 * Story for visual/snapshot testing without interactions.
 *
 * @template T - Template props type
 * @property args - Story props
 * @property intent - Natural language description of what the story demonstrates or tests
 * @property parameters - Test configuration
 * @property play - Never (enforced as undefined)
 * @property template - Story template
 */
export type SnapshotStoryObj<T extends FunctionTemplate = FunctionTemplate> = {
  args?: Args<T>
  intent: string
  parameters?: Params
  play?: never
  template?: T
}

/**
 * Story definition for template testing.
 * Can be interaction or snapshot test.
 *
 * @template T - Template attributes type
 *
 * @see {@link InteractionStoryObj} for interaction tests
 * @see {@link SnapshotStoryObj} for visual tests
 */
export type StoryObj<T extends FunctionTemplate = FunctionTemplate> = InteractionStoryObj<T> | SnapshotStoryObj<T>

export type InteractionExport<T extends FunctionTemplate = FunctionTemplate> = {
  template?: T
  args?: Args<T>
  fixture: TemplateObject
  intent: string
  type: typeof STORY_TYPES.interaction
  parameters?: Params
  play: Play
  $: typeof STORY_IDENTIFIER
  only?: boolean
  skip?: boolean
}
export type SnapshotExport<T extends FunctionTemplate = FunctionTemplate> = {
  template?: T
  args?: Args<T>
  fixture: TemplateObject
  intent: string
  type: typeof STORY_TYPES.snapshot
  parameters?: Params
  play?: never
  $: typeof STORY_IDENTIFIER
  only?: boolean
  skip?: boolean
}

export type StoryExport<T extends FunctionTemplate = FunctionTemplate> = InteractionExport<T> | SnapshotExport<T>

/**
 * Story export with chainable .only() and .skip() methods.
 * Allows focused test execution similar to Jest/Vitest.
 *
 * @template T - Story export type
 *
 * @remarks
 * - `.only()`: Marks story for exclusive execution
 * - `.skip()`: Excludes story from execution
 * - Methods return new story objects with flags set
 *
 * @see {@link StoryExport} for base story type
 */

/**
 * Detailed information about an element clicked through the mask overlay.
 * Used for debugging and element inspection during interactive testing.
 *
 * @property x - Horizontal click coordinate (clientX)
 * @property y - Vertical click coordinate (clientY)
 * @property tagName - HTML tag name of the clicked element
 * @property id - Element ID or null if not present
 * @property className - Element class attribute or null if not present
 * @property attributes - Array of all element attributes
 * @property textContent - Element text content or null
 * @property shadowPath - Array of elements traversed through shadow DOM boundaries
 *
 * @see {@link MASK_EVENTS.click} for the event that carries this detail
 */
export type MaskClickDetail = {
  x: number
  y: number
  tagName: string
  id: string | null
  className: string | null
  attributes: Array<{ name: string; value: string }>
  textContent: string | null
  shadowPath: Element[]
}

export type Send = (message: RunnerMessage) => void

export type InitDetail = {
  play?: InteractionStoryObj['play']
  timeout?: number
}

declare global {
  interface Window {
    /**
     * @internal
     * Global flag indicating if the current context is within the Plaited test runner environment.
     * This helps conditional logic, like snapshot reporting, to behave differently when running
     * inside the test runner versus a standard browser environment.
     */
    [__PLAITED_RUNNER__]?: boolean
  }
}
