/* eslint-disable @typescript-eslint/no-explicit-any */
import axe from 'axe-core'
import type { Trigger } from '../../behavioral.js'
import { deepEqual, trueTypeOf, isTypeOf, wait, noop, DelegatedListener, delegates } from '../../utils.js'

import { FIXTURE_EVENTS, STORY_FIXTURE, RELOAD_STORY_PAGE, RUNNER_URL } from './story-fixture.constants.js'
import type {
  Assert,
  AssertDetails,
  FindByAttribute,
  FindByAttributeDetails,
  FindByText,
  FindByTextDetail,
  FireEvent,
  FireEventDetail,
  FireEventOptions,
  WaitDetails,
  AccessibilityCheck,
  AccessibilityCheckDetails,
  RunnerMessage,
} from './story-fixture.types.js'

/**
 * Custom error for test assertion failures.
 * Thrown when an assertion condition is not met.
 *
 * @extends Error
 * @property name Constant identifier 'failed_assertion'
 */
export class FailedAssertionError extends Error implements Error {
  override name = FIXTURE_EVENTS.failed_assertion
  constructor(message: string) {
    super(message)
  }
}

/**
 * Custom error for missing required test parameters.
 * Thrown when required test configuration is not provided.
 *
 * @extends Error
 * @property name Constant identifier 'missing_assertion_parameter'
 */
export class MissingAssertionParameterError extends Error implements Error {
  override name = FIXTURE_EVENTS.missing_assertion_parameter
  constructor(message: string) {
    super(message)
  }
}

/**
 * Custom error for accessibility violations error
 * Thrown when timeout a11y finds an violation
 *
 * @extends Error
 * @property name Constant identifier 'accessibility_violation'
 */
export class AccessibilityError extends Error implements Error {
  override name = FIXTURE_EVENTS.accessibility_violation
  constructor(message: string) {
    super(message)
  }
}

/**
 * Function type for string pattern matching utility.
 * Creates a curried matcher function for finding patterns in strings.
 *
 * @param str - Source string to search within for matches
 * @returns A curried function that takes a pattern and returns the first matched substring
 *
 * @example Using with a string pattern
 * ```ts
 * const matcher: Match = match('Hello world');
 * const result = matcher('world'); // returns 'world'
 * ```
 *
 * @example Using with a RegExp pattern
 * ```ts
 * const matcher: Match = match('Testing 123');
 * const result = matcher(/\d+/); // returns '123'
 * ```
 *
 * @remarks
 * The returned function is curried, allowing for reuse with different patterns
 * on the same source string. This is particularly useful when you need to search
 * for multiple patterns within the same text.
 */
export type Match = {
  (str: string): (pattern: string | RegExp) => string
  name: string
}

/**
 * Escapes special regular expression characters in a string.
 *
 * @internal
 * @param str - String containing potential RegExp special characters
 * @returns String with all RegExp special characters escaped
 */
const escapeRegex = (str: string) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

/**
 * Creates a pattern matcher for finding text in strings.
 * Supports both literal string and RegExp patterns with safe escaping.
 *
 * @param str - Source string to search within
 * @returns A function that accepts a pattern (string or RegExp) and returns the first matched substring
 *
 * @example Finding simple text patterns
 * ```ts
 * const findInText = match('Hello, world!');
 * findInText('world');  // returns 'world'
 * findInText('foo');    // returns '' (no match)
 * ```
 *
 * @example Using regular expressions
 * ```ts
 * const text = match('user@example.com');
 * text(/\w+@\w+\.\w+/);  // returns 'user@example.com'
 * text(/\d+/);           // returns '' (no match)
 * ```
 *
 * @example Safe handling of special characters
 * ```ts
 * const text = match('price is $25.00');
 * text('$25.00');  // returns '$25.00' (special chars handled automatically)
 * text(/\$\d+\.\d+/);  // returns '$25.00' (using RegExp)
 * ```
 *
 * @remarks
 * Key features:
 * - Returns empty string ('') when no match is found
 * - Automatically escapes special RegExp characters in string patterns
 * - Accepts both string literals and RegExp objects as patterns
 * - Returns only the first match found in the string
 * - Thread-safe and immutable - creates new RegExp for each match
 * - Suitable for user-provided patterns due to automatic escaping
 *
 * Common use cases:
 * - Text extraction and validation
 * - Pattern matching in strings
 * - Safe handling of user-provided search terms
 * - Creating reusable text matchers
 */
