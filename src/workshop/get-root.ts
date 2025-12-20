import { dirname, resolve } from 'node:path'

/**
 * @internal
 * Determines the common root directory for a set of file paths.
 * If no paths provided, returns current working directory.
 * For file paths, extracts their containing directories.
 * Returns the deepest common ancestor directory.
 *
 * @param paths - Array of file or directory paths (relative or absolute)
 * @returns The common root directory path
 *
 * @remarks
 * - Empty paths array returns process.cwd()
 * - Single directory optimization for performance
 * - File detection based on presence of extension (contains '.')
 * - Returns '/' as fallback if no common ancestor found
 */
export const getRoot = (paths: string[]): string => {
  if (paths.length === 0) {
    return process.cwd()
  }

  // Resolve all paths to absolute and get their directories
  const absolutePaths = paths.map((p) => {
    const abs = resolve(process.cwd(), p)
    // If path has an extension, it's likely a file - get its directory
    return abs.includes('.') ? dirname(abs) : abs
  })

  // Get unique directories
  const uniqueDirs = [...new Set(absolutePaths)]

  // If all paths are in the same directory, use that
  if (uniqueDirs.length === 1) {
    return uniqueDirs[0] || '/'
  }

  // Find common ancestor directory
  const parts = uniqueDirs.map((dir) => dir.split('/'))
  const commonParts: string[] = []
  const minLength = Math.min(...parts.map((p) => p.length))
  const firstPath = parts[0]

  if (firstPath) {
    for (let i = 0; i < minLength; i++) {
      const part = firstPath[i]
      if (part !== undefined && parts.every((p) => p[i] === part)) {
        commonParts.push(part)
      } else {
        break
      }
    }
  }

  return commonParts.join('/') || '/'
}
