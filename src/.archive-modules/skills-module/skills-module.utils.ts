import { basename, dirname, join, normalize, resolve } from 'node:path'
import { Glob } from 'bun'
import * as z from 'zod'
import { extractLocalLinksFromMarkdown, parseMarkdownWithFrontmatter } from '../../cli.ts'
import { type SkillCatalogEntry, SkillCatalogEntrySchema } from './skills-module.schemas.ts'

const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Zod schema for skill markdown frontmatter.
 *
 * @public
 */
export const SkillFrontMatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(skillNamePattern, 'Name must contain only lowercase letters, numbers, and single hyphens'),
  description: z.string().min(1).max(1024),
  license: z.string().min(1).optional(),
  compatibility: z.string().min(1).max(500).optional(),
  'allowed-tools': z.string().min(1).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

/** @public */
export type SkillFrontMatter = z.infer<typeof SkillFrontMatterSchema>

/**
 * Result of validating local markdown links within a skill.
 *
 * @public
 */
export type SkillLinkValidation = {
  present: string[]
  missing: string[]
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
}): Promise<SkillLinkValidation> => {
  const present: string[] = []
  const missing: string[] = []
  const links = await extractLocalLinksFromMarkdown(markdownBody)

  for (const link of links) {
    const absolutePath = resolve(skillDir, link)
    const file = Bun.file(absolutePath)
    if (await file.exists()) {
      present.push(link)
      continue
    }

    missing.push(link)
  }

  return {
    present: present.sort(),
    missing: missing.sort(),
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
): boolean => {
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
export const loadSkillCatalog = async (
  rootDir: string,
): Promise<{
  catalog: SkillCatalogEntry[]
  errors: Array<{ skillPath: string; message: string }>
}> => {
  const skillDirs = await findSkillDirectories(rootDir)
  const catalog: SkillCatalogEntry[] = []
  const errors: Array<{ skillPath: string; message: string }> = []

  for (const skillDir of skillDirs) {
    const skillPath = join(skillDir, 'SKILL.md')
    const file = Bun.file(skillPath)
    if (!(await file.exists())) continue

    const markdown = await file.text()
    if (!isValidSkill(markdown, { skillPath })) {
      errors.push({ skillPath, message: 'Invalid skill markdown' })
      continue
    }

    try {
      const { frontmatter, body } = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema)
      const localLinks = await validateSkillLocalLinks({
        skillDir,
        markdownBody: body,
      })

      catalog.push(
        SkillCatalogEntrySchema.parse({
          name: frontmatter.name,
          description: frontmatter.description,
          skillPath,
          skillDir,
          license: frontmatter.license,
          compatibility: frontmatter.compatibility,
          allowedTools: frontmatter['allowed-tools'],
          metadata: frontmatter.metadata,
          localLinks,
        }),
      )
    } catch (error) {
      errors.push({
        skillPath,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name))
  errors.sort((a, b) => a.skillPath.localeCompare(b.skillPath))

  return { catalog, errors }
}

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
export const findSkillDirectories = async (rootDir: string): Promise<string[]> => {
  const skillDirs: string[] = []
  const glob = new Glob(skillsGlobPattern)

  for await (const file of glob.scan({ cwd: rootDir, absolute: true })) {
    const skillDir = file.replace(/\/SKILL\.md$/i, '')
    skillDirs.push(skillDir)
  }

  return skillDirs.sort()
}