export const match: Match = (str: string) => (pattern: string | RegExp) => {
  const RE = new RegExp(typeof pattern === 'string' ? escapeRegex(pattern) : pattern)
  const matched = str.match(RE)
  return matched ? matched[0] : ''
}

/**
 * Type definition for error catching utility function.
 * Handles both synchronous and asynchronous functions, capturing their errors
 * and converting them to string representations.
 *
 * @typeParam U - Array of argument types that the tested function accepts
 * @typeParam V - Return type of the tested function, can be any value or Promise
 *
 * @param fn - Function to test for throws. Should be the function you expect to throw an error
 * @param args - Arguments to pass to the tested function. Must match the parameter types of `fn`
 *
 * @returns For synchronous functions, returns a string containing the error message if an error
 * was thrown, or undefined if no error occurred. For asynchronous functions, returns a Promise
 * that resolves to either the error message string or undefined.
 *
 * @example Testing a synchronous function that throws
 * ```ts
 * const error = throws(() => {
 *   throw new Error('Invalid input');
 * });
 * // error === 'Error: Invalid input'
 * ```
 *
 * @example Testing a function with arguments
 * ```ts
 * const divide = (a: number, b: number) => {
 *   if (b === 0) throw new Error('Division by zero');
 *   return a / b;
 * };
 * const error = throws(divide, 10, 0);
 * // error === 'Error: Division by zero'
 * ```
 *
 * @example Testing an async function
 * ```ts
 * const error = await throws(async () => {
 *   throw new Error('Async error');
 * });
 * // error === 'Error: Async error'
 * ```
 */
export type Throws = {
  <U extends unknown[], V>(fn: (...args: U) => V, ...args: U): string | undefined | Promise<string | undefined>
  name: string
}

/**
 * Checks if a value is a Promise by testing for the presence of a `then` method.
 * @internal
 * @param x - Value to check
 * @returns True if the value is Promise-like
 */
const isPromise = (x: any) => x && typeof x.then === 'function'

/**
 * Catches any rejection from a Promise and returns the error.
 * @internal
 * @param x - Promise to handle
 * @returns A new Promise that never rejects, instead resolving with the error
 */
const catchAndReturn = (x: Promise<unknown>) => x.catch((y) => y)

/**
 * Handles both Promise and non-Promise values, ensuring errors are caught.
 * @internal
 * @param x - Value or Promise to process
 * @returns Original value or a Promise that resolves with either the value or error
 */
const catchPromise = (x: any) => (isPromise(x) ? catchAndReturn(x) : x)

/**
 * Utility function for testing if a function throws an error.
 * Captures both synchronous throws and Promise rejections, converting them to string representations.
 *
 * @template U - Array of argument types for the tested function
 * @template V - Return type of the tested function (can be any value or Promise)
 *
 * @param fn - Function to test for throws. Defaults to noop if not provided
 * @param args - Arguments to pass to the tested function
 *
 * @returns A string containing the error message if an error occurred, undefined otherwise.
 * For async functions, returns a Promise that resolves to the error string or undefined.
 *
 * @throws Never - All errors are caught and returned as strings
 *
 * @remarks
 * This function is particularly useful for:
 * - Unit testing error cases
 * - Verifying error handling behavior
 * - Testing both sync and async error paths
 * - Ensuring consistent error handling across different function types
 *
 * The function will:
 * 1. Execute the provided function with given arguments
 * 2. Catch any thrown errors or Promise rejections
 * 3. Convert errors to strings for consistent handling
 * 4. Return undefined if no error occurs
 */
export const throws: Throws = (
  //@ts-ignore: noop
  fn = noop,
  ...args
) => {
  try {
    catchPromise(fn(...args))
    return undefined
  } catch (err) {
    return err?.toString()
  }
}

/** @internal Set of JavaScript primitive type names used for value serialization in assertions. */
const PRIMITIVES = new Set(['null', 'undefined', 'number', 'string', 'boolean', 'bigint'])

/** @internal Keys required for the `assert` function's argument object to ensure complete assertions. */
const requiredKeys = ['given', 'should', 'actual', 'expected']

