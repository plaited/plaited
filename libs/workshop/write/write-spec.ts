import { StoriesData } from '../types.ts'
import { dirname, esbuild } from '../../deps.ts'
import { testFile } from '../templates/mod.ts'

type WriteSpec = (args: {
  port: number
  project?: string
  storyData: StoriesData
  playwright: string
  root: string
  colorScheme?: boolean
}) => Promise<void>
export const writeSpec: WriteSpec = async ({
  colorScheme = true,
  port,
  project,
  root,
  storyData,
  playwright,
}) => {
  const entryPoints = storyData.map(([{ path }]) => path)
  const outdir = `${playwright}/.stories`
  try {
    await esbuild.build({
      entryPoints,
      bundle: true,
      format: 'esm',
      target: [
        'es2020',
      ],
      outdir,
    })
  } catch (err) {
    console.error(err)
    Deno.exit()
  }
  const titles = storyData.map(([{ title }]) => title)
  const dedupe = new Set(titles)
  if (titles.length !== dedupe.size) {
    const dupes = titles.filter((element) => ![...dedupe].includes(element))
      .join(', ')
    console.error(`Rename StoryConfigs: [ ${dupes} ]`)
    Deno.exit()
  }
  await Promise.all(storyData.map(async ([{ title, path }, data]) => {
    const testPath = `${playwright}/${title.toLowerCase()}.spec.ts`
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
