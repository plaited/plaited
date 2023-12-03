import { PlaitedComponentConstructor } from '@plaited/component-types'

export const defineRegistry = (registry: Set<PlaitedComponentConstructor>, silent = false) => {
  for (const el of registry) {
    const elTag = el.tag
    if (customElements.get(elTag)) {
      !silent && console.error(`${elTag} already defined`)
      continue
    }
    customElements.define(elTag, el)
  }
}

export const define = (comp: PlaitedComponentConstructor, silent = false) => {
  const { registry, tag } = comp
  defineRegistry(registry, silent)
  if (customElements.get(tag)) {
    !silent && console.error(`${tag} already defined`)
    return
  }
  customElements.define(tag, comp)
}
