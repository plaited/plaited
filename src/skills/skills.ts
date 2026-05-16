import { basename, dirname, extname, join, normalize, relative, resolve } from 'node:path'
import { Glob } from 'bun'
import * as z from 'zod'
import { makeCli } from '../cli/cli.ts'
import {
  type MarkdownLocalLinksValidationResult,
  parseMarkdownWithFrontmatter,
  validateMarkdownLocalLinks,
} from '../cli/markdown.ts'
import {
  type SkillCatalogEntry,
  SkillCatalogEntrySchema,
  type SkillCatalogError,
  type SkillCatalogLoadResult,
  type SkillFrontMatter,
  SkillFrontMatterSchema,
  type SkillFrontmatterResult,
  SkillFrontmatterResultSchema,
  type SkillInstructionErrors,
  type SkillRegistryEntry,
  SkillRegistryEntrySchema,
  type SkillRegistryLoadResult,
  type SkillResourceLinksJson,
  SkillsCliInputSchema,
  type SkillsCliOutput,
  SkillsCliOutputSchema,
  type SkillsEnvelopeCliInput,
  type SkillsEnvelopeCliOutput,
  type SkillsFrontmatterCliInput,
  type SkillsFrontmatterCliOutput,
  type SkillsInstructionsCliInput,
  type SkillsInstructionsCliOutput,
  type SkillsLinksCliInput,
  type SkillsLinksCliOutput,
  type SkillsValidateCliInput,
  type SkillsValidateCliOutput,
} from './skills.schema.ts'

type SkillInstructionResourceLinksLoadResult =
  | {
      links: MarkdownLocalLinksValidationResult
      errors: SkillInstructionErrors
    }
  | undefined

type SkillEnvelopeIssue = SkillsEnvelopeCliOutput['errors'][number]

const skillsGlobPattern = '**/skills/*/SKILL.md'
const repoLocalSkillsGlobPattern = '.agents/skills/*/SKILL.md'
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

