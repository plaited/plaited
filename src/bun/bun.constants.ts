export const IGNORED_DIR_PREFIX = '[!_]'
export const GLOB_PATTERN_WORKER = `**/${IGNORED_DIR_PREFIX}*/worker.@(tsx|ts)`
export const GLOB_PATTERN_ROUTE = `**/${IGNORED_DIR_PREFIX}*/route.@(tsx|ts)`
export const GLOB_PATTERN_STORIES = `**/*.stories.@(tsx|ts)`