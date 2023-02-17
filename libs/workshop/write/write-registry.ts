import { bundler } from '../../bundler/mod.ts'
import { getStat } from '../get-stat.ts'

export const writeRegistry = async ({
  islands,
  assets,
  importMap,
}: {
  islands: string[]
  assets: string
  importMap?: URL
}) => {
  const build = bundler({
    dev: false,
    entryPoints: islands,
    importMap,
  })
  const content = await build()
  const outdir = `${assets}/.registries`
  const exist = await getStat(outdir)
  exist && await Deno.remove(outdir, { recursive: true })
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
  return registries.filter((entry) => !entry.startsWith(`${outdir}/chunk-`))
    .sort(Intl.Collator().compare)
}
