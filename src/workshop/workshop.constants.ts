export const USE_PLAY_ROUTE = '/workshop/use-play.js'
export const USE_PLAY_FILE_PATH = Bun.resolveSync('./use-play.tsx', import.meta.dir)

export const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`
export const STORIES_FILTERS_REGEX = /\.stories.tsx?$/

export const TEMPLATE_FILTER_REGEX = /^((?!\/_).)*\/template\.tsx?$/
export const TEMPLATE_GLOB_PATTERN = `**/template.{tsx,ts}`
export const TEMPLATE_ENTRY_NAME = 'template'
export const TEMPLATE_DIRECTORY = '_templates'

export const WORKER_FILTER_REGEX = /^((?!\/_).)*\/worker\.ts$/
export const WORKER_GLOB_PATTERN = `**/worker.ts`
