export const IGNORED_DIR_PREFIX = '[!_]'
export const TEMPLATES_DIR = '_templates'
export const GLOB_PATTERN_TEMPLATE = `**/${IGNORED_DIR_PREFIX}*/template.@(tsx|ts)`
export const GLOB_PATTERN_WORKER = `**/${IGNORED_DIR_PREFIX}*/worker.@(tsx|ts)`
export const GLOB_PATTERN_ROUTE = `**/${IGNORED_DIR_PREFIX}*/route.@(tsx|ts)`
export const GLOB_PATTERN_STORIES = `**/${TEMPLATES_DIR}/**/*.stories.@(tsx|ts)` // This is probably not going to be needed as we'll just make the route a story
export const GLOB_PATTERN_DUPLICATE_TAGS = `**/${TEMPLATES_DIR}/**/*.@(tsx|ts)` // Also plaited templates go in templates
