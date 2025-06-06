import path from 'node:path'
import { STORIES_FILTERS_REGEX } from 'plaited/testing'

import { kebabCase } from 'plaited/utils'

/**
 * Creates a standardized route path for story files in the workshop system.
 * Converts file paths and export names to kebab-case for consistent URL structure.
 *
 * @param options - Configuration object
 * @param options.relativePath - The relative file path of the story
 * @param options.exportName - The exported story name
 * @returns A formatted route path string in the format "{directory}/{basename}--{storyName}"
 *
 * @example
 * ```ts
 * // For a file "/src/components/Button.stories.tsx" with export "PrimaryButton"
 * createStoryRoute({
 *   filePath: "/src/components/Button.stories.tsx",
 *   exportName: "PrimaryButton"
 * });
 * // Returns: "/src/components/button--primary-button"
 * ```
 */
export const createStoryRoute = ({ filePath, exportName }: { filePath: string; exportName: string }) => {
  const dirname = path.dirname(filePath)
  const basename = kebabCase(path.basename(filePath.replace(STORIES_FILTERS_REGEX, '')))
  const storyName = kebabCase(exportName)
  const id = `${basename}--${storyName}`
  return `${dirname}/${id}`
}
