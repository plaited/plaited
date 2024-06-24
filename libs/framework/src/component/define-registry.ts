import type { GetPlaitedElement } from '../types.js'

export const defineRegistry = (registry: Set<GetPlaitedElement>, silent = false) => {
  for (const el of registry) {
    if (customElements.get(el.tag)) {
      !silent && console.error(`${el.tag} already defined`)
      continue
    }
    customElements.define(el.tag, el())
  }
}
