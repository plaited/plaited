import { globStories, globWorkers } from './glob.ts'
import { mapStoryResponses, mapEntryResponses } from './map.tsx'
import { USE_PLAY_FILE_PATH } from './workshop.constants.ts'

export const getStories = async (cwd: string, websocketUrl: `/${string}`) => {
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
  const stories = await mapStoryResponses({ storyEntries, responseMap, cwd, websocketUrl })
  const entrypoints = [...storyEntries, ...workerEntries, USE_PLAY_FILE_PATH]
  const { outputs, success, logs } = await Bun.build({
    root: cwd,
    entrypoints,
    sourcemap: 'inline',
    splitting: true,
    publicPath: '/',
  })
  if (!success) {
    console.error(logs)
    return { stories, getResponses }
  }
  await mapEntryResponses({ outputs, responseMap })

  return { stories, getResponses }
}