const replacer = (key: string | number | symbol, value: unknown) => {
  if (!key) return value
  return (
    isTypeOf<Record<string, unknown>>(value, 'object') || isTypeOf<unknown[]>(value, 'array') ? value
    : value instanceof Set ? `Set <${JSON.stringify(Array.from(value))}>`
    : value instanceof Map ? `Map <${JSON.stringify(Object.fromEntries(value))}>`
    : PRIMITIVES.has(trueTypeOf(value)) ? value
    : (value?.toString?.() ?? value)
  )
}

export const useAssert = (trigger: Trigger) => {
  /**
   * A powerful assertion function for testing with detailed error reporting and type safety.
   * This function compares values and throws detailed errors when assertions fail.
   *
   * @template T - Type of values being compared. Must be the same type for both actual and expected values
   *
   * @param param - Configuration object for the assertion
   * @param param.given - Description of the test context or scenario (e.g., "a user login attempt")
   * @param param.should - Expected behavior written in present tense (e.g., "return true for valid credentials")
   * @param param.actual - The value or result being tested
   * @param param.expected - The expected value or result to compare against
   *
   * @throws {MissingAssertionParameterError} When any required parameter (given, should, actual, expected) is missing
   * @throws {FailedAssertionError} When the assertion fails, providing a detailed comparison of actual vs expected values
   *
   * @example
   * Simple Value Comparison
   * ```ts
   * assert({
   *   given: 'a number multiplication',
   *   should: 'return the correct product',
   *   actual: 2 * 3,
   *   expected: 6
   * });
   * ```
   *
   * @example
   * Object Comparison
   * ```ts
   * assert({
   *   given: 'a user object',
   *   should: 'have the correct properties',
   *   actual: {
   *     name: 'John',
   *     age: 30,
   *     roles: ['admin', 'user']
   *   },
   *   expected: {
   *     name: 'John',
   *     age: 30,
   *     roles: ['admin', 'user']
   *   }
   * });
   * ```
   *
   * @example
   * Collections Comparison
   * ```ts
   * assert({
   *   given: 'a Set of unique values',
   *   should: 'contain all expected elements',
   *   actual: new Set([1, 2, 3]),
   *   expected: new Set([1, 2, 3])
   * });
   *
   * assert({
   *   given: 'a Map of configurations',
   *   should: 'match the expected key-value pairs',
   *   actual: new Map([['debug', true], ['mode', 'production']]),
   *   expected: new Map([['debug', true], ['mode', 'production']])
   * });
   * ```
   *
   * @remarks
   * Usage Guidelines:
   * 1. Always provide clear, descriptive contexts in the 'given' parameter
   * 2. Write 'should' statements that clearly describe the expected behavior
   * 3. Ensure actual and expected values are of the same type
   * 4. Use for both simple and complex value comparisons
   * 5. Review error messages carefully for debugging
   *
   * Features:
   * - TypeScript type safety
   * - Deep equality comparison
   * - Built-in support for Set and Map collections
   * - Detailed error messages with formatted output
   * - Primitive and complex object handling
   *
   * Error Message Format:
   * ```
   * {
   *   "message": "Given [context]: should [behavior]",
   *   "actual": [formatted actual value],
   *   "expected": [formatted expected value]
   * }
   * ```
   */

  /**
   * Main assertion function for testing with detailed error reporting.
   * @see {Assert} for type definition and examples
   */
  const assert: Assert = (args) => {
    trigger<{ type: typeof FIXTURE_EVENTS.assert; detail: AssertDetails }>({
      type: FIXTURE_EVENTS.assert,
      detail: [args],
    })
    const missing = requiredKeys.filter((k) => !Object.keys(args).includes(k))
    if (missing.length) {
      const msg = [`The following parameters are required by 'assert': (`, `  ${missing.join(', ')}`, ')'].join('\n')
      throw new MissingAssertionParameterError(msg)
    }
    const { given = undefined, should = '', actual = undefined, expected = undefined } = args
    if (!deepEqual(actual, expected)) {
      const message = `Given ${given}: should ${should}`
      throw new FailedAssertionError(JSON.stringify({ message, actual: actual ?? 'undefined', expected }, replacer, 2))
    }
  }
  return assert
}

