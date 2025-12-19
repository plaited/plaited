/* eslint-disable @typescript-eslint/no-explicit-any */
import axe from 'axe-core'
import { P_TARGET } from '../main/create-template.constants.ts'
import { deepEqual, isTypeOf, noop, trueTypeOf } from '../utils.ts'
import { DATA_TESTID, STORY_FIXTURE } from './testing.constants.ts'
import { AccessibilityError, FailedAssertionError, MissingAssertionParameterError } from './testing.errors.ts'
import type {
  AccessibilityCheck,
  Assert,
  FindByAttribute,
  FindByTarget,
  FindByTestId,
  FindByText,
  FireEvent,
  FireEventOptions,
} from './testing.types.ts'

/**
 * Creates pattern matcher for string content.
 * Supports literal strings and RegExp patterns.
 *
 * @param str - Source string to search
 * @returns Curried function accepting pattern
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
 * Pattern matching utility for text content.
 * Auto-escapes special characters in string patterns.
 *
 * @param str - Text to search within
 * @returns Function accepting pattern to match
 *
 * @remarks
 * - Returns empty string when no match
 * - First match only
 * - Safe for user input
 */
export const match: Match = (str: string) => (pattern: string | RegExp) => {
  const RE = new RegExp(typeof pattern === 'string' ? escapeRegex(pattern) : pattern)
  const matched = str.match(RE)
  return matched ? matched[0] : ''
}

/**
 * Tests if function throws error.
 * Handles sync and async functions.
 *
 * @typeParam U - Function argument types
 * @typeParam V - Function return type
 * @param fn - Function to test
 * @param args - Arguments to pass
 * @returns Error string or undefined
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
// biome-ignore lint/suspicious/noExplicitAny: Type guard needs to accept any value to check if it's a Promise
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
// biome-ignore lint/suspicious/noExplicitAny: Needs to handle both Promises and non-Promises of unknown types
const catchPromise = (x: any) => (isPromise(x) ? catchAndReturn(x) : x)

/**
 * Captures function errors as strings.
 * Works with sync/async functions and Promise rejections.
 *
 * @template U - Argument types array
 * @template V - Return type
 * @param fn - Function to execute (defaults to noop)
 * @param args - Function arguments
 * @returns Error string or undefined
 *
 * @remarks
 * Use cases:
 * - Testing error conditions
 * - Verifying error messages
 * - Handling async rejections
 * - Consistent error formatting
 */
export const throws: Throws = (
  //@ts-expect-error: noop
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
  return isTypeOf<Record<string, unknown>>(value, 'object') || isTypeOf<unknown[]>(value, 'array')
    ? value
    : value instanceof Set
      ? `Set <${JSON.stringify(Array.from(value))}>`
      : value instanceof Map
        ? `Map <${JSON.stringify(Object.fromEntries(value))}>`
        : PRIMITIVES.has(trueTypeOf(value))
          ? value
          : (value?.toString?.() ?? value)
}

/**
 * Structured assertion with detailed error reporting.
 * Compares values using deep equality.
 *
 * @template T - Type of compared values
 * @param param - Assertion configuration
 * @param param.given - Test context description
 * @param param.should - Expected behavior
 * @param param.actual - Actual value
 * @param param.expected - Expected value
 *
 * @throws {MissingAssertionParameterError} Missing required params
 * @throws {FailedAssertionError} Values don't match
 */
export const assert: Assert = (args) => {
  const missing = requiredKeys.filter((k) => !Object.keys(args).includes(k))
  if (missing.length) {
    const msg = [`The following parameters are required by 'assert': (`, `  ${missing.join(', ')}`, ')'].join('\n')
    throw new MissingAssertionParameterError(msg)
  }
  const { given = undefined, should = '', actual = undefined, expected = undefined } = args
  const message = `Given ${given}: should ${should}`
  const detail = { message, actual: actual ?? 'undefined', expected }
  if (!deepEqual(actual, expected)) {
    throw new FailedAssertionError(JSON.stringify(detail, replacer, 2))
  }
}

const searchByAttribute = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>({
  attributeName,
  attributeValue,
  context,
}: {
  attributeName: string
  attributeValue: string | RegExp
  context?: HTMLElement | SVGElement
}): Promise<T | undefined> => {
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

/**
 * Finds element by attribute across shadow DOM.
 * Searches recursively through all DOM trees.
 *
 * @template T - Element type to return
 * @param attributeName - Attribute to search
 * @param attributeValue - Value or pattern
 * @param context - Search scope
 * @returns Promise with found element
 */
export const findByAttribute: FindByAttribute = async <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement,
): Promise<T | undefined> => {
  const result = await searchByAttribute<T>({
    context,
    attributeName,
    attributeValue,
  })
  return result
}

export const findByTestId: FindByTestId = async <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  testId: string | RegExp,
  context?: HTMLElement | SVGElement,
): Promise<T | undefined> => {
  const result = await searchByAttribute<T>({
    context,
    attributeName: DATA_TESTID,
    attributeValue: testId,
  })
  return result
}

export const findByTarget: FindByTarget = async <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  pTarget: string | RegExp,
  context?: HTMLElement | SVGElement,
): Promise<T | undefined> => {
  const result = await searchByAttribute<T>({
    context,
    attributeName: P_TARGET,
    attributeValue: pTarget,
  })
  return result
}

/**
 * Finds element by text content across shadow DOM.
 * Returns parent of matching text node.
 *
 * @template T - HTMLElement type to return
 * @param searchText - Text or pattern to find
 * @param context - Search scope
 * @returns Promise with found element
 *
 * @remarks
 * - Text is trimmed before comparison
 * - Returns parent of text node
 * - Searches all shadow roots
 */
const searchForText: FindByText = <T extends HTMLElement = HTMLElement>(
  searchText: string | RegExp,
  context?: HTMLElement,
): Promise<T | undefined> => {
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

export const findByText: FindByText = async <T extends HTMLElement = HTMLElement>(
  searchText: string | RegExp,
  context?: HTMLElement,
) => {
  const result = await searchForText<T>(searchText, context)
  return result
}

/**
 * Dispatches DOM events for testing.
 * Supports native and custom events.
 *
 * @template T - Element type
 * @param element - Target element
 * @param eventName - Event type
 * @param options - Event config
 * @returns Promise after dispatch
 *
 * @remarks
 * Defaults:
 * - bubbles: true
 * - composed: true
 * - cancelable: true
 */
export const fireEvent: FireEvent = async <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T,
  eventName: string,
  options: FireEventOptions = {
    bubbles: true,
    composed: true,
    cancelable: true,
  },
): Promise<void> => {
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

/**
 * @internal
 * Creates an `accessibilityCheck` function that integrates with Axe-core for accessibility testing
 * within a story fixture. It triggers events to inform the runner and throws an `AccessibilityError`
 * if violations are found.
 * @param trigger - The Plaited trigger function to dispatch events.
 * @returns An asynchronous function to perform accessibility checks.
 */
export const accessibilityCheck: AccessibilityCheck = async ({ exclude, rules, config = {} }) => {
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
  if (violations.length) {
    throw new AccessibilityError(JSON.stringify(violations))
  }
}
