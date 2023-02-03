import { writeRegistry } from './write-registry.ts'
import { Write } from '../types.ts'
import { walk } from '../../deps.ts'
import { getStories } from '../get-stories.ts'
import { writeSpec } from './write-spec.ts'

export const write: Write = async ({
  assets,
  colorScheme,
  exts,
  port,
  project,
  root,
  storyHandlers,
  playwright,
}) => {
  const { fixture, story } = exts

  /** get paths and name for each fixture */
  const fixtures: string[] = []
  for await (
    const entry of walk(root, {
      exts: Array.isArray(fixture) ? fixture : [fixture],
    })
  ) {
    const { path } = entry
    fixtures.push(path)
  }
  /** write registry file*/
  await writeRegistry(fixtures, assets)

  /** get paths and name for each set of stories */
  const stories: string[] = []
  for await (
    const entry of walk(root, {
      exts: Array.isArray(story) ? story : [story],
    })
  ) {
    const { path } = entry
    stories.push(path)
  }
  const storyData = await getStories(stories)

  /** write spec files */
  await writeSpec({ playwright, storyData, project, port, root, colorScheme })

  /** return story handlers */
  return await storyHandlers(storyData)
}
