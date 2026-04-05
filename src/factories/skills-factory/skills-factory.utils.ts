import { basename, dirname, normalize, resolve } from 'node:path'
import { Glob } from 'bun'
import * as z from 'zod'
import { extractLocalLinksFromMarkdown, parseMarkdownWithFrontmatter } from '../../cli.ts'

const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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

export type SkillFrontMatter = z.infer<typeof SkillFrontMatterSchema>

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

export const skillsGlobPattern = '**/skills/*/SKILL.md'

export const findSkillDirectories = async (rootDir: string): Promise<string[]> => {
  const skillDirs: string[] = []
  const glob = new Glob(skillsGlobPattern)

  for await (const file of glob.scan({ cwd: rootDir, absolute: true })) {
    const skillDir = file.replace(/\/SKILL\.md$/i, '')
    skillDirs.push(skillDir)
  }

  return skillDirs.sort()
}
