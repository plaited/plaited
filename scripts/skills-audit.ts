import { basename, dirname, relative, resolve } from 'node:path'
import { parseMarkdownWithFrontmatter } from 'plaited/cli'
import * as z from 'zod'
import { SkillFrontMatterSchema } from '../src/factories/skills-factory/skills-factory.utils.ts'

type FrontmatterField = {
  key: string
  rawValue: string
}

type SkillLink = {
  line: number
  target: string
  classification: SkillLinkClassification
  resolvedPath?: string
}

type SkillLinkClassification = 'external' | 'inter-skill' | 'missing-target' | 'repo-outside-skills' | 'skill-local'

type SkillWarningCode =
  | 'broad-description'
  | 'directory-name-mismatch'
  | 'invalid-frontmatter'
  | 'link-outside-skills'
  | 'missing-description'
  | 'missing-frontmatter'
  | 'missing-name'
  | 'missing-target'
  | 'no-use-when-language'
  | 'vague-description'

type SkillWarning = {
  code: SkillWarningCode
  message: string
}

type SkillReport = {
  description?: string
  frontmatterKeys: string[]
  frontmatterPath: string
  links: SkillLink[]
  name?: string
  path: string
  title?: string
  triggerScore: number
  warnings: SkillWarning[]
}

type AuditSummary = {
  reports: SkillReport[]
  totals: {
    byLinkClassification: Record<SkillLinkClassification, number>
    skills: number
    warnings: number
  }
}

type SkillAuditInput = z.infer<typeof SkillAuditInputSchema>

const SkillAuditInputSchema = z.object({
  cwd: z.string().optional().describe('Override repository root; defaults to process.cwd()'),
  format: z.enum(['json', 'text']).optional().describe('Output format; defaults to text'),
})

const LINK_PATTERN = /\[[^\]]+\]\(([^)\s]+(?: [^)]+)?)\)/g
const DESCRIPTION_TRIGGER_PATTERN =
  /\b(use when|automatically invoked when|auto-invoked when|trigger|triggered when|when working on)\b/i
const DESCRIPTION_ACTION_PATTERN =
  /^(authentication|automates?|bootstrap|build|common|generate|modnet|optimize|search|transport-agnostic|tsdoc|type-aware|use)\b/i
const VAGUE_DESCRIPTION_PATTERN = /\b(help(?:s)?|guid(?:e|es)|reference|covers)\b/i
const BROAD_DESCRIPTION_PATTERN = /\b(anything|everything|general|misc|various|all tasks)\b/i
const ALLOWED_FRONTMATTER_KEYS = new Set(Object.keys(SkillFrontMatterSchema.shape))

export { SkillAuditInputSchema }
export type { AuditSummary, FrontmatterField, SkillLink, SkillLinkClassification, SkillReport, SkillWarning }

const isIndented = (line: string): boolean => /^\s+/.test(line)

const listSkillMarkdownFiles = async (rootDir: string): Promise<string[]> => {
  const files: string[] = []

  for await (const path of new Bun.Glob('skills/*/SKILL.md').scan({
    absolute: true,
    cwd: rootDir,
    onlyFiles: true,
  })) {
    files.push(path)
  }

  return files.sort()
}

const extractFrontmatter = (text: string): string | undefined => {
  const lines = text.split('\n')
  if (lines[0] !== '---') return undefined

  let endIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      endIndex = index
      break
    }
  }

  if (endIndex === -1) return undefined
  return lines.slice(1, endIndex).join('\n')
}

const parseFrontmatterFields = (frontmatter: string): FrontmatterField[] => {
  const fields: FrontmatterField[] = []
  const lines = frontmatter.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (!line.trim() || isIndented(line) || line.trimStart().startsWith('- ')) continue

    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trimStart()

    if (value === '>' || value === '|') {
      const blockLines: string[] = []
      for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
        const nextLine = lines[nextIndex] ?? ''
        if (!nextLine.trim()) {
          blockLines.push('')
          continue
        }
        if (!isIndented(nextLine)) break
        blockLines.push(nextLine.trim())
        index = nextIndex
      }
      fields.push({
        key,
        rawValue: value === '>' ? blockLines.join(' ').replace(/\s+/g, ' ').trim() : blockLines.join('\n').trim(),
      })
      continue
    }

    fields.push({
      key,
      rawValue: value,
    })
  }

  return fields
}

