import { StoriesData } from '../types.ts'
import { dirname, kebabCase } from '../../deps.ts'
import { bundler } from '../../bundler/mod.ts'
import { testFile } from '../templates/mod.ts'
import { getStat } from '../../deno-utils/mod.ts'
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
  await Promise.all(storiesData.map(async ([{ title, path }, data]) => {
    const tilePath = title.split('/').map((str) => kebabCase(str)).join('/')
    const testPath = `${playwright}/${tilePath}.spec.js`
    const exist = await getStat(testPath)
    if (exist) return
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
