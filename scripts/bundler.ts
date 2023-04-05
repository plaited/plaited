import { build, stop } from '../libs/dev-deps.ts'

export const bundler = ({
  entryPoints,
  outdir,
  minify,
  entryNames,
}: {
  /** An array of files that each serve as an input to the bundling algorithm */
  entryPoints: string[]
  outdir: string
  minify: boolean
  entryNames?: string
}) => {
  const bundle = async () => {
    const absWorkingDir = Deno.cwd()
    const { metafile } = await build({
      absWorkingDir,
      allowOverwrite: true,
      bundle: true,
      format: 'esm',
      outdir,
      entryPoints,
      platform: 'neutral',
      sourcemap: false,
      target: [
        'chrome109',
        'firefox109',
        'safari16',
      ],
      metafile: true,
      minify,
      treeShaking: true,
      entryNames,
    })
    stop()
    return metafile
  }
  return bundle()
}
