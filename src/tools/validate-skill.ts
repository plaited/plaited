#!/usr/bin/env bun
/**
 * Validate skill directories against AgentSkills specification.
 *
 * @remarks
 * Accepts JSON positional arg or stdin pipe.
 * `--schema input|output` for agent discovery.
 *
 * @see https://agentskills.io/specification
 *
 * @public
 */

import { basename, join } from 'node:path'
import { Glob, YAML } from 'bun'
import * as z from 'zod'
import { parseCli } from './cli.utils.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Properties extracted from SKILL.md frontmatter and body.
 *
 * @public
 */
type SkillProperties = {
  name: string
  description: string
  license?: string
  compatibility?: string
  'allowed-tools'?: string[]
  metadata?: Record<string, string>
  body: string
}

/**
 * Result of validating a skill directory.
 *
 * @public
 */
type ValidationResult = {
  valid: boolean
  path: string
  errors: string[]
  warnings: string[]
  properties?: SkillProperties
}

export type { SkillProperties, ValidationResult }

// ============================================================================
// Schemas
// ============================================================================

/** @public */
const ValidateSkillInputSchema = z.object({
  paths: z.array(z.string()).optional().describe('Paths to validate (defaults to .claude/skills/)'),
})

/** @public */
const ValidateSkillOutputSchema = z.array(
  z.object({
    valid: z.boolean().describe('Whether the skill passed validation'),
    path: z.string().describe('Absolute path to the skill directory'),
    errors: z.array(z.string()).describe('Validation errors'),
    warnings: z.array(z.string()).describe('Non-blocking warnings'),
    properties: z
      .object({
        name: z.string(),
        description: z.string(),
        license: z.string().optional(),
        compatibility: z.string().optional(),
        'allowed-tools': z.array(z.string()).optional().describe('Parsed from space-delimited allowed-tools field'),
        metadata: z.record(z.string(), z.string()).optional(),
        body: z.string().describe('Markdown body after frontmatter'),
      })
      .optional()
      .describe('Extracted properties (only present when valid)'),
  }),
)

export { ValidateSkillInputSchema, ValidateSkillOutputSchema }

// ============================================================================
// Constants
// ============================================================================

const ALLOWED_FIELDS = new Set(['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata'])
const REQUIRED_FIELDS = ['name', 'description'] as const
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 1024
const MAX_COMPATIBILITY_LENGTH = 500

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
const parseFrontmatter = (content: string): { metadata: Record<string, unknown>; body: string } => {
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

export { parseFrontmatter }

// ============================================================================
// Field Validators
// ============================================================================

/** @internal */
const validateName = (name: unknown, dirName: string): string[] => {
  const errors: string[] = []

  if (typeof name !== 'string' || !name) {
    errors.push("Field 'name' must be a non-empty string")
    return errors
  }

  if (name.length > MAX_NAME_LENGTH) {
    errors.push(`Skill name exceeds ${MAX_NAME_LENGTH} character limit`)
  }

  if (name !== name.toLowerCase()) {
    errors.push('Skill name must be lowercase')
  }

  if (name.startsWith('-') || name.endsWith('-')) {
    errors.push('Skill name cannot start or end with a hyphen')
  }

  if (name.includes('--')) {
    errors.push('Skill name cannot contain consecutive hyphens')
  }

  if (!NAME_PATTERN.test(name)) {
    errors.push('Skill name contains invalid characters (only lowercase alphanumeric and hyphens allowed)')
  }

  if (name !== dirName) {
    errors.push(`Directory name '${dirName}' must match skill name '${name}'`)
  }

  return errors
}

/** @internal */
const validateDescription = (description: unknown): string[] => {
  const errors: string[] = []

  if (typeof description !== 'string' || !description) {
    errors.push("Field 'description' must be a non-empty string")
    return errors
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`Description exceeds ${MAX_DESCRIPTION_LENGTH} character limit`)
  }

  return errors
}

/** @internal */
const validateCompatibility = (compatibility: unknown): string[] => {
  const errors: string[] = []
  if (compatibility === undefined) return errors

  if (typeof compatibility !== 'string') {
    errors.push("Field 'compatibility' must be a string")
    return errors
  }

  if (compatibility.length > MAX_COMPATIBILITY_LENGTH) {
    errors.push(`Compatibility exceeds ${MAX_COMPATIBILITY_LENGTH} character limit`)
  }

  return errors
}

/** @internal */
const validateMetadata = (metadata: unknown): string[] => {
  const errors: string[] = []
  if (metadata === undefined) return errors

  if (typeof metadata !== 'object' || metadata === null) {
    errors.push("Field 'metadata' must be an object")
    return errors
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== 'string') {
      errors.push(`Metadata field '${key}' must be a string`)
    }
  }

  return errors
}

/** @internal */
const validateFields = (metadata: Record<string, unknown>): string[] => {
  const warnings: string[] = []

  for (const key of Object.keys(metadata)) {
    if (!ALLOWED_FIELDS.has(key)) {
      warnings.push(`Unexpected field in frontmatter: '${key}'`)
    }
  }

  return warnings
}

// ============================================================================
// Directory Helpers
// ============================================================================

/** @internal */
const findSkillMd = async (skillDir: string): Promise<string | null> => {
  const upperPath = join(skillDir, 'SKILL.md')
  if (await Bun.file(upperPath).exists()) return upperPath

  const lowerPath = join(skillDir, 'skill.md')
  if (await Bun.file(lowerPath).exists()) return lowerPath

  return null
}

/** @internal */
const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const stat = await Bun.$`test -d ${path}`.quiet()
    return stat.exitCode === 0
  } catch {
    return false
  }
}