const toSkillResourceLinksJson = (links: MarkdownLocalLinksValidationResult): SkillResourceLinksJson => ({
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

export const findSkillDirectories = async (rootDir: string): Promise<string[]> => {
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

const validateSkill = (
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

    const manifest = frontmatter.metadata?.plaited
    if (!manifest) continue

    try {
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
          ? error.issues.map((issue) => `${issue.path.join('.') || 'metadata.plaited'}: ${issue.message}`).join('; ')
          : error instanceof Error
            ? error.message
            : String(error)

      errors.push({
        path: skillCatalogPath,
        message,
      })
    }
  }

  registry.sort((a, b) => a.skill.name.localeCompare(b.skill.name))
  errors.sort((a, b) => a.path.localeCompare(b.path))

  return { registry, errors }
}

export const loadSkillInstructions = async (rootDir: string, path: string): Promise<string | undefined> => {
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

export const loadSkillFrontmatter = async (
  rootDir: string,
  path: string,
): Promise<SkillFrontmatterResult | undefined> => {
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

const isPathWithinDirectory = (directory: string, path: string): boolean => {
  const relativePath = relative(directory, path)
  return relativePath.length === 0 || (!relativePath.startsWith('..') && !relativePath.startsWith('/'))
}

const isMarkdownPath = (path: string): boolean => {
  const extension = extname(path).toLowerCase()
  return extension === '.md' || extension === '.markdown'
}

const toEnvelopeIssue = ({ path, message }: SkillEnvelopeIssue): SkillEnvelopeIssue => ({ path, message })

const validateEnvelopeMarkdownLinks = async ({
  skillDir,
  markdownPath,
  markdownBody,
  errors,
  visited,
}: {
  skillDir: string
  markdownPath: string
  markdownBody?: string
  errors: SkillEnvelopeIssue[]
  visited: Set<string>
}): Promise<void> => {
  const resolvedMarkdownPath = resolve(markdownPath)
  if (visited.has(resolvedMarkdownPath)) return
  visited.add(resolvedMarkdownPath)

  if (visited.size > 100) {
    errors.push(
      toEnvelopeIssue({
        path: resolvedMarkdownPath,
        message: 'Envelope markdown link traversal exceeded 100 files.',
      }),
    )
    return
  }

  const baseDir = dirname(resolvedMarkdownPath)
  const body = markdownBody ?? (await Bun.file(resolvedMarkdownPath).text())
  const links = await validateMarkdownLocalLinks({ baseDir, markdownBody: body })

  for (const link of links.missing) {
    errors.push(
      toEnvelopeIssue({
        path: resolvedMarkdownPath,
        message: `Missing local markdown link: ${link.value}`,
      }),
    )
  }

  for (const link of links.present) {
    const linkedPath = resolve(baseDir, link.value)
    if (!isPathWithinDirectory(skillDir, linkedPath)) {
      errors.push(
        toEnvelopeIssue({
          path: resolvedMarkdownPath,
          message: `Local markdown link escapes skill directory: ${link.value}`,
        }),
      )
      continue
    }

    if (!isMarkdownPath(linkedPath)) continue
    await validateEnvelopeMarkdownLinks({
      skillDir,
      markdownPath: linkedPath,
      errors,
      visited,
    })
  }
}

const validateEnvelopeHandlers = async ({
  skillDir,
  frontmatter,
  errors,
}: {
  skillDir: string
  frontmatter: SkillFrontMatter
  errors: SkillEnvelopeIssue[]
}): Promise<void> => {
  const capabilities = frontmatter.metadata?.plaited?.capabilities ?? []

  for (const capability of capabilities) {
    if (capability.type !== 'cli') continue
    const commandPath = resolve(skillDir, capability.handler.command)
    if (!isPathWithinDirectory(skillDir, commandPath)) {
      errors.push(
        toEnvelopeIssue({
          path: commandPath,
          message: `Declared CLI handler escapes skill directory: ${capability.handler.command}`,
        }),
      )
      continue
    }

    if (await Bun.file(commandPath).exists()) continue
    errors.push(
      toEnvelopeIssue({
        path: commandPath,
        message: `Declared CLI handler file not found: ${capability.handler.command}`,
      }),
    )
  }
}

const skillsEnvelope = async ({ rootDir, path }: SkillsEnvelopeCliInput): Promise<SkillsEnvelopeCliOutput> => {
  const skillDir = resolve(rootDir, path)
  const skillPath = join(skillDir, 'SKILL.md')
  const file = Bun.file(skillPath)
  const errors: SkillEnvelopeIssue[] = []
  const warnings: SkillEnvelopeIssue[] = []

  if (!(await file.exists())) {
    errors.push(toEnvelopeIssue({ path: skillPath, message: `Skill markdown not found: ${skillPath}` }))
    return { ok: false, errors, warnings }
  }

  const markdown = await file.text()
  const validation = validateSkill(markdown, { skillPath })
  if (!validation.ok) {
    for (const message of validation.errors) {
      errors.push(toEnvelopeIssue({ path: skillPath, message }))
    }
    return { ok: false, errors, warnings }
  }

  const { frontmatter, body } = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema)
  await validateEnvelopeMarkdownLinks({
    skillDir,
    markdownPath: skillPath,
    markdownBody: body,
    errors,
    visited: new Set(),
  })
  await validateEnvelopeHandlers({ skillDir, frontmatter, errors })

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}

const skillsValidate = async ({ skillPath }: SkillsValidateCliInput): Promise<SkillsValidateCliOutput> => {
  const file = Bun.file(skillPath)
  if (!(await file.exists())) {
    return {
      ok: false,
      errors: [`Skill markdown not found: ${skillPath}`],
    }
  }

  return validateSkill(await file.text(), { skillPath })
}

const skillsLinks = async ({ rootDir, path }: SkillsLinksCliInput): Promise<SkillsLinksCliOutput> => {
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

const skillsInstructions = async ({
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

const skillsFrontmatter = async ({ rootDir, path }: SkillsFrontmatterCliInput): Promise<SkillsFrontmatterCliOutput> => {
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

const runSkills = async (input: unknown): Promise<SkillsCliOutput> => {
  const parsed = SkillsCliInputSchema.parse(input)

  switch (parsed.mode) {
    case 'catalog':
      return loadSkillCatalog(parsed.rootDir)
    case 'registry':
      return loadSkillRegistry(parsed.rootDir)
    case 'envelope':
      return skillsEnvelope(parsed)
    case 'validate':
      return skillsValidate(parsed)
    case 'links':
      return skillsLinks(parsed)
    case 'instructions':
      return skillsInstructions(parsed)
    case 'frontmatter':
      return skillsFrontmatter(parsed)
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
