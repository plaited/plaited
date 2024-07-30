import { keyMirror } from '@plaited/utils'

export const MODULE_SCALE = keyMirror('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'rel')

export const IGNORED_DIR_PREFIX = '[!_]'
export const TEMPLATES_DIR = '_templates'
export const GLOB_PATTERN_MODULE = `**/${IGNORED_DIR_PREFIX}*/module.@(tsx|ts)`
export const GLOB_PATTERN_WORKER = `**/${IGNORED_DIR_PREFIX}*/worker.@(tsx|ts)`
export const GLOB_PATTERN_SOCKET = `**/${IGNORED_DIR_PREFIX}*/socket.@(tsx|ts)`
export const GLOB_PATTERN_STORIES = `**/{${TEMPLATES_DIR}/**/*.stories,${IGNORED_DIR_PREFIX}*/stories}.@(tsx|ts)`
export const GLOB_PATTERN_COMPONENT = `**/{${TEMPLATES_DIR}/**/*,${IGNORED_DIR_PREFIX}*/module}.@(tsx|ts)`
