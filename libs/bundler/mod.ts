import { denoPlugin, esbuild, toFileUrl } from '../deps.ts'

export const bundler = ({
  dev,
  entryPoints,
  importMapURL,
}: {
  dev: boolean
  entryPoints: string[]
  importMapURL?: string
}) => {
  const minifyOptions: Partial<esbuild.BuildOptions> = dev
    ? { minifyIdentifiers: false, minifySyntax: true, minifyWhitespace: true }
    : { minify: true }
  const cache = new Map<string, Uint8Array>()
  const bundle = async () => {
    const absWorkingDir = Deno.cwd()
    const { outputFiles } = await esbuild.build({
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
      //@ts-ignore
      plugins: [denoPlugin({ importMapURL })],
      sourcemap: dev ? 'linked' : false,
      splitting: true,
      target: [
        'chrome109',
      ],
      treeShaking: true,
      write: false,
    })
    const absDirUrlLength = toFileUrl(absWorkingDir).href.length
    if (outputFiles) {
      for (const file of outputFiles) {
        cache.set(
          toFileUrl(file.path).href.substring(absDirUrlLength),
          file.contents,
        )
      }
    }
    esbuild.stop()
  }
  return async (
    path?: string,
  ): Promise<Uint8Array | null | [string, Uint8Array][]> => {
    if (!path) {
      await bundle()
      return [...cache]
    }
    if (path && !cache.has(path)) {
      await bundle()
    }
    return cache.get(path) ?? null
  }
}
