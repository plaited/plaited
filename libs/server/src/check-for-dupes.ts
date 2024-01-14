import Bun from 'bun'
import { isPlaitedComponent } from './type-guards.js'

const registry = new Map<string, string>()

export const checkRegistry = async (path: string, __dirname: string) => {
  try {
    const modules = await import(Bun.resolveSync(path, __dirname))
    for (const [_, mod] of Object.entries(modules)) {
      if (isPlaitedComponent(mod)) {
        const tag = mod.tag
        if (registry.has(tag)) {
          throw new Error(
            `Duplicate tag [${tag}]\n${JSON.stringify(
              {
                current: path,
                previous: registry.get(tag),
              },
              null,
              2,
            )}`,
          )
        } else {
          registry.set(tag, path)
        }
      }
    }
  } catch (err) {
    console.error(err)
  }
}

export const checkForDupes = async (__dirname: string) => {
  const glob = new Bun.Glob(`**/*.{ts,tsx,js,jsx}`)
  const modulePaths = await Array.fromAsync(glob.scan({ cwd: __dirname }))
  if (modulePaths.length === 0) return console.error('No modules found')
  for (const path of modulePaths) {
    await checkRegistry(path, __dirname)
  }
}