// ============================================================================
// Core Validation
// ============================================================================

/**
 * Validate a single skill directory.
 *
 * @param skillDir - Absolute path to the skill directory
 * @returns Validation result with errors, warnings, and extracted properties
 *
 * @public
 */
const validateSkillDirectory = async (skillDir: string): Promise<ValidationResult> => {
  const result: ValidationResult = {
    valid: false,
    path: skillDir,
    errors: [],
    warnings: [],
  }

  if (!(await isDirectory(skillDir))) {
    result.errors.push(`Directory does not exist: ${skillDir}`)
    return result
  }

  const skillMdPath = await findSkillMd(skillDir)
  if (!skillMdPath) {
    result.errors.push('Missing required file: SKILL.md')
    return result
  }

  let content: string
  try {
    content = await Bun.file(skillMdPath).text()
  } catch (error) {
    result.errors.push(`Failed to read SKILL.md: ${error}`)
    return result
  }

  let metadata: Record<string, unknown>
  let body: string
  try {
    const parsed = parseFrontmatter(content)
    metadata = parsed.metadata
    body = parsed.body
  } catch (error) {
    result.errors.push(`Failed to parse frontmatter: ${error}`)
    return result
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in metadata)) {
      result.errors.push(`Missing required field in frontmatter: '${field}'`)
    }
  }

  if (result.errors.length > 0) return result

  const dirName = basename(skillDir)

  result.errors.push(...validateName(metadata.name, dirName))
  result.errors.push(...validateDescription(metadata.description))
  result.errors.push(...validateCompatibility(metadata.compatibility))
  result.errors.push(...validateMetadata(metadata.metadata))
  result.warnings.push(...validateFields(metadata))

  if (result.errors.length === 0) {
    result.valid = true
    const props: SkillProperties = {
      name: metadata.name as string,
      description: metadata.description as string,
      body,
    }
    if (typeof metadata.license === 'string') props.license = metadata.license
    if (typeof metadata.compatibility === 'string') props.compatibility = metadata.compatibility
    if (typeof metadata['allowed-tools'] === 'string') {
      props['allowed-tools'] = (metadata['allowed-tools'] as string).split(/\s+/).filter(Boolean)
    }
    if (metadata.metadata && typeof metadata.metadata === 'object') {
      props.metadata = metadata.metadata as Record<string, string>
    }
    result.properties = props
  }

  return result
}

/**
 * Find all skill directories under a root path.
 *
 * @param rootDir - Root directory to search
 * @returns Sorted array of absolute skill directory paths
 *
 * @public
 */
const findSkillDirectories = async (rootDir: string): Promise<string[]> => {
  if (!(await isDirectory(rootDir))) return []

  const skillDirs: string[] = []
  const glob = new Glob('**/SKILL.md')

  for await (const file of glob.scan({ cwd: rootDir, absolute: true })) {
    const skillDir = file.replace(/\/SKILL\.md$/i, '')
    skillDirs.push(skillDir)
  }

  return skillDirs.sort()
}

/**
 * Validate all skills under a root directory.
 *
 * @param rootDir - Root directory containing skill folders
 * @returns Array of validation results
 *
 * @public
 */
const validateSkills = async (rootDir: string): Promise<ValidationResult[]> => {
  const skillDirs = await findSkillDirectories(rootDir)
  return Promise.all(skillDirs.map((dir) => validateSkillDirectory(dir)))
}

export { validateSkillDirectory, validateSkills, findSkillDirectories }

// ============================================================================
// Path Resolution
// ============================================================================

/** @internal */
const resolveAndValidate = async (searchPaths: string[], cwd: string): Promise<ValidationResult[]> => {
  const allResults: ValidationResult[] = []

  for (const searchPath of searchPaths) {
    const fullPath = searchPath.startsWith('/') ? searchPath : join(cwd, searchPath)
    const skillMdPath = await findSkillMd(fullPath)

    if (skillMdPath) {
      allResults.push(await validateSkillDirectory(fullPath))
    } else {
      const results = await validateSkills(fullPath)
      if (results.length > 0) {
        allResults.push(...results)
      } else {
        allResults.push(await validateSkillDirectory(fullPath))
      }
    }
  }

  return allResults
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * CLI entry point.
 *
 * @remarks
 * Exit 0 = all valid, 1 = validation errors, 2 = bad input.
 *
 * @param args - CLI arguments (after command name)
 *
 * @public
 */
export const validateSkill = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited validate-skill
Validate skill directories against AgentSkills specification

Usage: plaited validate-skill '<json>' [options]
       echo '<json>' | plaited validate-skill

Input (JSON):
  paths    string[]   Paths to validate (default: .claude/skills/)

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  All skills valid (or --schema/--help)
  1  Validation errors found
  2  Bad input or tool error

Examples:
  plaited validate-skill '{"paths": [".claude/skills"]}'
  echo '{"paths": ["skills/"]}' | plaited validate-skill
  plaited validate-skill --schema input
  plaited validate-skill --schema output`)
    return
  }

  // All fields optional — default to {} when called interactively with no args
  const input = await parseCli(args.length === 0 && process.stdin.isTTY ? ['{}'] : args, ValidateSkillInputSchema, {
    name: 'validate-skill',
    outputSchema: ValidateSkillOutputSchema,
  })

  const cwd = process.cwd()
  const searchPaths = input.paths?.length ? input.paths : [join(cwd, '.claude/skills')]
  const results = await resolveAndValidate(searchPaths, cwd)

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(JSON.stringify(results, null, 2))
  if (results.some((r) => !r.valid)) process.exit(1)
}

if (import.meta.main) {
  await validateSkill(Bun.argv.slice(2))
}
