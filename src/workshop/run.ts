import path from "path"
import { build } from "./build.js"
import { globStories, globTemplates, globWorkers } from "./glob.js"
import { mapStories } from "./map.js"
import { scanStoryExports, StoriesMap } from "./scan.js"

export const run = async (cwd: string) => {
  const storyFiles = await globStories(cwd)
  const templateFiles = await globTemplates(cwd)
  const workerFiles = await globWorkers(cwd)
  const stories: StoriesMap = new Map()
  await Promise.all(
    storyFiles.map(async (filePath) => await scanStoryExports({ filePath: `./${filePath}`, stories, cwd }))
  )
await mapStories(cwd, stories) 

  // const storyPaths = [...responseMap.keys()]
  // const {outputFiles, ...result} = await build({
  //   absWorkingDir: dir,
  //   entries: [...workerFiles, ...templateFiles],
  //   virtualEntries
  // })
  // console.log(outputFiles)
}

const dir = path.resolve(process.cwd(), 'src')
run(dir)