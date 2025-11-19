import type axe from 'axe-core'
import type { FunctionTemplate, HostStylesObject, TemplateObject } from '../main.js'
import type { Wait } from '../utils.js'
import type { Match, Throws } from './testing.utils.js'
import { FIXTURE_EVENTS, STORY_TYPES, STORY_IDENTIFIER } from './testing.constants.js'

/**
 * Parameters for structured test assertions.
 * @template T - Type of values being compared
 */
type AssertParams<T> = {
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

type InstrumentedDetails<T> = T

/** @internal Represents the detailed parameters captured for an instrumented `Assert` call, used for testing and reporting. */
export type AssertDetails = InstrumentedDetails<Parameters<Assert>>

/** @internal Represents the detailed parameters captured for an instrumented `Wait` call, used for testing and reporting. */
export type WaitDetails = InstrumentedDetails<Parameters<Wait>>

type AccessibilityCheckArgs = { exclude?: axe.ContextProp; rules?: axe.RuleObject; config?: Omit<axe.Spec, 'reporter'> }

/**
 * Performs accessibility testing using axe-core.
 * Validates components against WCAG standards.
 *
 * @param args - Axe-core configuration options
 * @returns Promise that resolves if no violations found
 * @throws {AccessibilityError} When violations detected
 */
export type AccessibilityCheck = (args: AccessibilityCheckArgs) => Promise<void>

export type AccessibilityCheckDetails = InstrumentedDetails<Parameters<AccessibilityCheck>>

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
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement,
) => Promise<T | undefined>

/** @internal Represents the detailed parameters captured for an instrumented `FindByAttribute` call, used for testing and reporting. */
export type FindByAttributeDetails = InstrumentedDetails<Parameters<FindByAttribute>>

export type FindByTestId = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  testId: string | RegExp,
  context?: HTMLElement | SVGElement,
) => Promise<T | undefined>

/** @internal Represents the detailed parameters captured for an instrumented `FindByAttribute` call, used for testing and reporting. */
export type FindByTestIdDetails = InstrumentedDetails<Parameters<FindByTestId>>

export type FindByTarget = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  target: string | RegExp,
  context?: HTMLElement | SVGElement,
) => Promise<T | undefined>

/** @internal Represents the detailed parameters captured for an instrumented `FindByAttribute` call, used for testing and reporting. */
export type FindByTargetDetails = InstrumentedDetails<Parameters<FindByTarget>>

/**
 * Finds elements by text content across shadow DOM boundaries.
 *
 * @template T - HTMLElement type to return
 * @param searchText - Text or pattern to match
 * @param context - Search scope (defaults to document.body)
 * @returns Promise resolving to found element or undefined
 */
export type FindByText = {
  <T extends HTMLElement = HTMLElement>(searchText: string | RegExp, context?: HTMLElement): Promise<T | undefined>
  name: string
}

/** @internal Represents the detailed parameters captured for an instrumented `FindByText` call, used for testing and reporting. */
export type FindByTextDetail = InstrumentedDetails<Parameters<FindByText>>

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
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    element: T,
    eventName: string,
    options?: FireEventOptions,
  ): Promise<void>
  name: string
}

/** @internal Represents the detailed parameters captured for an instrumented `FireEvent` call, used for testing and reporting. */
export type FireEventDetail = InstrumentedDetails<Parameters<FireEvent>>

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
 */
export type Play = (args: {
  assert: Assert
  findByAttribute: FindByAttribute
  findByTarget: FindByTarget
  findByText: FindByText
  findByTestId: FindByTestId
  fireEvent: FireEvent
  hostElement: Element
  match: Match
  throws: Throws
  wait: Wait
  accessibilityCheck: AccessibilityCheck
}) => Promise<void>

/**
 * Story with required interaction testing.
 *
 * @template T - Template props type
 * @property args - Component props
 * @property description - Test scenario description
 * @property parameters - Test configuration
 * @property play - Required test function
 * @property template - Component template
 */
export type InteractionStoryObj<T extends FunctionTemplate = FunctionTemplate> = {
  args?: Args<T>
  description: string
  parameters?: Params
  play: Play
  template?: T
}
/**
 * Story for visual/snapshot testing without interactions.
 *
 * @template T - Template props type
 * @property args - Component props
 * @property description - Visual test description
 * @property parameters - Test configuration
 * @property play - Never (enforced as undefined)
 * @property template - Component template
 */
export type SnapshotStoryObj<T extends FunctionTemplate = FunctionTemplate> = {
  args?: Args<T>
  description: string
  parameters?: Params
  play?: never
  template?: T
}

/**
 * Story definition for component testing.
 * Can be interaction or snapshot test.
 *
 * @template T - Component props type
 *
 * @see {@link InteractionStoryObj} for interaction tests
 * @see {@link SnapshotStoryObj} for visual tests
 */
export type StoryObj<T extends FunctionTemplate = FunctionTemplate> = InteractionStoryObj<T> | SnapshotStoryObj<T>

/**
 * Defines the structure for the detail payload of test failure events.
 * It's a mapped type where keys are specific failure event types (e.g., accessibility violation, failed assertion)
 * and values are the associated error details (type `unknown` for flexibility).
 * Uses constants from `FIXTURE_EVENTS`.
 */
export type TestFailureEventDetail = {
  [K in
    | typeof FIXTURE_EVENTS.accessibility_violation
    | typeof FIXTURE_EVENTS.failed_assertion
    | typeof FIXTURE_EVENTS.missing_assertion_parameter
    | typeof FIXTURE_EVENTS.unknown_error]?: unknown
}

/**
 * Represents a message structure used by the story runner, likely for communication
 * between different parts of the test execution environment (e.g., test runner and reporter, or main thread and worker).
 *
 * @property colorScheme - Indicates the color scheme (e.g., 'light', 'dark') active during the test run or for rendering.
 * @property snapshot - A `SnapshotMessage` from the behavioral program, capturing its state at a relevant point in time for the story.
 * @property pathname - The path or unique identifier of the story being run or reported on.
 */
export type RunnerMessage = {
  colorScheme: 'light' | 'dark'
  pathname: string
  snapshot: Array<{
    thread: string
    trigger: boolean
    selected: boolean
    type: string
    detail?: unknown
    priority: number
    blockedBy?: string
    interrupts?: string
  }>
}

export type InteractionExport<T extends FunctionTemplate = FunctionTemplate> = {
  template?: T
  args?: Args<T>
  fixture: TemplateObject
  description: string
  type: typeof STORY_TYPES.interaction
  parameters?: Params
  play: Play
  $: typeof STORY_IDENTIFIER
}
export type SnapshotExport<T extends FunctionTemplate = FunctionTemplate> = {
  template?: T
  args?: Args<T>
  fixture: TemplateObject
  description: string
  type: typeof STORY_TYPES.snapshot
  parameters?: Params
  play?: never
  $: typeof STORY_IDENTIFIER
}

export type StoryExport<T extends FunctionTemplate = FunctionTemplate> = InteractionExport<T> | SnapshotExport<T>
