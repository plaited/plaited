export const PLAY_EVENT = 'play'
export const PLAITED_TEXT_FIXTURE = 'plaited-test-fixture' as const
export const USE_PLAY_ROUTE = '/use-play.js'
export const USE_PLAY_FILE_PATH = Bun.resolveSync('./use-play.tsx', import.meta.dir)

export const STORY_GLOB_PATTERN = `**/{stories,*.stories}.{tsx,ts}`
export const STORIES_FILTERS_REGEX = /\.stories.tsx?$/
export const STORY_EXTENSION = '.story'
export const STORY_FILTER_REGEX = /\.story$/
export const STORY_NAMESPACE = 'story'

export const SERVER_TEMPLATE_NAMESPACE = 'server-template'
export const TEMPLATE_FILTER_REGEX = /^((?!\/_).)*\/template\.tsx?$/
export const TEMPLATE_BUILD_FILTER_REGEX = /\/template\.tsx$/
export const TEMPLATE_GLOB_PATTERN = `**/template.tsx`
export const TEMPLATE_EXTENSION = '.template'
export const TEMPLATE_DIRECTORY = '_templates'

export const WORKER_FILTER_REGEX = /^((?!\/_).)*\/worker\.ts$/
export const WORKER_GLOB_PATTERN = `**/worker.ts`