export const useFindByAttribute = (trigger: Trigger) => {
  /**
   * @description Asynchronously searches for an element by a specific attribute and its value,
   * traversing both the light DOM and any nested shadow DOM trees.
   *
   * @template T - The expected element type (HTMLElement or SVGElement) to be returned. Defaults to `HTMLElement | SVGElement`.
   * @param {string} attributeName - The name of the attribute to query.
   * @param {string | RegExp} attributeValue - The exact string value or a regular expression to match against the attribute's value.
   * @param {HTMLElement | SVGElement} [context=document] - An optional element (or the document itself) to serve as the starting point for the search. Defaults to `document`.
   * @returns {Promise<T | undefined>} A promise that resolves with the first matching element (cast to type T) or `undefined` if no element with the specified attribute and value is found.
   *
   * @example Basic Usage
   * ```typescript
   * import { findByAttribute } from 'plaited/workshop';
   *
   * // Find an element with the attribute data-testid="login-button"
   * const loginButton = await findByAttribute('data-testid', 'login-button');
   *
   * // Find an element whose class attribute contains 'icon-' followed by letters
   * const iconElement = await findByAttribute('class', /icon-\w+/);
   * ```
   *
   * @example Usage with Context and Specific Type
   * ```typescript
   * const container = document.getElementById('user-section');
   *
   * // Find an <input> element within the container with name="email"
   * const emailInput = await findByAttribute<HTMLInputElement>('name', 'email', container);
   *
   * if (emailInput) {
   *   console.log(emailInput.value);
   * }
   * ```
   *
   * @remarks
   * - The search is performed recursively through all child nodes (element nodes) and shadow roots.
   * - It checks the attribute value using `getAttribute`.
   * - Handles both exact string matches and regular expression tests.
   * - The search operation is scheduled using `requestAnimationFrame`, but the core traversal is synchronous within that frame.
   */
  const findByAttribute: FindByAttribute = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    attributeName: string,
    attributeValue: string | RegExp,
    context?: HTMLElement | SVGElement,
  ): Promise<T | undefined> => {
    trigger<{ type: typeof FIXTURE_EVENTS.find_by_attribute; detail: FindByAttributeDetails }>({
      type: FIXTURE_EVENTS.find_by_attribute,
      detail: [attributeName, attributeValue, context],
    })
    const searchInShadowDom = (node: Node): T | undefined => {
      if (node.nodeType === 1) {
        const attr = (node as Element).getAttribute(attributeName)
        if (typeof attributeValue === 'string' && attr === attributeValue) {
          return node as T
        }
        if (attributeValue instanceof RegExp && attr && attributeValue.test(attr)) {
          return (node as T) ?? undefined
        }
        if ((node as Element).getAttribute(attributeName) === attributeValue) {
          return node as T
        }
      }

      if (node.nodeType === 1 && (node as Element).shadowRoot) {
        for (const child of ((node as Element).shadowRoot as ShadowRoot).children) {
          const result = searchInShadowDom(child)
          if (result) {
            return result
          }
        }
      }

      for (const child of node.childNodes) {
        const result = searchInShadowDom(child)
        if (result) {
          return result
        }
      }
    }

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const rootNode = context ?? document
        const foundNode = searchInShadowDom(rootNode)
        resolve(foundNode)
      })
    })
  }
  return findByAttribute
}

