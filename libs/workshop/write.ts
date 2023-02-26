import { writeClient } from './write-client.ts'
import { Write } from './types.ts'
import { relative, walk } from '../deps.ts'
import { getStoriesData } from './get-stories-data.ts'
import { getStoryHandlers } from './get-story-handlers.ts'
import { getWebSocket } from './get-web-socket.ts'
import { storiesRoutePath, testsRoutePath } from './constants.ts'
export const write: Write = async ({
  assets,
  exts,
  project,
  workspace,
  dev,
  importMap,
  includes,
}) => {
  const { island, story, worker } = exts
  const workerExts = worker && Array.isArray(worker)
    ? worker
    : worker
    ? [worker]
    : []
  const islandExts = Array.isArray(island) ? island : [island]
  const storyExts = Array.isArray(story) ? story : [story]
  const combinedExts = [...islandExts, ...storyExts, ...workerExts]

  /** get paths and name for each island */
  const entriesPoints: string[] = []
  for await (
    const entry of walk(workspace, {
      exts: combinedExts,
    })
  ) {
    const { path } = entry
    entriesPoints.push(path)
  }

  const clientModules = entriesPoints.filter((entry) =>
    [...islandExts, ...workerExts].some((ext) => entry.endsWith(ext))
  )

  /** write client side code*/
  const entries = await writeClient({
    entryPoints: clientModules,
    assets,
    importMap,
    workerExts,
  })

  const storyModules = entriesPoints.filter((entry) =>
    storyExts.some((ext) => entry.endsWith(ext))
  )

  /** get sorted and title/name collision free story data */
  const storiesData = await getStoriesData(storyModules)

  /** return story handlers */
  const routes = await getStoryHandlers({
    dev,
    assets,
    storiesData,
    entries,
    includes,
    project,
  })
  routes.set(
    storiesRoutePath,
    () =>
      new Response(
        JSON.stringify(entries.map((path) => `/${relative(assets, path)}`)),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
  )
  routes.set(testsRoutePath, getWebSocket)

  return routes
}
