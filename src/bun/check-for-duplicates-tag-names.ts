import type { PlaitedTemplate } from '../client/types.js'
import { isTypeOf } from '../utils/true-type-of.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from '../shared/constants.js'
import { GLOB_PATTERN_DUPLICATE_TAGS } from './bun.constants.js'

const isPlaitedComponent = (mod: unknown): mod is PlaitedTemplate =>
  isTypeOf<PlaitedTemplate>(mod, 'function') && mod?.$ === PLAITED_TEMPLATE_IDENTIFIER

export const checkForDuplicateTagNames = async (dir: string, pattern = GLOB_PATTERN_DUPLICATE_TAGS) => {
  const glob = new Bun.Glob(pattern)
  const components = new Map<string, string[]>()
  const componentPaths = await Array.fromAsync(glob.scan({ cwd: dir }))
  await Promise.all(
    componentPaths.map(async (path) => {
      try {
        const modules = await import(path)
        for (const name of modules) {
          const mod = modules[name]
          if (!mod || !isPlaitedComponent(mod)) continue
          if (components.has(mod.tag)) {
            components.get(mod.tag)?.push(path)
          } else {
            components.set(mod.tag, [path])
          }
        }
        return path
      } catch (err) {
        console.error(err)
      }
    }),
  )
  return [...components].filter(([_, paths]) => paths.length > 1)
}
