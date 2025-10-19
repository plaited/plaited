import path from 'node:path'
import { Glob } from 'bun'
import { STORY_GLOB_PATTERN } from './test-stories.constants.js'

/**
 * @internal
 * Validates that a directory path is within the project root.
 * Prevents directory traversal attacks by ensuring the provided path is a child of cwd.
 *
 * @param cwd - The project root directory
 * @param dir - Optional directory path to validate
 * @returns The validated directory path or cwd if dir is not provided
 * @throws Error if directory is outside the project root
 */
export const validateChildPath = (cwd: string, dir?: string) => {
  if (!dir) return cwd
  if (cwd === dir) return cwd
  if (dir.startsWith(cwd + path.sep)) return dir
  throw Error(`Directory "${dir}" must be within the project root`)
}

/**
 * @internal
 * Discovers files matching a glob pattern within a directory.
 * Uses Bun's Glob API for efficient file discovery.
 *
 * @param cwd - The directory to search in
 * @param pattern - Glob pattern to match files against
 * @returns Array of absolute file paths matching the pattern
 *
 * @example
 * ```ts
 * const files = await globFiles('/project/root', '**\/*.tsx');
 * // Returns: ['/project/root/Button.tsx', '/project/root/components/Card.tsx']
 * ```
 */
export const globFiles = async (cwd: string, pattern: string): Promise<string[]> => {
  const glob = new Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

/**
 * Retrieves Plaited story set files (*.stories.tsx) from the specified directory or entire codebase.
 *
 * @param cwd - The current working directory (project root)
 * @param dir - Optional absolute path to a directory that must be within the project root
 * @returns Array of absolute file paths to all story set files found
 * @throws Error if directory is outside project root or no story files found
 *
 * @example Basic usage
 * ```ts
 * const stories = await getStorySetPaths('/project/root');
 * // Returns: ['/project/root/Button.stories.tsx', '/project/root/components/Card.stories.tsx']
 * ```
 *
 * @example Filter by subdirectory
 * ```ts
 * const stories = await getStorySetPaths('/project/root', '/project/root/components');
 * // Returns: ['/project/root/components/Card.stories.tsx']
 * ```
 */
export const getStorySetPaths = async (cwd: string, dir?: string): Promise<string[]> => {
  const searchPath = validateChildPath(cwd, dir)
  const files = await globFiles(searchPath, STORY_GLOB_PATTERN)

  if (files.length === 0) {
    const errorMessage =
      dir ?
        `No story files (*.stories.tsx) found in directory '${dir}'`
      : 'No story files (*.stories.tsx) found in the project'
    throw new Error(errorMessage)
  }

  return files
}

/**
 * Retrieves TypeScript JSX template files (*.tsx) from the specified directory or entire codebase,
 * excluding story files (*.stories.tsx).
 *
 * @param cwd - The current working directory (project root)
 * @param dir - Optional absolute path to a directory that must be within the project root
 * @returns Array of absolute file paths to all template files found
 * @throws Error if directory is outside project root or no template files found
 *
 * @example Basic usage
 * ```ts
 * const templates = await getTemplatePaths('/project/root');
 * // Returns: ['/project/root/Button.tsx', '/project/root/components/Card.tsx']
 * ```
 *
 * @example Filter by subdirectory
 * ```ts
 * const templates = await getTemplatePaths('/project/root', '/project/root/components');
 * // Returns: ['/project/root/components/Card.tsx']
 * ```
 */
export const getTemplatePaths = async (cwd: string, dir?: string): Promise<string[]> => {
  const searchPath = validateChildPath(cwd, dir)
  const files = await globFiles(searchPath, '**/*.tsx')
  const filteredFiles = files.filter((file) => !file.includes('.stories.'))

  if (filteredFiles.length === 0) {
    const errorMessage =
      dir ?
        `No template files (*.tsx) found in directory '${dir}' (excluding *.stories.tsx)`
      : 'No template files (*.tsx) found in the project (excluding *.stories.tsx)'
    throw new Error(errorMessage)
  }

  return filteredFiles
}