export const useFindByText = (trigger: Trigger) => {
  /**
   * @description Asynchronously searches for an element by its text content, traversing both the light DOM
   * and any nested shadow DOM trees. Returns the immediate parent element of the first matching text node found.
   *
   * @template T - The expected HTMLElement type to be returned. Defaults to `HTMLElement`.
   * @param {string | RegExp} searchText - The exact string or a regular expression to match against the trimmed text content of elements.
   * @param {HTMLElement} [context=document.body] - An optional HTMLElement to serve as the starting point for the search. Defaults to `document.body`.
   * @returns {Promise<T | undefined>} A promise that resolves with the first matching parent element (cast to type T) or `undefined` if no element contains the specified text.
   *
   * @example Basic Usage
   * ```typescript
   * import { findByText } from 'plaited/workshop';
   *
   * // Find an element containing the exact text "Submit Button"
   * const submitButton = await findByText('Submit Button');
   *
   * // Find an element containing text that matches the regex /Save|Update/
   * const saveOrUpdateButton = await findByText(/Save|Update/);
   * ```
   *
   * @example Usage with Context and Specific Type
   * ```typescript
   * const formElement = document.getElementById('my-form');
   *
   * // Find a <button> element within the form containing "Login"
   * const loginButton = await findByText<HTMLButtonElement>('Login', formElement);
   *
   * if (loginButton) {
   *   loginButton.disabled = true;
   * }
   * ```
   *
   * @remarks
   * - The search is performed recursively through all child nodes and shadow roots.
   * - Text content is trimmed (`.textContent?.trim()`) before comparison.
   * - The function returns the `parentElement` of the matching text node.
   * - The search operation is scheduled using `requestAnimationFrame` but the core traversal is synchronous within that frame.
   */
  const findByText: FindByText = <T extends HTMLElement = HTMLElement>(
    searchText: string | RegExp,
    context?: HTMLElement,
  ): Promise<T | undefined> => {
    trigger<{ type: typeof FIXTURE_EVENTS.find_by_text; detail: FindByTextDetail }>({
      type: FIXTURE_EVENTS.find_by_text,
      detail: [searchText, context],
    })
    const searchInShadowDom = (node: Node): T | undefined => {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent?.trim()
        if (typeof searchText === 'string' && content === searchText) {
          return (node.parentElement as T) ?? undefined
        } else if (searchText instanceof RegExp && content && searchText.test(content)) {
          return (node.parentElement as T) ?? undefined
        }
      }

      if (node instanceof HTMLElement && node.shadowRoot) {
        for (const child of node.shadowRoot.children) {
          const result = searchInShadowDom(child)
          if (result) {
            return result
          }
        }
      }

      for (const child of node.childNodes) {
        const result = searchInShadowDom(child)
        if (result) {
          return result
        }
      }
    }

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const rootNode = context ?? document.body
        const foundNode = searchInShadowDom(rootNode)
        resolve(foundNode)
      })
    })
  }
  return findByText
}

export const useFireEvent = (trigger: Trigger) => {
  /**
   * Asynchronously dispatches DOM events with configurable options.
   * Supports both native and custom events with detail data.
   *
   * @template T Element type (defaults to HTMLElement | SVGElement)
   * @param element Target element for event
   * @param eventName Event type to dispatch
   * @param options Event configuration (defaults to bubbling and composed)
   * @returns Promise<void> Resolves after event dispatch
   *
   * @example Basic Event
   * ```ts
   * // Fire click event
   * await fireEvent(button, 'click');
   *
   * // Fire custom event
   * await fireEvent(element, 'custom-event');
   * ```
   *
   * @example With Custom Data
   * ```ts
   * // Fire event with detail
   * await fireEvent(element, 'update', {
   *   detail: { value: 42 }
   * });
   * ```
   *
   * @example Configuration
   * ```ts
   * // Configure event behavior
   * await fireEvent(element, 'change', {
   *   bubbles: false,
   *   cancelable: true,
   *   detail: { data: 'value' }
   * });
   * ```
   *
   * Default Options:
   * - bubbles: true
   * - composed: true
   * - cancelable: true
   *
   * Features:
   * - Support for CustomEvent
   * - Configurable bubbling
   * - Shadow DOM composition
   * - Event cancellation
   * - Type safety
   * - Async operation
   *
   * @remarks
   * - Uses requestAnimationFrame for timing
   * - Automatically selects Event vs CustomEvent
   * - Maintains event defaults
   * - Type-safe element handling
   * - Returns Promise for async operations
   *
   */
  const fireEvent: FireEvent = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    element: T,
    eventName: string,
    options: FireEventOptions = {
      bubbles: true,
      composed: true,
      cancelable: true,
    },
  ): Promise<void> => {
    trigger<{ type: typeof FIXTURE_EVENTS.fire_event; detail: FireEventDetail }>({
      type: FIXTURE_EVENTS.fire_event,
      detail: [element, eventName, options],
    })
    const createEvent = (): Event => {
      if (options?.detail) {
        return new CustomEvent(eventName, options)
      } else {
        return new Event(eventName, options)
      }
    }

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const event = createEvent()
        element.dispatchEvent(event)
        resolve()
      })
    })
  }
  return fireEvent
}

/**
 * @internal
 * Creates a `wait` function that also triggers a FIXTURE_EVENTS.wait event.
 * This is used within story play functions to pause execution and inform the test runner.
 * @param trigger - The Plaited trigger function to dispatch events.
 * @returns A function that takes a duration in milliseconds and returns a Promise that resolves after the duration.
 */
