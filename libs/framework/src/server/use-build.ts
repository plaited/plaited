export const useBuild = async ({
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
    entrypoints,
    minify: true,
    publicPath,
    root: dir,
    sourcemap: sourcemap ? 'inline' : 'none',
    splitting: true,
  })
  return result.outputs
}
