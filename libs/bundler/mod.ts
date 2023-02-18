import { build, BuildOptions, denoPlugin, stop, toFileUrl } from '../deps.ts'
/**
 * return `null` or and {@link OutputFile} or an array of {@link OutputFile}s
 */
export const bundler = ({
  dev,
  entryPoints,
  importMap,
}: {
  /** When set to true will include sourcemaps and NOT minify output */
  dev: boolean
  /** An array of files that each serve as an input to the bundling algorithm */
  entryPoints: string[]
  /** Specify the URL to an import map to use when resolving import specifiers. The URL must be fetchable with `fetch` */
  importMap?: URL
}) => {
  const minifyOptions: Partial<BuildOptions> = dev
    ? { minifyIdentifiers: false, minifySyntax: true, minifyWhitespace: true }
    : { minify: true }
  const cache = new Map<string, Uint8Array>()
  const bundle = async () => {
    const absWorkingDir = Deno.cwd()
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
      //@ts-ignore: forcing use with newer esbuild
      plugins: [denoPlugin({ importMapURL: importMap })],
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
    stop()
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
