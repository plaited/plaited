import type { BunPlugin } from 'bun'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { CompilationOptions, EntryPointConfig, generateDtsBundle } from 'dts-bundle-generator'
import { getTsconfig } from 'get-tsconfig'

type Options = Omit<EntryPointConfig, 'filePath'> & {
  compilationOptions?: CompilationOptions
}

export const dts = (options?: Options): BunPlugin => {
  return {
    name: 'bun-plugin-dts',
    async setup(build) {
      const { compilationOptions, ...rest } = options || {}

      const entrypoints = [...build.config.entrypoints].sort()
      const entries = entrypoints.map((entry) => {
        return {
          filePath: entry,
          ...rest,
        }
      })

      const tsconfig = compilationOptions?.preferredConfigPath ?? getTsconfig()?.path
      const result = generateDtsBundle(entries, {
        ...compilationOptions,
        preferredConfigPath: tsconfig,
      })

      const outDir = build.config.outdir
      if (!outDir) return
      await mkdir(outDir, { recursive: true })

      await Promise.all(
        entrypoints.map((entry, index) => {
          const dtsFile = entry.replace(/^.*\//, '').replace(/\.[jtm]s$/, '.d.ts')
          const outFile = path.join(outDir, dtsFile)
          return Bun.write(outFile, result[index])
        }),
      )
    },
  }
}

/**
 * (c) Evgeniy Timokhov - MIT
 * {@see https://github.com/timocov/dts-bundle-generator}
 */
