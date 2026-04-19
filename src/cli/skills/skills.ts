import { basename, dirname, join, normalize, relative, resolve } from 'node:path'
import { Glob } from 'bun'
import * as z from 'zod'
import { extractLocalLinksFromMarkdown, parseMarkdownWithFrontmatter } from '../markdown/markdown.ts'
import { makeCli } from '../utils/cli.ts'
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
  type SkillResourceLinksJson,
  type SkillsCatalogCliInput,
  SkillsCatalogCliInputSchema,
  type SkillsCatalogCliOutput,
  SkillsCatalogCliOutputSchema,
  type SkillsLinksCliInput,
  SkillsLinksCliInputSchema,
  type SkillsLinksCliOutput,
  SkillsLinksCliOutputSchema,
  type SkillsValidateCliInput,
  SkillsValidateCliInputSchema,
  type SkillsValidateCliOutput,
  SkillsValidateCliOutputSchema,
  type SkillValidationStatus,
} from './skills.schema.ts'

/**
 * Glob used to discover `SKILL.md` files under workspace skill directories.
 *
 * @public
 */
export const skillsGlobPattern = '**/skills/*/SKILL.md'

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

const getExpectedSkillDirectoryName = (skillPath: string): string => {
  const normalizedPath = normalize(skillPath)
  return /SKILL\.md$/i.test(normalizedPath) ? basename(dirname(normalizedPath)) : basename(normalizedPath)
}

const sortSkillResourceLinks = (left: SkillResourceLink, right: SkillResourceLink): number => {
  const valueComparison = left.value.localeCompare(right.value)
  if (valueComparison !== 0) return valueComparison
  return left.text.localeCompare(right.text)
}

const toSkillResourceLinksJson = (links: SkillResourceLinks): SkillResourceLinksJson => ({
  present: [...links.present],
  missing: [...links.missing],
})

const toCatalogPath = (rootDir: string, skillPath: string): string => {
  const absoluteRootDir = resolve(rootDir)
  const relativeSkillPath = relative(absoluteRootDir, skillPath).replace(/\\/g, '/')
  return `/${relativeSkillPath}`
}

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

/**
 * Validates a `SKILL.md` document and returns structured validation errors.
 *
 * @param markdown - Full markdown source for the skill file.
 * @param options - Optional path information used to validate the directory name.
 * @returns Validation status and structured validation errors.
 *
 * @public
 */
export const validateSkill = (
  markdown: string,
  options?: {
    skillPath?: string
  },
): SkillsValidateCliOutput => {
  let parsed: { frontmatter: SkillFrontMatter; body: string }

  try {
    parsed = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema)
  } catch (error) {
    return {
      ok: false,
      errors: [formatSkillValidationError(error)],
    }
  }

  if (options?.skillPath) {
    const expectedDirName = getExpectedSkillDirectoryName(options.skillPath)
    if (expectedDirName !== parsed.frontmatter.name) {
      return {
        ok: false,
        errors: [
          `Invalid skill frontmatter: directory name '${expectedDirName}' must match skill name '${parsed.frontmatter.name}'`,
        ],
      }
    }
  }

  return {
    ok: true,
    errors: [],
  }
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

  return {
    present: new Set([...present.values()].sort(sortSkillResourceLinks)),
    missing: new Set([...missing.values()].sort(sortSkillResourceLinks)),
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
  const validation = validateSkill(markdown, options)
  if (!validation.ok) {
    for (const error of validation.errors) {
      console.error(error)
    }
    return false
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
    const path = toCatalogPath(rootDir, skillPath)
    const file = Bun.file(skillPath)
    if (!(await file.exists())) continue

    const markdown = await file.text()
    const validation = validateSkill(markdown, { skillPath })
    if (!validation.ok) {
      errors.push({ path, message: validation.errors.join('; ') })
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
  if (!validateSkill(markdown, { skillPath }).ok) return

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
  const validation = validateSkill(markdown, { skillPath })
  if (!validation.ok) {
    for (const message of validation.errors) {
      errors.push({ skillPath, message })
    }
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

/**
 * Loads the skill catalog for CLI usage.
 *
 * @public
 */
export const skillsCatalog = async ({ rootDir }: SkillsCatalogCliInput): Promise<SkillsCatalogCliOutput> =>
  loadSkillCatalog(rootDir)

/**
 * CLI handler for `skills-catalog`.
 *
 * @public
 */
export const skillsCatalogCli = makeCli({
  name: 'skills-catalog',
  inputSchema: SkillsCatalogCliInputSchema,
  outputSchema: SkillsCatalogCliOutputSchema,
  run: skillsCatalog,
})

/**
 * Validates a single `SKILL.md` path for CLI usage.
 *
 * @public
 */
export const skillsValidate = async ({ skillPath }: SkillsValidateCliInput): Promise<SkillsValidateCliOutput> => {
  const file = Bun.file(skillPath)
  if (!(await file.exists())) {
    return {
      ok: false,
      errors: [`Skill markdown not found: ${skillPath}`],
    }
  }

  return validateSkill(await file.text(), { skillPath })
}

/**
 * CLI handler for `skills-validate`.
 *
 * @public
 */
export const skillsValidateCli = makeCli({
  name: 'skills-validate',
  inputSchema: SkillsValidateCliInputSchema,
  outputSchema: SkillsValidateCliOutputSchema,
  run: skillsValidate,
})

/**
 * Loads and validates skill instruction links for CLI usage.
 *
 * @public
 */
export const skillsLinks = async ({ rootDir, path }: SkillsLinksCliInput): Promise<SkillsLinksCliOutput> => {
  const skillPath = join(rootDir, path, 'SKILL.md')
  const result = await getSkillInstructionResourceLinks(rootDir, path)
  if (!result) {
    return {
      links: {
        present: [],
        missing: [],
      },
      errors: [{ skillPath, message: `Skill markdown not found: ${skillPath}` }],
    }
  }

  return {
    links: toSkillResourceLinksJson(result.links),
    errors: result.errors,
  }
}

/**
 * CLI handler for `skills-links`.
 *
 * @public
 */
export const skillsLinksCli = makeCli({
  name: 'skills-links',
  inputSchema: SkillsLinksCliInputSchema,
  outputSchema: SkillsLinksCliOutputSchema,
  run: skillsLinks,
})
