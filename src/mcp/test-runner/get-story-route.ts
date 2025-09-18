import { posix } from 'node:path'

import { kebabCase } from '../../utils'
import { getNormalizedPath } from './get-normalized-path.js'
import type { GetStoryRouteParams } from './test-runner.schemas.js'

const STORIES_FILTERS_REGEX = /\.stories.tsx?$/
/**
 * Creates kebab-case route for story URLs.
 *
 * @param options - Route configuration
 * @param options.filePath - Story file path
 * @param options.exportName - Exported story name
 * @returns Route like "/components/button--primary"
 *
 * @example
 * ```ts
 * createStoryRoute({
 *   filePath: "/src/Button.stories.tsx",
 *   exportName: "Primary"
 * }); // "/src/button--primary"
 * ```
 */
export const getStoryRoute = ({ filePath, exportName }: GetStoryRouteParams) => {
  const normalizedPath = getNormalizedPath(filePath)
  const dir = posix.dirname(normalizedPath)
  const base = kebabCase(posix.basename(normalizedPath.replace(STORIES_FILTERS_REGEX, '')))
  const storyName = kebabCase(exportName)
  const id = `${base}--${storyName}`
  return `${dir}/${id}`
}
