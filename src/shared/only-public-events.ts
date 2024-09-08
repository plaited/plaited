import { trueTypeOf } from '../utils.js'
import type { Trigger, BPEvent } from '../behavioral.js'

export const onlyPublicEvents =
  <T = unknown>(trigger: Trigger, publicEvents: string[]) =>
  (args: BPEvent<T>): void => {
    const observed = new Set(publicEvents)
    if (trueTypeOf(args) !== 'object') return console.error(`Invalid BPEvent`)
    if (!('type' in args)) return console.error(`BPEvent missing [type]`)
    const { type, detail } = args
    return observed.has(type)
      ? trigger?.({ type, detail })
      : console.warn(`Not observing trigger [${type}]`)
  }
