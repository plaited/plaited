import path from 'node:path'
import { build, BuildOptions } from 'esbuild'
export const bundler = async ({
  dev,
  entryPoints,
}: {
  /** When set to true will include sourcemaps and NOT minify output */
  dev: boolean
  /** An array of files that each serve as an input to the bundling algorithm */
  entryPoints: string[]
}): Promise<[string, Uint8Array][]> => {
  const minifyOptions: Partial<BuildOptions> = dev
    ? { minifyIdentifiers: false, minifySyntax: true, minifyWhitespace: true }
    : { minify: true }
  const map = new Map<string, Uint8Array>()
  const bundle = async () => {
    const absWorkingDir = process.cwd()
    const { outputFiles } = await build({
      absWorkingDir,
      allowOverwrite: true,
      bundle: true,
      format: 'esm',
      outdir: '.',
      outfile: '',
      entryPoints,
      metafile: true,
      ...minifyOptions,
      platform: 'neutral',
      sourcemap: dev ? 'linked' : false,
      splitting: true,
      target: [
        'chrome109',
        'firefox109',
        'safari16',
      ],
      treeShaking: true,
      write: false,
    })
    if (outputFiles) {
      for (const file of outputFiles) {
        map.set(
          path.relative(absWorkingDir, file.path),
          file.contents
        )
      }
    }
    stop()
  }
  await bundle()
  return [ ...map ]
}
