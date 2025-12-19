import type { Trigger } from '../main.ts'
import type { Wait } from '../utils.ts'
import { FIXTURE_EVENTS } from './testing.constants.ts'
import type {
  AccessibilityCheck,
  AccessibilityCheckParams,
  Assert,
  FindByAttribute,
  FindByAttributeArgs,
  FindByTarget,
  FindByTargetArgs,
  FindByTestId,
  FindByTestIdArgs,
  FindByText,
  FindByTextArgs,
  FireEvent,
  FireEventArgs,
  Play,
} from './testing.types.ts'
import { match, throws } from './testing.utils.ts'

/**
 * Creates interaction utilities for story tests.
 * Provides test helpers that communicate with the fixture via trigger events.
 *
 * @param trigger - Plaited trigger function from behavioral element
 * @returns Async function that executes play function with test utilities
 *
 * @remarks
 * Utilities provided to play function:
 * - assert: Structured assertions with detailed error reporting
 * - accessibilityCheck: Axe-core accessibility testing
 * - findByAttribute: Query elements by attribute across shadow DOM
 * - findByText: Query elements by text content
 * - findByTarget: Query elements by p-target attribute
 * - findByTestId: Query elements by data-testid attribute
 * - fireEvent: Dispatch DOM events for interaction testing
 * - match: Pattern matching for text content
 * - throws: Capture function errors as strings
 * - wait: Async delay utility
 *
 * All query and interaction utilities use Promise.withResolvers() pattern
 * to coordinate async operations through the trigger system.
 *
 * @see {@link Play} for play function signature
 * @see {@link FIXTURE_EVENTS} for event types
 */
export const useInteract = (trigger: Trigger) => {
  const assert: Assert = (detail) => trigger({ type: FIXTURE_EVENTS.assertion, detail })
  const accessibilityCheck: AccessibilityCheck = async (args: AccessibilityCheckParams) => {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    trigger({
      type: FIXTURE_EVENTS.accessibility_check,
      detail: {
        args,
        resolve,
        reject,
      },
    })
    return await promise
  }
  const findByAttribute: FindByAttribute = async <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    ...args: FindByAttributeArgs
  ) => {
    const { promise, resolve, reject } = Promise.withResolvers<T | undefined>()
    trigger({
      type: FIXTURE_EVENTS.find_by_attribute,
      detail: {
        args,
        resolve,
        reject,
      },
    })
    return await promise
  }
  const findByText: FindByText = async <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    ...args: FindByTextArgs
  ) => {
    const { promise, resolve, reject } = Promise.withResolvers<T | undefined>()
    trigger({
      type: FIXTURE_EVENTS.find_by_text,
      detail: {
        args,
        resolve,
        reject,
      },
    })
    return await promise
  }
  const findByTarget: FindByTarget = async <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    ...args: FindByTargetArgs
  ) => {
    const { promise, resolve, reject } = Promise.withResolvers<T | undefined>()
    trigger({
      type: FIXTURE_EVENTS.find_by_target,
      detail: {
        args,
        resolve,
        reject,
      },
    })
    return await promise
  }
  const findByTestId: FindByTestId = async <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    ...args: FindByTestIdArgs
  ) => {
    const { promise, resolve, reject } = Promise.withResolvers<T | undefined>()
    trigger({
      type: FIXTURE_EVENTS.find_by_test_id,
      detail: {
        args,
        resolve,
        reject,
      },
    })
    return await promise
  }
  const fireEvent: FireEvent = async (...args: FireEventArgs) => {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    trigger({
      type: FIXTURE_EVENTS.fire_event,
      detail: {
        args,
        resolve,
        reject,
      },
    })
    return await promise
  }
  const wait: Wait = async (args: number) => {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    trigger({
      type: FIXTURE_EVENTS.wait,
      detail: {
        args,
        resolve,
        reject,
      },
    })
    return await promise
  }
  return async (play: Play) => {
    await play?.({
      assert,
      accessibilityCheck,
      findByAttribute,
      findByText,
      findByTarget,
      findByTestId,
      fireEvent,
      match,
      throws,
      wait,
    })
  }
}
