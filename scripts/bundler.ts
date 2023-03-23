import { build, stop } from '../libs/dev-deps.ts'

export const bundler = ({
  entryPoints,
  format,
  outfile,
  minify,
}: {
  /** An array of files that each serve as an input to the bundling algorithm */
  entryPoints: string[]
  format: 'esm' | 'cjs'
  outfile: string
  minify: boolean
}) => {
  const bundle = async () => {
    const absWorkingDir = Deno.cwd()
    const { metafile } = await build({
      absWorkingDir,
      allowOverwrite: true,
      bundle: true,
      format,
      outfile,
      entryPoints,
      platform: 'neutral',
      sourcemap: false,
      target: 'es2021',
      metafile: true,
      minify,
      treeShaking: true,
    })
    stop()
    return metafile
  }
  return bundle()
}
