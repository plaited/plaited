import { esbuild } from '../../deps.ts'

export const writeRegistry = async (
  fixtures: string[],
  assets: string,
) => {
  try {
   await esbuild.build({
      stdin: {
        contents: fixtures.map((fixture: string) => `import './${fixture}'`).join(
          '\n',
        ),
        resolveDir: assets,
        loader: 'ts',
      },
      format: 'esm',
      target: [
        'es2020',
      ],
      outfile: `${assets}/.registry/fixtures.js`,
    })
  } catch(err) {
    console.error(err)
    Deno.exit()
  }
}
