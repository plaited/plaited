import { StoriesData } from '../types.ts'
import { dirname, kebabCase } from '../../deps.ts'
import { bundler } from '../../bundler/mod.ts'
import { testFile } from '../templates/mod.ts'

type WriteSpec = (args: {
  port: number
  project?: string
  storiesData: StoriesData
  playwright: string
  root: string
  colorScheme?: boolean
  dev: boolean
  entryPoints: string[]
  importMapURL?: string | undefined
}) => Promise<void>
export const writeSpec: WriteSpec = async ({
  colorScheme = true,
  dev,
  entryPoints,
  importMapURL,
  port,
  project,
  root,
  storiesData,
  playwright,
}) => {
  const build = bundler({ entryPoints, dev, importMapURL })
  const content = await build()
  const outdir = `${playwright}/.stories`
  await Deno.mkdir(outdir, { recursive: true })
  if (content && Array.isArray(content)) {
    await Promise.all(
      content.map(async (entry) =>
        await Deno.writeFile(`${outdir}${entry[0]}`, entry[1])
      ),
    )
  }
  const titles = storiesData.map(([{ title }]) => title)
  const normalizedTitles = storiesData.map(([{ title }]) => title.toLowerCase())
  const dedupe = new Set(normalizedTitles)
  if (normalizedTitles.length !== dedupe.size) {
    const dupes = titles.filter((element) => ![...dedupe].includes(element))
      .join(', ')
    console.error(`Rename StoryConfigs: [ ${dupes} ]`)
    Deno.exit()
  }
  const fmtError = titles.find((str) => !/^[a-zA-Z][a-zA-Z\/0-9]*$/.test(str))
  if (fmtError) {
    console.error(
      `Rename stories title "${fmtError}", title must contain can only contain letters "a-z", "A-Z" and "\"`,
    )
    Deno.exit()
  }
  await Promise.all(storiesData.map(async ([{ title, path }, data]) => {
    const tilePath = title.split('/').map((str) => kebabCase(str)).join('/')
    const testPath = `${playwright}/${tilePath}.spec.ts`
    await Deno.mkdir(dirname(testPath), { recursive: true })
    const content = testFile({
      colorScheme,
      data,
      port,
      project,
      storiesPath: `${outdir}${path.slice(root.length)}`,
      testPath,
      title,
    })
    await Deno.writeTextFile(testPath, content)
  }))
}
