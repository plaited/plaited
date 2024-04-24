export const bundle = async ({
  entrypoints,
  dir,
  sourcemap = false,
  publicPath = '',
}: {
  sourcemap?: boolean
  entrypoints: string[]
  dir: string
  publicPath?: string
}) => {
  const result = await Bun.build({
    entrypoints: [`${import.meta.dir}/hda.ts`, ...entrypoints],
    minify: true,
    publicPath,
    root: dir,
    sourcemap: sourcemap ? 'inline' : 'none',
    splitting: true,
  })
  return result.outputs
}
