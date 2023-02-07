import { esbuild } from '../../deps.ts'

export const writeRegistry = async ({
  islands,
  assets,
  root,
}: {
  islands: string[]
  assets: string
  root: string
}) => {
  try {
    await esbuild.build({
      stdin: {
        contents: islands.map((island: string) => `import '${island}'`)
          .join(
            '\n',
          ),
        resolveDir: root,
        loader: 'ts',
      },
      format: 'esm',
      target: [
        'es2020',
      ],
      outfile: `${assets}/.registry/islands.js`,
    })
  } catch (err) {
    console.error(err)
    Deno.exit()
  }
}
