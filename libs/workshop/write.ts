import { writeRegistry, writeSpec } from './write/mod.ts'
import { Write } from './types.ts'
import { walk } from './../deps.ts'
import { getStoriesData } from './get-stories-data.ts'
import { getStoryHandlers } from './get-story-handlers.ts'

export const write: Write = async ({
  assets,
  colorScheme,
  exts,
  port,
  project,
  root,
  playwright,
  dev,
  importMapURL,
  page,
}) => {
  const { island, story } = exts
  const islandExts = Array.isArray(island) ? island : [island]
  const storyExts = Array.isArray(story) ? story : [story]
  const combinedExts = [...islandExts, ...storyExts]

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

  const islands = entriesPoints.filter((entry) =>
    islandExts.some((ext) => entry.endsWith(ext))
  )
  const stories = entriesPoints.filter((entry) =>
    storyExts.some((ext) => entry.endsWith(ext))
  )

  /** write test fixture */
  /** write registry file*/
  const registries = await writeRegistry({ islands, assets })

  /** get paths and name for each set of stories */
  const storiesData = await getStoriesData(stories)

  const titles = storiesData.map(([{ title }]) => title)
  const normalizedTitles = storiesData.map(([{ title }]) => title.toLowerCase())
  const dedupe = new Set(normalizedTitles)
  if (normalizedTitles.length !== dedupe.size) {
    const dupes = titles.filter((element) => ![...dedupe].includes(element))
      .join(', ')
    console.error(`Rename StoryConfigs: [ ${dupes} ]`)
  }

  // /** write spec files */
  await writeSpec({
    playwright,
    storiesData,
    project,
    port,
    root,
    colorScheme,
    dev,
    importMapURL,
    entryPoints: stories,
  })

  /** return story handlers */
  return await getStoryHandlers({
    assets,
    storiesData,
    registries: [...registries],
    page,
  })
}
