import type { Trigger } from '../behavioral/b-program.js'

export const getPublicTrigger = (args: { trigger: Trigger; publicEvents?: string[] | ReadonlyArray<string> }) => {
  const observed = new Set(args?.publicEvents || [])
  const trigger: Trigger = ({ type, detail }) => {
    if (observed.has(type)) return args.trigger?.({ type: type, detail: detail })
    if (type) console.warn(`Not observing trigger [${type}]`)
  }
  return trigger
}
