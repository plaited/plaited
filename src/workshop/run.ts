import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from './build.js'
import { globStories } from './glob.js'
import { mapStories, mapEntries } from './map.js'
import { scanStoryExports, StoriesMap } from './scan.js'

export const getRoutes = async (cwd: string) => {
  const storyFiles = await globStories(cwd)
  // const templateFiles = await globTemplates(cwd)
  // const workerFiles = await globWorkers(cwd)
  const stories: StoriesMap = new Map()
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'workshop-'))
  await Promise.all(storyFiles.map(async (filePath) => await scanStoryExports({ filePath, stories, cwd, tmp })))
  const entries = [...stories.values()].map(({ entryPath }) => entryPath)
  const responseMap: Map<string, Response> = new Map()
  await mapStories({ cwd, stories, tmp, responseMap })

  const storyPaths = [...responseMap.keys()]
  const { outputs, success, logs } = await build({ root: tmp, entries, cwd })
  if (!success) {
    console.error(logs)
    return { storyPaths, responseMap }
  }
  mapEntries(outputs, responseMap)
  console.log('Story paths:', storyPaths)
  await fs.rmdir(tmp, { recursive: true })
  return { storyPaths, responseMap }
}

const dir = path.resolve(process.cwd(), 'src')
const { responseMap, storyPaths } = await getRoutes(dir)
console.log(storyPaths)

Bun.serve({
  port: 6006,
  static: Object.fromEntries(responseMap),
  fetch() {
    return new Response('404!')
  },
})