export const useWait = (trigger: Trigger) => (ms: number) => {
  trigger<{ type: typeof FIXTURE_EVENTS.wait; detail: WaitDetails }>({ type: FIXTURE_EVENTS.wait, detail: [ms] })
  return wait(ms)
}

/**
 * @internal
 * Creates an `accessibilityCheck` function that integrates with Axe-core for accessibility testing
 * within a story fixture. It triggers events to inform the runner and throws an `AccessibilityError`
 * if violations are found.
 * @param trigger - The Plaited trigger function to dispatch events.
 * @returns An asynchronous function to perform accessibility checks.
 */
export const useAccessibilityCheck = (trigger: Trigger) => {
  const accessibilityCheck: AccessibilityCheck = async ({ exclude, rules, config = {} }) => {
    trigger<{ type: typeof FIXTURE_EVENTS.accessibility_check; detail: AccessibilityCheckDetails }>({
      type: FIXTURE_EVENTS.accessibility_check,
      detail: [{ exclude, rules, config }],
    })
    axe.configure({
      reporter: 'no-passes',
      ...config,
    })
    const { violations } = await axe.run(
      {
        include: STORY_FIXTURE,
        exclude,
      },
      { reporter: 'no-passes', rules },
    )
    axe.reset()
    if (violations.length) throw new AccessibilityError(JSON.stringify(violations))
  }
  return accessibilityCheck
}

/** @internal Type guard to check if an event is a WebSocket CloseEvent. */
const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

/**
 * @internal
 * Establishes and manages a WebSocket connection to the Plaited test runner server.
 * This utility is responsible for sending test results, snapshots, and other messages
 * from the story fixture to the runner. It handles connection retries and message queuing.
 *
 * @returns A `send` function to dispatch messages to the runner, and a `disconnect` method on the `send` function to close the WebSocket.
 *
 * The `send` function:
 * - Takes a `RunnerMessage` object.
 * - Sends the message as a JSON string over the WebSocket.
 * - If the socket is not open, it queues the message and sends it upon connection.
 * - If the socket is not connected, it attempts to connect.
 *
 * The `send.disconnect` method:
 * - Closes the WebSocket connection.
 *
 * Internal WebSocket handling:
 * - Connects to the runner URL (`/.plaited/test-runner`).
 * - Listens for `open`, `message`, `error`, and `close` events.
 * - Handles page reload requests from the runner.
 * - Implements an exponential backoff retry mechanism for specific close codes.
 */
export const useRunner = () => {
  const retryStatusCodes = new Set([1006, 1012, 1013])
  const maxRetries = 3
  let socket: WebSocket | undefined
  let retryCount = 0
  const ws = {
    async callback(evt: MessageEvent) {
      if (evt.type === 'message') {
        const { data } = evt
        const message = isTypeOf<string>(data, 'string') && data === RELOAD_STORY_PAGE
        if (message) {
          window.location.reload()
        }
      }
      if (isCloseEvent(evt) && retryStatusCodes.has(evt.code)) ws.retry()
      if (evt.type === 'open') {
        retryCount = 0
      }
      if (evt.type === 'error') {
        console.error('WebSocket error: ', evt)
      }
    },
    connect() {
      socket = new WebSocket(`${self?.location?.origin.replace(/^http/, 'ws')}${RUNNER_URL}`)
      delegates.set(socket, new DelegatedListener(ws.callback))
      // WebSocket connection opened
      socket.addEventListener('open', delegates.get(socket))
      // Handle incoming messages
      socket.addEventListener('message', delegates.get(socket))
      // Handle WebSocket errors
      socket.addEventListener('error', delegates.get(socket))
      // WebSocket connection closed
      socket.addEventListener('close', delegates.get(socket))
    },
    retry() {
      if (retryCount < maxRetries) {
        // To get max we use a cap: 9999ms base: 1000ms
        const max = Math.min(9999, 1000 * Math.pow(2, retryCount))
        // We then select a random value between 0 and max
        setTimeout(ws.connect, Math.floor(Math.random() * max))
        retryCount++
      }
      socket = undefined
    },
  }
  ws.connect()
  const send = (message: RunnerMessage) => {
    const fallback = () => {
      send(message)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      return socket.send(JSON.stringify(message))
    }
    if (!socket) ws.connect()
    socket?.addEventListener('open', fallback)
  }
  send.disconnect = () => {
    socket?.close()
  }
  return send
}
