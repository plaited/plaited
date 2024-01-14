import { Glob } from 'bun'

export const bundle = async (__dirname: string, ext = 'module') => {
  const glob = new Glob(`**/*.${ext}.{ts,tsx}`)

  const entrypoints = []
  for await (const file of glob.scan({ cwd: __dirname })) {
    entrypoints.push(import.meta.resolveSync(`${__dirname}/${file}`))
  }

  if (entrypoints.length === 0) return { entries: [], outputs: [], __dirname }

  const result = await Bun.build({
    entrypoints,
    minify: true,
    splitting: true,
  })

  const entries = result.outputs.filter(({ kind }) => kind === 'entry-point')

  return { entries, outputs: result.outputs, __dirname }
}
