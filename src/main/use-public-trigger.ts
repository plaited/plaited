import type { Trigger } from './behavioral.types.js'

/**
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
 * - Common pattern in bElement for exposing component public APIs
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
    throw new Error(
      `Event type "${type}" is not allowed. Only public event types can be triggered: [${Array.from(observed)
        .map((t) => t)
        .join(', ')}]`,
    )
  }
}
