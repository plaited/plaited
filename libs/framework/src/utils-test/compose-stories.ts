import { StoriesExport, Parameters, ComposeStories } from './types.js'
import { toId } from './to-id.js'
import { STORYBOOK_PATH_ROOT, STORY_PARAMETERS } from './constants.js'

const getStoryPaths = (stories: Record<string, StoriesExport>, root: string = STORYBOOK_PATH_ROOT) => {
  const { default: meta, ...storyObjs } = stories
  const arr: [string, Parameters][] = []
  const defaultParameters = { ...STORY_PARAMETERS, ...meta?.parameters }
  for (const name in storyObjs) {
    const title = 'title' in meta && meta.title
    const id = title ? toId(title, name) : toId(name)
    const parameters = {
      ...defaultParameters,
      ...storyObjs[name]?.parameters,
    }
    arr.push([`${root}/${id}`, parameters])
  }
  return arr
}

export const composeStories: ComposeStories = (stories) => getStoryPaths(stories)

composeStories.extend = (root: string) => (stories: Record<string, StoriesExport>) => getStoryPaths(stories, root)
