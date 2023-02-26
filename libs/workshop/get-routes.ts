import { GetRoutes } from './types.ts'
import { relative } from '../deps.ts'
import { getStoriesData } from './get-stories-data.ts'
import { getStoryHandlers } from './get-story-handlers.ts'
import { setRootRoute } from './set-root-route.ts'
import { setTestsRoutes } from './set-tests-routes.ts'
export const getRoutes: GetRoutes = async ({
  assets,
  clientEntries,
  dev,
  exts,
  includes,
  project,
  runnerEntry,
  storyModules,
}) => {
  const { story } = exts
  const storyExts = Array.isArray(story) ? story : [story]

  const entries = clientEntries.map((entry) => relative(assets, entry)).filter(
    (entry) => !entry.endsWith('.map'),
  )

  /** get sorted and title/name collision free story data */
  const storiesData = await getStoriesData(storyModules)

  /** return story handlers */
  const routes = await getStoryHandlers({
    dev,
    storiesData,
    entries,
    includes,
  })

  setRootRoute({
    dev,
    entries,
    includes,
    project,
    routes,
    storiesData,
  })

  const runner = []
  for (const entry of runnerEntry) {
    if (entry.endsWith('.map')) continue
    runner.push(relative(assets, entry))
  }

  const stories: string[] = []
  const builtStoryExts = storyExts.map((exts) => exts.replace('.ts', '.js'))
  for (const entry of clientEntries) {
    const isStory = builtStoryExts.some((ext) => entry.endsWith(ext))
    if (isStory) {
      stories.push(relative(assets, entry))
    }
  }
  setTestsRoutes({
    dev,
    entries,
    stories,
    includes,
    project,
    routes,
    runner,
  })

  return routes
}
