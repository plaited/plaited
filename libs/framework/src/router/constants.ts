import { ComponentMap } from './types.js'

export const componentMap: ComponentMap = new Map()

/**
 * 
 * @example 
 * const glob = new Bun.Glob(globPatterns.components)
 * const files = Array.fromAsync(glob.scan({ cwd: dir }))
 */
export const globPatterns = {
  layout: '**/[!_]*/layout.tsx',
  module: '**/[!_]*/module.tsx',
  page: '**/[!_]*/page.tsx',
  stories: '**/[!_]*/stories/route.tsx',
  worker: '**/[!_]*/worker/route.@(tsx|ts)',
  api: '**/[!_]*/api/route.@(tsx|ts)',
}