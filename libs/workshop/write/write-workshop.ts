import { bundler } from '../../bundler/mod.ts'
import { resolve } from '../../deps.ts'
import { getStat } from '../get-stat.ts'
const __dirname = new URL('.', import.meta.url).pathname
const ui = resolve(__dirname, '../ui.island.ts')

export const writeWorkshop = async ({
  entryPoints,
  assets,
  importMap,
}: {
  entryPoints: string[]
  assets: string
  importMap?: URL
}) => {
  const buildUI = bundler({
    dev: false,
    entryPoints: [ui],
  })
  const build = bundler({
    dev: false,
    entryPoints,
    importMap,
  })
  const defaultContent = await buildUI()
  const content = await build()
  const outdir = `${assets}/.workshop`
  const exist = await getStat(outdir)
  exist && await Deno.remove(outdir, { recursive: true })
  await Deno.mkdir(outdir, { recursive: true })
  const entries: string[] = []
  if (content && Array.isArray(content) && Array.isArray(defaultContent)) {
    await Promise.all(
      [...defaultContent, ...content].map(async (entry) => {
        const registry = `${outdir}${entry[0]}`
        entries.push(registry)
        await Deno.writeFile(registry, entry[1])
      }),
    )
  }
  return entries.filter((entry) => !entry.startsWith(`${outdir}/chunk-`))
    .sort(Intl.Collator().compare)
}
