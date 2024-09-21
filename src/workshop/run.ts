import path from "path"
import { build } from "./build.js"
import { globStories, globTemplates, globWorkers } from "./glob.js"
import { mapStories } from "./map.js"
import { scanStoryExports } from "./scan.js"

export const run = async (dir: string) => {
  const storyFiles = await globStories(dir)
  const templateFiles = await globTemplates(dir)
  const workerFiles = await globWorkers(dir)
  const storyExports = await Promise.all(
    storyFiles.map(async (filePath) => await scanStoryExports(dir, filePath))
  )
  const stories = new Map(storyExports.flat())
  console.log(stories)

  const { responseMap, virtualEntries } = await mapStories(dir, stories) 
  // const storyPaths = [...responseMap.keys()]
  // const {outputFiles, ...result} = await build({
  //   absWorkingDir: dir,
  //   entries: [...workerFiles, ...templateFiles],
  //   virtualEntries
  // })
  // console.log(outputFiles)
}

const dir = path.resolve(process.cwd(), 'src')
console.log(dir)