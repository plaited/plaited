import path from 'node:path'
import { build, BuildOptions, context, PluginBuild, BuildResult } from 'esbuild'
import fg from 'fast-glob'
import { SetRoutes } from './types.js'

const updateRoutes = (
  setRoutes: SetRoutes, 
  absWorkingDir: string
) => {
  return {
    name: 'update-routes',
    setup(b: PluginBuild) {
      b.onEnd(({ outputFiles }: BuildResult) => {
        const map = new Map<string, Uint8Array>()
        if (outputFiles) {
          for (const file of outputFiles) {
            map.set(
              path.relative(absWorkingDir, file.path),
              file.contents
            )
          }
        }
        setRoutes(map)
      })
    },
  }
}

const config: Partial<BuildOptions> = {
  allowOverwrite: true,
  bundle: true,
  format: 'esm',
  outdir: '.',
  outfile: '',
  metafile: true,
  platform: 'neutral',
  sourcemap: 'inline',
  splitting: true,
  target: [
    'chrome109',
    'firefox109',
    'safari16',
  ],
  treeShaking: true,
  write: false,
}

const bundle = async ({ 
  entryPoints,
  absWorkingDir,
  setRoutes }:{
    entryPoints: string[], 
    absWorkingDir: string, 
    setRoutes: SetRoutes
  }): Promise<undefined> => {
  await build({
    ...config,
    absWorkingDir,
    entryPoints,
    minify: true,
    plugins:[ updateRoutes(setRoutes, absWorkingDir) ],
  })
}

const watch = async ({ 
  entryPoints,
  absWorkingDir,
  setRoutes }:{
    entryPoints: string[], 
    absWorkingDir: string, 
    setRoutes: SetRoutes
  }): Promise<undefined> => {
  const ctx = await context({
    ...config,
    absWorkingDir,
    entryPoints,
    minifyIdentifiers: false,
    minifySyntax: true,
    minifyWhitespace: true,
    plugins:[ updateRoutes(setRoutes, absWorkingDir) ],
  })
  await ctx.rebuild()
  // eslint-disable-next-line no-console
  console.log('watching...')
}

export const bundler = async ({
  ext,
  root,
  dev = true,
  setRoutes,
}:{
  /** stories extension can use  */
  ext: string
  root: string
  /** When set to true will include sourcemaps and NOT minify output */
  dev?: boolean
  setRoutes: SetRoutes
}): Promise<undefined> => {
  const absWorkingDir = path.resolve(process.cwd(), root)
  const entryPoints = await fg(
    path.resolve(absWorkingDir, `**/*${ext.startsWith('.') ? ext : `.${ext}`}`)
  )
  return dev 
    ? await watch({ entryPoints, absWorkingDir, setRoutes }) 
    : await bundle({ entryPoints, absWorkingDir, setRoutes })
}
