import { writeSpec, writeWorkshop } from './write/mod.ts'
import { Write } from './types.ts'
import { walk } from './../deps.ts'
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
  const { island, story, workers } = exts
  const workerExts = workers && Array.isArray(workers)
    ? workers
    : workers
    ? [workers]
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

  const entryPoints = entriesPoints.filter((entry) =>
    [...islandExts, ...storyExts].some((ext) => entry.endsWith(ext))
  )
  const stories = entriesPoints.filter((entry) =>
    storyExts.some((ext) => entry.endsWith(ext))
  )

  /** write workshop file*/
  const entries = await writeWorkshop({
    entryPoints,
    assets,
    importMap,
  })

  /** get paths and name for each set of stories */
  const storiesData = await getStoriesData(stories)

  // /** write spec files */
  await writeSpec({
    playwright,
    storiesData,
    project,
    port,
    root,
    colorScheme,
    dev,
    importMap,
    entryPoints: stories,
  })

  /** return story handlers */
  return await getStoryHandlers({
    dev,
    assets,
    storiesData,
    entries: [...entries],
    includes,
  })
}
