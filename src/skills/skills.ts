import { basename, dirname, join, normalize, relative, resolve } from 'node:path'
import { Glob } from 'bun'
import * as z from 'zod'
import { makeCli } from '../cli/cli.ts'
import { parseMarkdownWithFrontmatter, validateMarkdownLocalLinks } from '../cli/markdown.ts'
import {
  GeneratedSkillManifestSchema,
  type SkillCatalogEntry,
  SkillCatalogEntrySchema,
  type SkillCatalogError,
  type SkillCatalogLoadResult,
  type SkillDirectoryPaths,
  type SkillFrontMatter,
  SkillFrontMatterSchema,
  type SkillFrontmatterLoadResult,
  SkillFrontmatterResultSchema,
  type SkillInstructionErrors,
  type SkillInstructionResourceLinksLoadResult,
  type SkillInstructionsLoadResult,
  type SkillRegistryEntry,
  SkillRegistryEntrySchema,
  type SkillRegistryLoadResult,
  type SkillResourceLinks,
  type SkillResourceLinksJson,
  type SkillsCatalogCliInput,
  SkillsCatalogCliInputSchema,
  type SkillsCatalogCliOutput,
  SkillsCatalogCliOutputSchema,
  type SkillsCliInput,
  SkillsCliInputSchema,
  type SkillsCliOutput,
  SkillsCliOutputSchema,
  type SkillsFrontmatterCliInput,
  SkillsFrontmatterCliInputSchema,
  type SkillsFrontmatterCliOutput,
  SkillsFrontmatterCliOutputSchema,
  type SkillsInstructionsCliInput,
  SkillsInstructionsCliInputSchema,
  type SkillsInstructionsCliOutput,
  SkillsInstructionsCliOutputSchema,
  type SkillsLinksCliInput,
  SkillsLinksCliInputSchema,
  type SkillsLinksCliOutput,
  SkillsLinksCliOutputSchema,
  type SkillsRegistryCliInput,
  SkillsRegistryCliInputSchema,
  type SkillsRegistryCliOutput,
  SkillsRegistryCliOutputSchema,
  type SkillsValidateCliInput,
  SkillsValidateCliInputSchema,
  type SkillsValidateCliOutput,
  SkillsValidateCliOutputSchema,
} from './skills.schema.ts'

/**
 * Glob used to discover `SKILL.md` files under workspace skill directories.
 *
 * @public
 */
export const skillsGlobPattern = '**/skills/*/SKILL.md'
export const repoLocalSkillsGlobPattern = '.agents/skills/*/SKILL.md'
export const generatedSkillManifestFileName = 'plaited.skill.json'
export const SKILLS_COMMAND = 'skills'

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

const toSkillResourceLinksJson = (links: SkillResourceLinks): SkillResourceLinksJson => ({
  present: [...links.present],
  missing: [...links.missing],
})

const toCatalogPath = (rootDir: string, skillPath: string): string => {
  const absoluteRootDir = resolve(rootDir)
  const relativeSkillPath = relative(absoluteRootDir, skillPath).replace(/\\/g, '/')
  return `/${relativeSkillPath}`
}

const toCapabilityAddress = (skillName: string, capabilityId: string): string => `${skillName}/${capabilityId}`

const hasHiddenPathSegment = (path: string): boolean =>
  path.split('/').some((segment) => segment.length > 0 && segment.startsWith('.'))

/**
 * Finds absolute skill directory paths under a workspace root.
 *
 * @param rootDir - Root directory to scan for `SKILL.md` files.
 * @returns Sorted list of absolute skill directory paths.
 *
 * @public
 */
