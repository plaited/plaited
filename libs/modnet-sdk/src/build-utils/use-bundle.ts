import Bun, { BuildArtifact } from 'bun'
import { Database } from 'bun:sqlite'
import { trueTypeOf } from '@plaited/utils'
import type { PlaitedTemplate } from 'plaited'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isPlaitedComponent = (mod: any): mod is PlaitedTemplate =>
  trueTypeOf(mod) === 'function' && mod?.$ === '🐻'

const isEntry = async ({ db, table, path, cwd }: { db: Database; table: string; path: string; cwd: string }) => {
  try {
    const $path = `/${path}`
    const modules = await import(Bun.resolveSync(`.${$path}`, cwd))
    let hasPlaitedComponentExport = false
    for (const [_, mod] of Object.entries(modules)) {
      if (isPlaitedComponent(mod)) {
        hasPlaitedComponentExport = true
        const $tag = mod.tag
        const query = db.query(`SELECT path FROM ${table} WHERE tag = $tag`)
        const result = query.get({ $tag }) as { path: string }
        if (result?.path) {
          throw new Error(
            `Duplicate tag [${$tag}]\n${JSON.stringify(
              {
                current: path,
                previous: result.path,
              },
              null,
              2,
            )}`,
          )
        } else {
          const query = db.query(`INSERT INTO ${table} (tag, path) VALUES ($tag, $path)`)
          const regex = /\.(ts|tsx|jsx)$/
          query.run({ $tag, $path: regex.test($path) ? $path.replace(regex, '.js') : $path })
        }
      }
    }
    return hasPlaitedComponentExport
  } catch (err) {
    console.error(err)
    return false
  }
}

export const useBundle =
  (db: Database, table: string) =>
  async ({
    cwd,
    sourcemap = false,
    entries = [],
    publicPath = '',
  }: {
    cwd: string
    sourcemap?: boolean
    entries?: string[]
    publicPath?: string
  }): Promise<BuildArtifact[]> => {
    const glob = new Bun.Glob(`**/*.{ts,tsx,js,jsx}`)
    const modulePaths = await Array.fromAsync(glob.scan({ cwd }))
    if (modulePaths.length === 0) {
      console.error('No modules found')
      return []
    }
    const entrypoints: string[] = []
    for (const path of modulePaths) {
      const entry = await isEntry({
        db,
        table,
        path,
        cwd,
      })
      entry && entrypoints.push(Bun.resolveSync(`./${path}`, cwd))
    }
    if (entrypoints.length === 0) return []
    const result = await Bun.build({
      entrypoints: [...entrypoints, ...entries.map((path) => Bun.resolveSync(`./${path}`, cwd))],
      minify: true,
      splitting: true,
      sourcemap: sourcemap ? 'inline' : 'none',
      publicPath,
    })
    return result.outputs
  }
