import { writeClient } from './write-client.ts'
import { writeSpec } from './write-spec.ts'
import { Write } from './types.ts'
import { walk } from '../deps.ts'
import { getStoriesData } from './get-stories-data.ts'
import { getStoryHandlers } from './get-story-handlers.ts'

export const write: Write = async ({
  assets,
  colorScheme,
  exts,
  port,
  playwright,
  project,
  root,
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
    const entry of walk(root, {
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

  // /** write playwright spec files */
  await writeSpec({
    playwright,
    storiesData,
    project,
    port,
    root,
    colorScheme,
    dev,
    importMap,
    entryPoints: storyModules,
  })

  /** return story handlers */
  return await getStoryHandlers({
    dev,
    assets,
    storiesData,
    entries,
    includes,
  })
}
