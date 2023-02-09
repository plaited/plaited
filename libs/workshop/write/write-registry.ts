import { bundler } from '../../bundler/mod.ts'
import { resolve } from '../../deps.ts'
import { getStat } from '../get-stat.ts'
const __dirname = new URL('.', import.meta.url).pathname
const chatUI = resolve(__dirname, '../islands/plaited-chat-ui.ts')
const fixture = resolve(__dirname, '../islands/plaited-fixture.ts')

export const writeRegistry = async ({
  islands,
  assets,
  importMap,
}: {
  islands: string[]
  assets: string
  importMap?: URL
}) => {
  const ui = bundler({
    dev: false,
    entryPoints: [chatUI, fixture],
  })
  const build = bundler({
    dev: false,
    entryPoints: islands,
    importMap,
  })
  const defaultContent = await ui()
  const content = await build()
  const outdir = `${assets}/.registries`
  const exist = await getStat(outdir)
  exist && await Deno.remove(outdir, { recursive: true })
  await Deno.mkdir(outdir, { recursive: true })
  const registries: string[] = []
  if (content && Array.isArray(content) && Array.isArray(defaultContent)) {
    await Promise.all(
      [...defaultContent, ...content].map(async (entry) => {
        const registry = `${outdir}${entry[0]}`
        registries.push(registry)
        await Deno.writeFile(registry, entry[1])
      }),
    )
  }
  return registries.filter((entry) => !entry.startsWith(`${outdir}/chunk-`))
}
