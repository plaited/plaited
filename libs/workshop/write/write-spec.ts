import { StoriesData } from '../types.ts'
import { dirname, kebabCase, relative } from '../../deps.ts'
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
  importMap?: URL
}) => Promise<void>
export const writeSpec: WriteSpec = async ({
  colorScheme = true,
  dev,
  entryPoints,
  importMap,
  port,
  project,
  root,
  storiesData,
  playwright,
}) => {
  const build = bundler({ entryPoints, dev, importMap })
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
  await Promise.all(storiesData.map(async ([{ title, path, island }, data]) => {
    console.log(title)
    const tilePath = title.split('/').map((str) => kebabCase(str)).join('/')
    const testPath = `${playwright}/${tilePath}.spec.js`
    await Deno.mkdir(dirname(testPath), { recursive: true })
    const content = testFile({
      colorScheme,
      data,
      port,
      project,
      storiesPath: `${outdir}${path.slice(relative(Deno.cwd(), root).length)}`,
      testPath,
      title,
      island,
    })
    await Deno.writeTextFile(testPath, content)
  }))
}
