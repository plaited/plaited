import { bundler } from '../bundler/mod.ts'
import { resolve } from '../deps.ts'
import { getStat } from './get-stat.ts'
import { writeDirectory } from './constants.ts'
const __dirname = new URL('.', import.meta.url).pathname
const ui = resolve(__dirname, './fixture.island.ts')

export const writeClient = async ({
  entryPoints,
  assets,
  importMap,
  workerExts,
  dev,
}: {
  entryPoints: string[]
  assets: string
  importMap?: URL
  workerExts: string[]
  dev: boolean
}) => {
  const defaultContent = await bundler({
    dev,
    entryPoints: [ui],
  })
  const content = await bundler({
    dev,
    entryPoints,
    importMap,
  })
  const outdir = `${assets}/${writeDirectory}`
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
  return entries.filter((entry) => {
    const ext = entry.split('.').pop()
    return !entry.startsWith(`${outdir}/chunk-`) &&
      !workerExts.some((worker) => {
        const workerArray = worker.split('.')
        workerArray.pop()
        return entry.endsWith([...workerArray, ext].join('.'))
      })
  }).sort(Intl.Collator().compare)
}
