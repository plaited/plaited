/**
 * Shared utilities for skill discovery and validation.
 *
 * @remarks
 * Extracts YAML frontmatter from SKILL.md files using `Bun.YAML.parse()`
 * and provides directory helpers for scanning skill directories.
 *
 * @public
 */

import { join } from 'node:path'
import { $, Glob, YAML } from 'bun'

// ============================================================================
// Types
// ============================================================================

/**
 * Properties extracted from SKILL.md frontmatter and body.
 *
 * @public
 */
export type SkillProperties = {
  name: string
  description: string
  license?: string
  compatibility?: string
  'allowed-tools'?: string[]
  metadata?: Record<string, string>
  body: string
}

// ============================================================================
// Frontmatter Parser
// ============================================================================

/**
 * Parse YAML frontmatter from SKILL.md content.
 *
 * @remarks
 * Extracts the YAML block between `---` delimiters and parses via
 * `Bun.YAML.parse()` (YAML 1.2: multi-line strings, anchors, comments, tags).
 *
 * @param content - Raw SKILL.md file content
 * @returns Parsed metadata and markdown body
 *
 * @public
 */
export const parseFrontmatter = (content: string): { metadata: Record<string, unknown>; body: string } => {
  const trimmed = content.trim()
  if (!trimmed.startsWith('---')) {
    throw new Error('SKILL.md must start with YAML frontmatter (---)')
  }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    throw new Error('YAML frontmatter not properly closed with ---')
  }

  const yamlContent = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trim()
  const metadata = YAML.parse(yamlContent) as Record<string, unknown>

  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new Error('YAML frontmatter must be a mapping (key-value pairs)')
  }

  return { metadata, body }
}

// ============================================================================
// Directory Helpers
// ============================================================================

/**
 * Locate SKILL.md (case-insensitive) within a skill directory.
 *
 * @param skillDir - Absolute path to the skill directory
 * @returns Absolute path to the SKILL.md file, or null if not found
 *
 * @internal
 */
export const findSkillMd = async (skillDir: string): Promise<string | null> => {
  const upperPath = join(skillDir, 'SKILL.md')
  if (await Bun.file(upperPath).exists()) return upperPath

  const lowerPath = join(skillDir, 'skill.md')
  if (await Bun.file(lowerPath).exists()) return lowerPath

  return null
}

/**
 * Check whether a path is a directory.
 *
 * @param path - Absolute path to check
 * @returns true if the path is an existing directory
 *
 * @internal
 */
export const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const result = await $`test -d ${path}`.quiet()
    return result.exitCode === 0
  } catch {
    return false
  }
}

/**
 * Find all skill directories under a root path.
 *
 * @remarks
 * Scans for SKILL.md files recursively and returns their parent directories.
 *
 * @param rootDir - Root directory to search
 * @returns Sorted array of absolute skill directory paths
 *
 * @public
 */
export const findSkillDirectories = async (rootDir: string): Promise<string[]> => {
  if (!(await isDirectory(rootDir))) return []

  const skillDirs: string[] = []
  const glob = new Glob('**/SKILL.md')

  for await (const file of glob.scan({ cwd: rootDir, absolute: true })) {
    const skillDir = file.replace(/\/SKILL\.md$/i, '')
    skillDirs.push(skillDir)
  }

  return skillDirs.sort()
}
