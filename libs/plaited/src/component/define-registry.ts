import type { GetPlaitedElement } from '../types.js'

export const defineRegistry = (registry: Set<GetPlaitedElement>, silent = false) => {
  for (const cb of registry) {
    const el = cb()
    const elTag = el.tag
    if (customElements.get(elTag)) {
      !silent && console.error(`${elTag} already defined`)
      continue
    }
    customElements.define(elTag, el)
  }
}