export const findSkillDirectories = async (rootDir: string): Promise<SkillDirectoryPaths> => {
  const absoluteRootDir = resolve(rootDir)
  const skillDirs = new Set<string>()
  const primaryGlob = new Glob(skillsGlobPattern)
  const repoLocalGlob = new Glob(repoLocalSkillsGlobPattern)

  for await (const file of primaryGlob.scan({ cwd: absoluteRootDir, absolute: true })) {
    const normalizedRelativePath = relative(absoluteRootDir, file).replace(/\\/g, '/')
    if (hasHiddenPathSegment(normalizedRelativePath)) continue
    skillDirs.add(file.replace(/[\\/]SKILL\.md$/i, ''))
  }

  for await (const file of repoLocalGlob.scan({ cwd: absoluteRootDir, absolute: true, dot: true })) {
    skillDirs.add(file.replace(/[\\/]SKILL\.md$/i, ''))
  }

  return [...skillDirs].sort()
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

/**
 * Loads generated skill manifests and emits a validated capability registry.
 *
 * @param rootDir - Workspace root to scan.
 * @returns Registry entries plus validation errors for rejected skills/manifests.
 *
 * @public
 */
export const loadSkillRegistry = async (rootDir: string): Promise<SkillRegistryLoadResult> => {
  const skillDirs = await findSkillDirectories(rootDir)
  const registry: SkillRegistryEntry[] = []
  const errors: SkillCatalogError[] = []

  for (const skillDir of skillDirs) {
    const skillPath = join(skillDir, 'SKILL.md')
    const skillCatalogPath = toCatalogPath(rootDir, skillPath)
    const skillFile = Bun.file(skillPath)
    if (!(await skillFile.exists())) continue

    const markdown = await skillFile.text()
    const validation = validateSkill(markdown, { skillPath })
    if (!validation.ok) {
      errors.push({ path: skillCatalogPath, message: validation.errors.join('; ') })
      continue
    }

    let frontmatter: SkillFrontMatter
    try {
      frontmatter = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema).frontmatter
    } catch (error) {
      errors.push({
        path: skillCatalogPath,
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    const manifestPath = join(skillDir, generatedSkillManifestFileName)
    const manifestCatalogPath = toCatalogPath(rootDir, manifestPath)
    const manifestFile = Bun.file(manifestPath)
    if (!(await manifestFile.exists())) continue

    try {
      const manifest = GeneratedSkillManifestSchema.parse(await manifestFile.json())

      registry.push(
        SkillRegistryEntrySchema.parse({
          skill: {
            name: frontmatter.name,
            description: frontmatter.description,
            path: skillCatalogPath,
          },
          origin: manifest.origin,
          capabilities: manifest.capabilities.map((capability) => ({
            ...capability,
            address: toCapabilityAddress(frontmatter.name, capability.id),
          })),
        }),
      )
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? error.issues.map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`).join('; ')
          : error instanceof Error
            ? error.message
            : String(error)

      errors.push({
        path: manifestCatalogPath,
        message,
      })
    }
  }

  registry.sort((a, b) => a.skill.name.localeCompare(b.skill.name))
  errors.sort((a, b) => a.path.localeCompare(b.path))

  return { registry, errors }
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

export const loadSkillFrontmatter = async (rootDir: string, path: string): Promise<SkillFrontmatterLoadResult> => {
  const skillDir = join(rootDir, path)
  const skillPath = join(skillDir, 'SKILL.md')
  const file = Bun.file(skillPath)
  if (!(await file.exists())) return
  const markdown = await file.text()
  if (!validateSkill(markdown, { skillPath }).ok) return

  try {
    const { frontmatter } = parseMarkdownWithFrontmatter(markdown, SkillFrontmatterResultSchema)
    return frontmatter
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
  const links = await validateMarkdownLocalLinks({
    baseDir: skillDir,
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
 * Loads the generated skill capability registry for CLI usage.
 *
 * @public
 */
export const skillsRegistry = async ({ rootDir }: SkillsRegistryCliInput): Promise<SkillsRegistryCliOutput> =>
  loadSkillRegistry(rootDir)

/**
 * Dispatches skills CLI modes to existing library handlers.
 *
 * @public
 */
export const runSkills = async (input: SkillsCliInput): Promise<SkillsCliOutput> => {
  switch (input.mode) {
    case 'catalog':
      return skillsCatalog(input)
    case 'registry':
      return skillsRegistry(input)
    case 'validate':
      return skillsValidate(input)
    case 'links':
      return skillsLinks(input)
    case 'instructions':
      return skillsInstructions(input)
    case 'frontmatter':
      return skillsFrontmatter(input)
  }
}

/**
 * CLI handler for `skills`.
 *
 * @public
 */
export const skillsCli = makeCli({
  name: SKILLS_COMMAND,
  inputSchema: SkillsCliInputSchema,
  outputSchema: SkillsCliOutputSchema,
  run: runSkills,
})

/**
 * CLI handler for `skills-registry`.
 *
 * @public
 */
export const skillsRegistryCli = makeCli({
  name: 'skills-registry',
  inputSchema: SkillsRegistryCliInputSchema,
  outputSchema: SkillsRegistryCliOutputSchema,
  run: skillsRegistry,
})

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

/**
 * Loads a single skill's markdown body for CLI usage.
 *
 * @public
 */
export const skillsInstructions = async ({
  rootDir,
  path,
}: SkillsInstructionsCliInput): Promise<SkillsInstructionsCliOutput> => {
  const skillPath = join(rootDir, path, 'SKILL.md')
  const body = await loadSkillInstructions(rootDir, path)
  if (body !== undefined) {
    return {
      body,
      errors: [],
    }
  }

  const file = Bun.file(skillPath)
  if (!(await file.exists())) {
    return {
      body: null,
      errors: [{ skillPath, message: `Skill markdown not found: ${skillPath}` }],
    }
  }

  const validation = validateSkill(await file.text(), { skillPath })
  return {
    body: null,
    errors: validation.errors.map((message) => ({ skillPath, message })),
  }
}

/**
 * CLI handler for `skills-instructions`.
 *
 * @public
 */
export const skillsInstructionsCli = makeCli({
  name: 'skills-instructions',
  inputSchema: SkillsInstructionsCliInputSchema,
  outputSchema: SkillsInstructionsCliOutputSchema,
  run: skillsInstructions,
})

/**
 * Loads a single skill's parsed frontmatter object for CLI usage.
 *
 * @public
 */
export const skillsFrontmatter = async ({
  rootDir,
  path,
}: SkillsFrontmatterCliInput): Promise<SkillsFrontmatterCliOutput> => {
  const skillPath = join(rootDir, path, 'SKILL.md')
  const frontmatter = await loadSkillFrontmatter(rootDir, path)
  if (frontmatter !== undefined) {
    return {
      frontmatter,
      errors: [],
    }
  }

  const file = Bun.file(skillPath)
  if (!(await file.exists())) {
    return {
      frontmatter: null,
      errors: [{ skillPath, message: `Skill markdown not found: ${skillPath}` }],
    }
  }

  const validation = validateSkill(await file.text(), { skillPath })
  return {
    frontmatter: null,
    errors: validation.errors.map((message) => ({ skillPath, message })),
  }
}

/**
 * CLI handler for `skills-frontmatter`.
 *
 * @public
 */
export const skillsFrontmatterCli = makeCli({
  name: 'skills-frontmatter',
  inputSchema: SkillsFrontmatterCliInputSchema,
  outputSchema: SkillsFrontmatterCliOutputSchema,
  run: skillsFrontmatter,
})
