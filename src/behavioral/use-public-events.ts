import type { Trigger } from '../behavioral.js'

export const usePublicEvents = (_trigger: Trigger, publicEvents: string[] = []) => {
  const observed = new Set(publicEvents)
  const trigger: Trigger = ({ type, detail }) => {
    if (observed.has(type)) return _trigger?.({ type: type, detail: detail })
    if (type) console.warn(`Not observing trigger [${type}]`)
  }
  return trigger
}
