import type { Trigger } from '../behavioral/b-program.js'

/**
 * Creates a restricted trigger that only processes whitelisted events.
 * Provides warning feedback for unobserved event types.
 * @param args Configuration object containing:
 *  - trigger: The base trigger function to wrap
 *  - publicEvents: Optional array of allowed event types
 * @returns A filtered trigger function that only processes whitelisted events
 * @example
 * const publicTrigger = getPublicTrigger({
 *   trigger: baseTrigger,
 *   publicEvents: ['event1', 'event2']
 * });
 */
export const getPublicTrigger = (args: { trigger: Trigger; publicEvents?: string[] | ReadonlyArray<string> }) => {
  const observed = new Set(args?.publicEvents || [])
  const trigger: Trigger = ({ type, detail }) => {
    if (observed.has(type)) return args.trigger?.({ type: type, detail: detail })
    if (type) console.warn(`Not observing trigger [${type}]`)
  }
  return trigger
}
