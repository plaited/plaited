import type { PlaitedTemplate } from '../component/types.js'
import { isTypeOf } from '@plaited/utils'
import { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'
import { GLOB_PATTERN_COMPONENT } from './constants.js'

export const isPlaitedComponent = (mod: unknown): mod is PlaitedTemplate =>
  isTypeOf<PlaitedTemplate>(mod, 'function') && mod?.$ === PLAITED_COMPONENT_IDENTIFIER

export const findDuplicateTags = async (dir: string, pattern = GLOB_PATTERN_COMPONENT) => {
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
