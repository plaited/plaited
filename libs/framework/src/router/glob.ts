import { PlaitedTemplate } from 'plaited'
import { trueTypeOf } from '@plaited/utils'
import { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'
import { componentMap } from './constants.js'

const globPrefix = '**/_components/**/*'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isPlaitedComponent = (mod: any): mod is PlaitedTemplate =>
  trueTypeOf(mod) === 'function' && mod?.$ === PLAITED_COMPONENT_IDENTIFIER

export const globComponents = async (dir: string) => {
  const glob = new Bun.Glob(`${globPrefix}.tsx`)
  const componentPaths = await Array.fromAsync(glob.scan({ cwd: dir }))
  componentMap.clear()
  const entries = await Promise.all(
    componentPaths.map(async (path) => {
      try {
        const modules = await import(path)
        for (const name of modules) {
          const mod = modules[name]
          if (!mod || !isPlaitedComponent(mod)) continue
          if (componentMap.has(mod.tag))
            return console.error(
              `Duplicate module found for: ${mod.tag}\n${JSON.stringify(
                {
                  current: path,
                  previous: componentMap.get(mod.tag),
                },
                null,
                2,
              )}`,
            )
          componentMap.set(mod.tag, { path: `/${path.replace(/\.tsx$/, '.js')}`, name })
        }
        return path
      } catch (err) {
        console.error(err)
      }
    }),
  )
  return entries.filter(Boolean)
}

export const globWorkers = async (dir: string) => {
  const glob = new Bun.Glob(`${globPrefix}.worker.ts`)
  return await Array.fromAsync(glob.scan({ cwd: dir }))
}
