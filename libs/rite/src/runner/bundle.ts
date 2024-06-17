export const bundle = async ({
  entrypoint,
  publicPath = '',
}: {
  sourcemap?: boolean
  entrypoint: string
  dir: string
  publicPath?: string
}) => {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    minify: true,
    publicPath,
    sourcemap: 'inline',
  })
  return result.outputs[0]
}
