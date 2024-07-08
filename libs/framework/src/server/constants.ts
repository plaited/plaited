import { keyMirror } from '@plaited/utils'
import type { ComponentMap } from './types.js'

export const scale = keyMirror('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'rel')

export const componentMap: ComponentMap = new Map()

/**
 *
 * @example
 * const glob = new Bun.Glob(globPatterns.components)
 * const files = Array.fromAsync(glob.scan({ cwd: dir }))
 */
export const globPatterns = {
  module: '**/[!_]*/mod.@(tsx|ts)',
  worker: '**/[!_]*/worker.@(tsx|ts)',
  api: '**/[!_]*/api.@(tsx|ts)',
}
