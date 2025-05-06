import type { Trigger } from '../behavioral/b-program.js'

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
export const getPublicTrigger = (args: { trigger: Trigger; publicEvents?: string[] | ReadonlyArray<string> }) => {
  const observed = new Set(args?.publicEvents || [])
  const trigger: Trigger = ({ type, detail }) => {
    if (observed.has(type)) return args.trigger?.({ type: type, detail: detail })
    if (type) console.warn(`Not observing trigger [${type}]`)
  }
  return trigger
}
