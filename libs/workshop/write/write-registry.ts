import { bundler } from '../../bundler/mod.ts'

export const writeRegistry = async ({
  islands,
  assets,
}: {
  islands: string[]
  assets: string
}) => {
  const build = bundler({
    dev: false,
    entryPoints: islands,
  })
  const content = await build()
  const outdir = `${assets}/.registries`
  await Deno.mkdir(outdir, { recursive: true })
  const registries: string[] = []
  if (content && Array.isArray(content)) {
    await Promise.all(
      content.map(async (entry) => {
        const registry = `${outdir}${entry[0]}`
        registries.push(registry)
        await Deno.writeFile(registry, entry[1])
      }),
    )
  }
  return registries
}
