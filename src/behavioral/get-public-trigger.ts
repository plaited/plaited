import type { Trigger } from './b-program.js'

/**
 * Creates a wrapped `Trigger` function that filters events based on a whitelist.
 * This is useful for exposing a limited set of events as a public API for a component
 * or module, preventing internal events from being triggered externally.
 *
 * If an event type is provided that is not in the `publicEvents` list,
 * it will not be passed to the original trigger function, and a warning
 * will be logged to the console.
 *
 * @param args Configuration object.
 * @param args.trigger The original `Trigger` function obtained from `bProgram()`.
 * @param args.publicEvents An optional array of event type strings that are allowed
 *   to be dispatched through this restricted trigger. If omitted or empty,
 *   no events will be allowed.
 * @returns A new `Trigger` function that only allows events specified in `publicEvents`.
 * @example
 * import { bProgram, getPublicTrigger } from 'plaited/behavioral';
 *
 * const { trigger: internalTrigger } = bProgram();
 *
 * // Create a trigger that only allows 'user/login' and 'ui/button-click' events.
 * const publicTrigger = getPublicTrigger({
 *   trigger: internalTrigger,
 *   publicEvents: ['user/login', 'ui/button-click']
 * });
 *
 * // This will be processed by the internalTrigger.
 * publicTrigger({ type: 'user/login', detail: { username: 'test' } });
 *
 * // This will be ignored, and a warning will be logged.
 * publicTrigger({ type: 'internal/data-update', detail: {} });
 */
export const getPublicTrigger = ({
  trigger,
  publicEvents,
  errorPrefix = `Not a public BPEvent type`,
}: {
  trigger: Trigger
  publicEvents?: string[] | ReadonlyArray<string>
  errorPrefix?: string
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
    throw new Error(`${errorPrefix}: ${type}`)
  }
}
