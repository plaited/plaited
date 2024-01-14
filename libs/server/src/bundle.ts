import Bun from 'bun'
import { Bundles } from './types.js'

export const bundle = async (__dirname: string, ext = 'module', sourcemap = false): Promise<Bundles> => {
  const glob = new Bun.Glob(`**/*.${ext}.{ts,tsx,js,jsx}`)

  const entrypoints = []
  for await (const file of glob.scan({ cwd: __dirname })) {
    entrypoints.push(Bun.resolveSync(`./${file}`, __dirname))
  }

  if (entrypoints.length === 0) return { outputs: [], __dirname }

  const result = await Bun.build({
    entrypoints,
    minify: true,
    splitting: true,
    sourcemap: sourcemap ? 'inline' : 'none',
  })

  return {
    outputs: [
      ...result.outputs,
      ...result.outputs.flatMap((output) =>
        output.kind === 'entry-point' ? { path: output.path, loader: output.loader } : [],
      ),
    ],
    __dirname,
  }
}
