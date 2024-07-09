import { trueTypeOf } from '../utils.js'
import { Trigger, BPEvent } from '../behavioral/types.js'

export const onlyPublicEvents =
  (trigger: Trigger, publicEvents: string[]) =>
  (args: BPEvent): void => {
    const observed = new Set(publicEvents)
    if (trueTypeOf(args) !== 'object') return console.error(`Invalid BPEvent`)
    const { type, detail } = args
    if (!('type' in args)) return console.error(`BPEvent missing [type]`)
    if (observed.has(type)) return trigger?.({ type, detail })
    return console.warn(`Not observing trigger [${type}]`)
  }
