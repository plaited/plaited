import { PlaitedTemplate } from 'plaited'
import { trueTypeOf } from '@plaited/utils'
import { PLAITED_COMPONENT_IDENTIFIER } from 'plaited/utils'
import { componentMap } from './constants.js'
import { relative } from 'path'
const globPattern = '**/*.stories.(ts|tsx)'

export const globStories = async (dir: string) => {
  const glob = new Bun.Glob(globPattern)
  const componentPaths = await Array.fromAsync(glob.scan({ cwd: dir }))
  componentMap.clear()
  const entries = await Promise.all(
    componentPaths.map(async (path) => {
      try {
        const {default:meta, ...stories} = await import(path)
        if(meta?.path) {
          const path = relative(dir, meta.path)
          for (const name of stories) {
            const story = stories[name]
            if (!story) continue
            // if (componentMap.has(mod.tag))
            //   return console.error(
            //     `Duplicate module found for: ${mod.tag}\n${JSON.stringify(
            //       {
            //         current: path,
            //         previous: componentMap.get(mod.tag),
            //       },
            //       null,
            //       2,
            //     )}`,
            //   )
            componentMap.set(name, relative(dir, meta.path))
            return  meta.path
          }
        }
        
        return path
      } catch (err) {
        console.error(err)
      }
    }),
  )
  return entries.filter(Boolean) as string[]
}

export const globWorkers = async (dir: string) => {
  const glob = new Bun.Glob(`${globPrefix}.worker.ts`)
  return await Array.fromAsync(glob.scan({ cwd: dir }))
}
