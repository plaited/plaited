import { basename, dirname, join, normalize, resolve } from 'node:path'
import { Glob } from 'bun'
import * as z from 'zod'
import { extractLocalLinksFromMarkdown, parseMarkdownWithFrontmatter } from '../markdown/markdown.ts'
import {
  type SkillCatalogEntry,
  SkillCatalogEntrySchema,
  type SkillCatalogError,
  type SkillCatalogLoadResult,
  type SkillDirectoryPaths,
  type SkillFrontMatter,
  SkillFrontMatterSchema,
  type SkillInstructionErrors,
  type SkillInstructionResourceLinksLoadResult,
  type SkillInstructionsLoadResult,
  type SkillResourceLink,
  type SkillResourceLinks,
  type SkillValidationStatus,
} from './skills.schema.ts'

/**
 * Glob used to discover `SKILL.md` files under workspace skill directories.
 *
 * @public
 */
export const skillsGlobPattern = '**/skills/*/SKILL.md'

/**
 * Finds absolute skill directory paths under a workspace root.
 *
 * @param rootDir - Root directory to scan for `SKILL.md` files.
 * @returns Sorted list of absolute skill directory paths.
 *
 * @public
 */
export const findSkillDirectories = async (rootDir: string): Promise<SkillDirectoryPaths> => {
  const skillDirs: SkillDirectoryPaths = []
  const glob = new Glob(skillsGlobPattern)

  for await (const file of glob.scan({ cwd: rootDir, absolute: true })) {
    const skillDir = file.replace(/\/SKILL\.md$/i, '')
    skillDirs.push(skillDir)
  }

  return skillDirs.sort()
}

const formatSkillValidationError = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    const details = error.issues.map((issue) => `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`).join('; ')
    return `Invalid skill frontmatter: ${details}`
  }

  if (error instanceof Error) {
    return `Invalid skill frontmatter: ${error.message}`
  }

  return `Invalid skill frontmatter: ${String(error)}`
}

/**
 * Validates local markdown links referenced from a skill body.
 *
 * @param options - Skill directory and markdown body to validate.
 * @returns Lists of links that resolve and links that are missing.
 *
 * @public
 */
export const validateSkillLocalLinks = async ({
  skillDir,
  markdownBody,
}: {
  skillDir: string
  markdownBody: string
}): Promise<SkillResourceLinks> => {
  const present = new Map<string, SkillResourceLink>()
  const missing = new Map<string, SkillResourceLink>()
  const links = await extractLocalLinksFromMarkdown(markdownBody)

  for (const link of links) {
    const absolutePath = resolve(skillDir, link.value)
    const file = Bun.file(absolutePath)
    const key = `${link.value}\u0000${link.text}`
    if (await file.exists()) {
      present.set(key, {
        value: link.value,
        text: link.text || link.value,
      })
      continue
    }

    missing.set(key, {
      value: link.value,
      text: link.text || link.value,
    })
  }

  const sortLinks = (left: SkillResourceLink, right: SkillResourceLink): number => {
    const valueComparison = left.value.localeCompare(right.value)
    if (valueComparison !== 0) return valueComparison
    return left.text.localeCompare(right.text)
  }

  return {
    present: new Set([...present.values()].sort(sortLinks)),
    missing: new Set([...missing.values()].sort(sortLinks)),
  }
}

/**
 * Validates a `SKILL.md` file against the expected frontmatter contract.
 *
 * @param markdown - Full markdown source for the skill file.
 * @param options - Optional path information used to validate the directory name.
 * @returns `true` when the markdown parses and matches the expected skill name.
 *
 * @public
 */
export const isValidSkill = (
  markdown: string,
  options?: {
    skillPath?: string
  },
): SkillValidationStatus => {
  let parsed: { frontmatter: SkillFrontMatter; body: string }

  try {
    parsed = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema)
  } catch (error) {
    console.error(formatSkillValidationError(error))
    return false
  }

  if (options?.skillPath) {
    const normalizedPath = normalize(options.skillPath)
    const expectedDirName = /SKILL\.md$/i.test(normalizedPath)
      ? basename(dirname(normalizedPath))
      : basename(normalizedPath)
    if (expectedDirName !== parsed.frontmatter.name) {
      console.error(
        `Invalid skill frontmatter: directory name '${expectedDirName}' must match skill name '${parsed.frontmatter.name}'`,
      )
      return false
    }
  }

  return true
}

/**
 * Loads and validates all skills under a root directory.
 *
 * @param rootDir - Workspace root to scan.
 * @returns Valid skill catalog entries plus validation errors for rejected skills.
 *
 * @public
 */
export const loadSkillCatalog = async (rootDir: string): Promise<SkillCatalogLoadResult> => {
  const skillDirs = await findSkillDirectories(rootDir)
  const catalog: SkillCatalogEntry[] = []
  const errors: SkillCatalogError[] = []

  for (const skillDir of skillDirs) {
    const skillPath = join(skillDir, 'SKILL.md')
    const path = skillPath.split(rootDir)[1]!
    const file = Bun.file(skillPath)
    if (!(await file.exists())) continue

    const markdown = await file.text()
    if (!isValidSkill(markdown, { skillPath })) {
      errors.push({ path, message: 'Invalid skill markdown' })
      continue
    }

    try {
      const { frontmatter } = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema)

      catalog.push(
        SkillCatalogEntrySchema.parse({
          name: frontmatter.name,
          description: frontmatter.description,
          path,
        }),
      )
    } catch (error) {
      errors.push({
        path,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name))
  errors.sort((a, b) => a.path.localeCompare(b.path))

  return { catalog, errors }
}

export const loadSkillInstructions = async (rootDir: string, path: string): Promise<SkillInstructionsLoadResult> => {
  const skillDir = join(rootDir, path)
  const skillPath = join(skillDir, 'SKILL.md')
  const file = Bun.file(skillPath)
  if (!(await file.exists())) return
  const markdown = await file.text()
  if (!isValidSkill(markdown, { skillPath })) return

  try {
    const { body } = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema)
    return body
  } catch {
    return
  }
}

export const getSkillInstructionResourceLinks = async (
  rootDir: string,
  path: string,
): Promise<SkillInstructionResourceLinksLoadResult> => {
  const skillDir = join(rootDir, path)
  const skillPath = join(skillDir, 'SKILL.md')
  const file = Bun.file(skillPath)
  if (!(await file.exists())) return
  const errors: SkillInstructionErrors = []
  const markdown = await file.text()
  if (!isValidSkill(markdown, { skillPath })) {
    errors.push({ skillPath, message: 'Invalid skill markdown' })
  }
  let body: string
  try {
    body = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema).body
  } catch (error) {
    if (errors.length === 0) {
      errors.push({
        skillPath,
        message: error instanceof Error ? error.message : String(error),
      })
    }
    return {
      links: {
        present: new Set(),
        missing: new Set(),
      },
      errors,
    }
  }
  const links = await validateSkillLocalLinks({
    skillDir,
    markdownBody: body,
  })
  return { links, errors }
}
