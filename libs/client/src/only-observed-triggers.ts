import { Trigger, BPEvent } from '@plaited/behavioral'
import { trueTypeOf } from '@plaited/utils'
import { PlaitedElement } from '@plaited/types'

export const onlyObservedTriggers =
  (trigger: Trigger, el: PlaitedElement | string[]) =>
  (args: BPEvent): void => {
    const _observedTriggers = new Set(Array.isArray(el) ? el : el.observedTriggers ?? [])
    if (trueTypeOf(args) !== 'object') return console.error(`Invalid BPEvent`)
    const { type, detail } = args
    if (!('type' in args)) return console.error(`BPEvent missing [type]`)
    if (_observedTriggers.has(type)) return trigger?.({ type, detail })
    return console.warn(`Not observing trigger [${type}]`)
  }
