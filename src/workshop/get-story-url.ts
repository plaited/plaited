import { posix } from 'node:path'
import { kebabCase } from '../utils'

/**
 * Type for story route generation parameters.
 */
export type GetStoryRouteParams = {
  filePath: string
  exportName: string
}

const STORIES_FILTERS_REGEX = /\.stories.tsx?$/

export const getNormalizedPath = (filePath: string) => {
  // Normalize path separators to forward slashes for consistent cross-platform behavior
  let normalizedPath = filePath.replace(/\\/g, '/')

  // Handle Windows absolute paths (C:/path -> /path)
  if (normalizedPath.match(/^[A-Za-z]:/)) {
    normalizedPath = normalizedPath.replace(/^[A-Za-z]:/, '')
  }
  return normalizedPath
}

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
export const getStoryUrl = ({ filePath, exportName }: GetStoryRouteParams) => {
  const normalizedPath = getNormalizedPath(filePath)
  const dir = posix.dirname(normalizedPath)
  const base = kebabCase(posix.basename(normalizedPath.replace(STORIES_FILTERS_REGEX, '')))
  const storyName = kebabCase(exportName)
  const id = `${base}--${storyName}`
  return `${dir}/${id}`
}
