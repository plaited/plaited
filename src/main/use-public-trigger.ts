/**
 * @internal
 * @module use-public-trigger
 *
 * Purpose: Provides event filtering for secure component public APIs
 * Architecture: Wrapper pattern that validates events against a whitelist before triggering
 * Dependencies: Trigger type from behavioral.types
 * Consumers: bElement for exposing controlled component APIs
 *
 * Maintainer Notes:
 * - This module implements security-by-whitelist for event triggering
 * - Set-based lookup provides O(1) event validation
 * - Fail-fast pattern throws immediately on unauthorized events
 * - Used internally by bElement when publicEvents option is specified
 *
 * Common modification scenarios:
 * - Changing error messages: Update throw statement formatting
 * - Adding event logging: Insert before trigger call
 * - Supporting wildcards: Modify Set lookup logic
 *
 * Performance considerations:
 * - Set initialization: O(n) where n = publicEvents length
 * - Event validation: O(1) lookup per trigger call
 * - No memory overhead beyond the Set instance
 *
 * Known limitations:
 * - No support for event patterns or wildcards
 * - Error messages list all allowed events (could be verbose)
 * - No event transformation or remapping support
 */
import type { Trigger } from './behavioral.types.ts'

/**
 * @internal
 * Error thrown when attempting to trigger an event not in the public events whitelist.
 */
class UnauthorizedEventError extends Error implements Error {
  override name = 'unauthorized_event'
}

/**
 * @internal
 * Creates a wrapped `Trigger` function that filters events based on a whitelist.
 * This is useful for exposing a limited set of events as a public API for a component
 * or module, preventing internal events from being triggered externally.
 *
 * If an event type is provided that is not in the `publicEvents` list,
 * it will not be passed to the original trigger function, and an error
 * will be thrown.
 *
 * @param args Configuration object.
 * @param args.trigger The original `Trigger` function obtained from `bProgram()`.
 * @param args.publicEvents An optional array of event type strings that are allowed
 *   to be dispatched through this restricted trigger. If omitted or empty,
 *   no events will be allowed.
 * @returns A new `Trigger` function that only allows events specified in `publicEvents`.
 *
 * @throws {Error} When attempting to trigger an event type not in publicEvents list
 *
 * @remarks
 * - Uses Set for O(1) event lookup performance
 * - Throws immediately on unauthorized events to fail fast
 * - Prevents accidental triggering of internal events from external code
 * - Used internally by bElement when publicEvents are specified
 *
 * @see {@link Trigger} for the base trigger type
 * @see {@link bElement} for usage in components
 */
export const usePublicTrigger = ({
  trigger,
  publicEvents,
}: {
  trigger: Trigger
  publicEvents?: (string | symbol)[] | ReadonlyArray<string | symbol>
}): Trigger => {
  /**
   * @internal
   * Creates a Set for O(1) lookup performance.
   * Null coalescing to empty array ensures Set is always valid.
   */
  const observed = new Set(publicEvents ?? [])

  /**
   * @internal
   * The returned trigger function that validates events.
   * Throws on unauthorized events to fail fast and prevent security issues.
   */
  return ({ type, detail }) => {
    if (observed.has(type)) return trigger({ type: type, detail: detail })
    throw new UnauthorizedEventError(
      `Event type "${String(type)}" is not allowed. Only public event types can be triggered: [${Array.from(observed)
        .map((t) => String(t))
        .join(', ')}]`,
    )
  }
}
