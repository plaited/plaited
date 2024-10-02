import { build } from './build.js'
import { globStories, globWorkers } from './glob.js'
import { mapStoryResponses, mapEntryResponses } from './map.js'
import { USE_PLAY_FILE_PATH } from './workshop.constants.js'

export const getStories = async (cwd: string) => {
  const workerEntries = await globWorkers(cwd)
  const storyEntries = await globStories(cwd)
  const responseMap: Map<string, Response> = new Map()
  const getResponses = () => {
    const toRet: Record<string, Response> = {}
    for (const [path, response] of responseMap) {
      toRet[path] = response.clone()
    }
    return toRet
  }
  const stories = await mapStoryResponses({ storyEntries, responseMap, cwd })
  const entries = [...storyEntries, ...workerEntries, USE_PLAY_FILE_PATH]
  const { outputs, success, logs } = await build(cwd, entries)
  if (!success) {
    console.error(logs)
    return { stories, getResponses }
  }
  await mapEntryResponses({ outputs, responseMap })

  return { stories, getResponses }
}
