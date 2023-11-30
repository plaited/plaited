import { PlaitedComponentConstructor } from '../../types/dist/index.js'

export const define = (comp: PlaitedComponentConstructor) => {
  const { registry, tag } = comp
  for (const el of registry) {
    const elTag = el.tag
    if (customElements.get(elTag)) {
      console.error(`${elTag} already defined`)
      continue
    }
    customElements.define(elTag, el)
  }
  if (customElements.get(tag)) {
    console.error(`${tag} already defined`)
    return
  }
  customElements.define(tag, comp)
}
