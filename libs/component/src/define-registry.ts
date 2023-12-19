import { PlaitedElementConstructor } from '@plaited/component-types'

export const defineRegistry = (registry: Set<PlaitedElementConstructor>, silent = false) => {
  for (const el of registry) {
    const elTag = el.tag
    if (customElements.get(elTag)) {
      !silent && console.error(`${elTag} already defined`)
      continue
    }
    customElements.define(elTag, el)
  }
}