const formatFrontmatterValidationError = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`).join('; ')
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

const getTopLevelHeading = (text: string): string | undefined =>
  text
    .split('\n')
    .find((line) => line.startsWith('# ') && !line.startsWith('## '))
    ?.slice(2)
    .trim()

const classifyLink = async ({
  repoRoot,
  skillDir,
  target,
}: {
  repoRoot: string
  skillDir: string
  target: string
}): Promise<SkillLink> => {
  const [rawPath] = target.split('#')
  if (!rawPath || /^[a-z]+:/i.test(rawPath)) {
    return {
      line: 0,
      target,
      classification: 'external',
    }
  }

  const resolvedPath = resolve(skillDir, rawPath)
  const exists = await Bun.file(resolvedPath).exists()
  const relativeToSkill = relative(skillDir, resolvedPath)
  const relativeToRepo = relative(repoRoot, resolvedPath)

  if (!exists) {
    return {
      line: 0,
      target,
      classification: 'missing-target',
      resolvedPath,
    }
  }

  if (!relativeToSkill.startsWith('..') && relativeToSkill !== '') {
    return {
      line: 0,
      target,
      classification: 'skill-local',
      resolvedPath,
    }
  }

  if (!relativeToRepo.startsWith('..') && (relativeToRepo === 'skills' || relativeToRepo.startsWith('skills/'))) {
    return {
      line: 0,
      target,
      classification: 'inter-skill',
      resolvedPath,
    }
  }

  return {
    line: 0,
    target,
    classification: 'repo-outside-skills',
    resolvedPath,
  }
}

const collectLinks = async ({
  repoRoot,
  skillDir,
  text,
}: {
  repoRoot: string
  skillDir: string
  text: string
}): Promise<SkillLink[]> => {
  const links: SkillLink[] = []

  for (const [index, line] of text.split('\n').entries()) {
    const matches = [...line.matchAll(LINK_PATTERN)]
    for (const match of matches) {
      const target = match[1]
      if (!target) continue
      const link = await classifyLink({
        repoRoot,
        skillDir,
        target,
      })
      links.push({
        ...link,
        line: index + 1,
      })
    }
  }

  return links
}

const evaluateTriggerQuality = ({
  description,
  links,
  name,
  title,
}: {
  description?: string
  links: SkillLink[]
  name?: string
  title?: string
}): { triggerScore: number; warnings: SkillWarning[] } => {
  const warnings: SkillWarning[] = []
  let triggerScore = 5

  if (!name) {
    warnings.push({
      code: 'missing-name',
      message: 'Frontmatter is missing `name`.',
    })
    triggerScore -= 2
  }

  if (description) {
    if (!DESCRIPTION_TRIGGER_PATTERN.test(description) && !DESCRIPTION_ACTION_PATTERN.test(description)) {
      warnings.push({
        code: 'no-use-when-language',
        message: 'Description should include explicit trigger language such as `Use when ...`.',
      })
      triggerScore -= 1
    }

    if (description.length < 60 || !VAGUE_DESCRIPTION_PATTERN.test(description)) {
      triggerScore += 1
    }

    if (description.length < 35 || !/\b[A-Z][A-Za-z0-9.+/-]*\b/.test(description)) {
      warnings.push({
        code: 'vague-description',
        message: 'Description is terse or lacks concrete trigger terms that help routing.',
      })
      triggerScore -= 1
    }

    if (BROAD_DESCRIPTION_PATTERN.test(description)) {
      warnings.push({
        code: 'broad-description',
        message: 'Description is broad enough that it may overlap too many neighboring skills.',
      })
      triggerScore -= 1
    }
  } else {
    warnings.push({
      code: 'missing-description',
      message: 'Frontmatter is missing `description`.',
    })
    triggerScore -= 3
  }

  for (const link of links) {
    if (link.classification === 'repo-outside-skills') {
      warnings.push({
        code: 'link-outside-skills',
        message: `Link escapes skills/ and points to ${link.resolvedPath ?? link.target}.`,
      })
      triggerScore -= 1
    }

    if (link.classification === 'missing-target') {
      warnings.push({
        code: 'missing-target',
        message: `Linked target does not exist: ${link.target}.`,
      })
      triggerScore -= 1
    }
  }

  return {
    triggerScore: Math.max(0, Math.min(5, triggerScore)),
    warnings,
  }
}

const auditSkillFile = async ({ path, repoRoot }: { path: string; repoRoot: string }): Promise<SkillReport> => {
  const text = await Bun.file(path).text()
  const frontmatter = extractFrontmatter(text)
  const title = getTopLevelHeading(text)
  const links = await collectLinks({
    repoRoot,
    skillDir: resolve(path, '..'),
    text,
  })

  if (!frontmatter) {
    return {
      frontmatterKeys: [],
      frontmatterPath: relative(repoRoot, path),
      links,
      path: relative(repoRoot, path),
      title,
      triggerScore: 0,
      warnings: [
        {
          code: 'missing-frontmatter',
          message: 'SKILL.md is missing YAML frontmatter.',
        },
      ],
    }
  }

  const fields = parseFrontmatterFields(frontmatter)
  const fieldMap = new Map(fields.map((field) => [field.key, field.rawValue]))
  const unsupportedKeys = fields.map((field) => field.key).filter((key) => !ALLOWED_FRONTMATTER_KEYS.has(key))
  let parsedFrontmatter: ReturnType<typeof parseMarkdownWithFrontmatter<typeof SkillFrontMatterSchema>> | undefined
  let frontmatterError: unknown

  try {
    parsedFrontmatter = parseMarkdownWithFrontmatter(text, SkillFrontMatterSchema)
  } catch (error) {
    frontmatterError = error
  }

  const name = parsedFrontmatter?.frontmatter.name ?? fieldMap.get('name')
  const description = parsedFrontmatter?.frontmatter.description ?? fieldMap.get('description')
  const quality = evaluateTriggerQuality({
    description,
    links,
    name,
    title,
  })
  const warnings = [...quality.warnings]

  if (frontmatterError !== undefined) {
    warnings.unshift({
      code: 'invalid-frontmatter',
      message: `Frontmatter does not match SkillFrontMatterSchema: ${formatFrontmatterValidationError(frontmatterError)}`,
    })
  }

  if (unsupportedKeys.length > 0) {
    warnings.unshift({
      code: 'invalid-frontmatter',
      message: `Frontmatter includes unsupported keys: ${unsupportedKeys.join(', ')}`,
    })
  }

  if (parsedFrontmatter && basename(dirname(path)) !== parsedFrontmatter.frontmatter.name) {
    warnings.unshift({
      code: 'directory-name-mismatch',
      message: `Skill directory name '${basename(dirname(path))}' must match frontmatter name '${parsedFrontmatter.frontmatter.name}'.`,
    })
  }

  return {
    description,
    frontmatterKeys: fields.map((field) => field.key),
    frontmatterPath: relative(repoRoot, path),
    links,
    name,
    path: relative(repoRoot, path),
    title,
    triggerScore: quality.triggerScore,
    warnings,
  }
}

const createEmptyLinkCounts = (): Record<SkillLinkClassification, number> => ({
  external: 0,
  'inter-skill': 0,
  'missing-target': 0,
  'repo-outside-skills': 0,
  'skill-local': 0,
})

const auditSkills = async (rootDir: string): Promise<AuditSummary> => {
  const skillFiles = await listSkillMarkdownFiles(rootDir)
  const reports = await Promise.all(
    skillFiles.map((path) =>
      auditSkillFile({
        path,
        repoRoot: rootDir,
      }),
    ),
  )

  const byLinkClassification = createEmptyLinkCounts()
  let warningCount = 0

  for (const report of reports) {
    warningCount += report.warnings.length
    for (const link of report.links) {
      byLinkClassification[link.classification] += 1
    }
  }

  return {
    reports,
    totals: {
      byLinkClassification,
      skills: reports.length,
      warnings: warningCount,
    },
  }
}

const formatTextReport = (summary: AuditSummary): string => {
  const lines = [
    `skills audited: ${summary.totals.skills}`,
    `warnings: ${summary.totals.warnings}`,
    `links: ${Object.entries(summary.totals.byLinkClassification)
      .map(([classification, count]) => `${classification}=${count}`)
      .join(', ')}`,
    '',
  ]

  for (const report of summary.reports) {
    lines.push(`${report.path}  score=${report.triggerScore}/5`)
    lines.push(`  frontmatter: ${report.frontmatterKeys.join(', ') || '(missing)'}`)
    if (report.description) {
      lines.push(`  description: ${report.description}`)
    }
    if (report.warnings.length === 0) {
      lines.push('  warnings: none')
    } else {
      lines.push(...report.warnings.map((warning) => `  warning[${warning.code}]: ${warning.message}`))
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

const readInput = async (argv: string[]): Promise<SkillAuditInput> => {
  if (argv.includes('--help')) {
    console.log(
      [
        'skills-audit reviews `skills/*/SKILL.md` for link policy and trigger-quality metadata.',
        '',
        'Usage:',
        '  bun scripts/skills-audit.ts \'{"format":"json"}\'',
        '  bun scripts/skills-audit.ts',
      ].join('\n'),
    )
    return {
      format: 'text',
    }
  }

  if (argv.length === 0) return {}

  const firstArg = argv[0]
  if (!firstArg) return {}
  return SkillAuditInputSchema.parse(JSON.parse(firstArg))
}

const skillsAuditCli = async (argv: string[]): Promise<void> => {
  const input = await readInput(argv)
  if (argv.includes('--help')) return

  const rootDir = resolve(input.cwd ?? process.cwd())
  const summary = await auditSkills(rootDir)

  if (input.format === 'json') {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  console.log(formatTextReport(summary))
}

export {
  auditSkills,
  auditSkillFile,
  classifyLink,
  collectLinks,
  extractFrontmatter,
  formatTextReport,
  parseFrontmatterFields,
  skillsAuditCli,
}

if (import.meta.main) {
  await skillsAuditCli(Bun.argv.slice(2))
}
