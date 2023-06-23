import path from 'node:path'
import { build, BuildOptions } from 'esbuild'
export const bundler = async ({
  srcDir,
  entryPoints,
  reload,
}:{
  /** Absolute path to working directory */
  srcDir: string,
  /** An array of files that each serve as an input to the bundling algorithm */
  entryPoints: string[],
  /** When set to true will include sourcemaps and NOT minify output */
  reload: boolean
}): Promise<Map<string, Uint8Array>> => {
  const minifyOptions: Partial<BuildOptions> = reload
    ? { minifyIdentifiers: false, minifySyntax: true, minifyWhitespace: true }
    : { minify: true }
  const map = new Map<string, Uint8Array>()
  const { outputFiles } = await build({
    absWorkingDir: srcDir,
    allowOverwrite: true,
    bundle: true,
    format: 'esm',
    outdir: '.',
    outfile: '',
    entryPoints,
    metafile: true,
    ...minifyOptions,
    platform: 'neutral',
    sourcemap: reload ? 'inline' : false,
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
        path.relative(srcDir, file.path),
        file.contents
      )
    }
  }
  return map
}
