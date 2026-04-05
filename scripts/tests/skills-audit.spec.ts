import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  auditSkills,
  classifyLink,
  extractFrontmatter,
  formatTextReport,
  parseFrontmatterFields,
} from '../skills-audit.ts'

const createTempRepo = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'skills-audit-'))
  await mkdir(join(root, 'skills'), { recursive: true })
  await Bun.write(join(root, 'skills', '.keep'), '')
  return root
}

const writeSkill = async ({
  description,
  extraBody = '',
  name,
  root,
  skill,
}: {
  description: string
  extraBody?: string
  name: string
  root: string
  skill: string
}): Promise<void> => {
  const skillDir = join(root, 'skills', skill)
  await mkdir(skillDir, { recursive: true })
  await Bun.write(join(skillDir, '.keep'), '')
  await rm(join(skillDir, '.keep'))
  await Bun.write(
    join(skillDir, 'SKILL.md'),
    ['---', `name: ${name}`, `description: ${description}`, '---', '', `# ${name}`, '', extraBody, ''].join('\n'),
  )
}

describe('extractFrontmatter', () => {
  test('returns the frontmatter block', () => {
    const frontmatter = extractFrontmatter(
      ['---', 'name: test-skill', 'description: Use when testing.', '---'].join('\n'),
    )

    expect(frontmatter).toContain('name: test-skill')
  })
})

describe('parseFrontmatterFields', () => {
  test('parses scalar and folded description fields', () => {
    const fields = parseFrontmatterFields(
      [
        'name: youdotcom',
        'description: >',
        '  Use You.com when cited research is needed.',
        '  Include trigger terms.',
        'metadata:',
        '  version: 1.0.0',
      ].join('\n'),
    )

    expect(fields).toEqual([
      { key: 'name', rawValue: 'youdotcom' },
      {
        key: 'description',
        rawValue: 'Use You.com when cited research is needed. Include trigger terms.',
      },
      { key: 'metadata', rawValue: '' },
    ])
  })
})

describe('classifyLink', () => {
  test('classifies local, inter-skill, and outside-skills links', async () => {
    const root = await createTempRepo()
    try {
      await mkdir(join(root, 'skills', 'alpha', 'references'), { recursive: true })
      await mkdir(join(root, 'skills', 'beta'), { recursive: true })
      await mkdir(join(root, 'docs'), { recursive: true })
      await Bun.write(join(root, 'skills', 'alpha', 'references', 'guide.md'), '# guide')
      await Bun.write(join(root, 'skills', 'beta', 'SKILL.md'), '# beta')
      await Bun.write(join(root, 'docs', 'guide.md'), '# docs')

      const skillDir = join(root, 'skills', 'alpha')
      const local = await classifyLink({ repoRoot: root, skillDir, target: 'references/guide.md' })
      const inter = await classifyLink({ repoRoot: root, skillDir, target: '../beta/SKILL.md' })
      const outside = await classifyLink({ repoRoot: root, skillDir, target: '../../docs/guide.md' })

      expect(local.classification).toBe('skill-local')
      expect(inter.classification).toBe('inter-skill')
      expect(outside.classification).toBe('repo-outside-skills')
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})

describe('auditSkills', () => {
  test('reports warnings for weak descriptions and links outside skills', async () => {
    const root = await createTempRepo()
    try {
      await mkdir(join(root, 'docs'), { recursive: true })
      await writeSkill({
        root,
        skill: 'alpha',
        name: 'alpha',
        description: 'General helper.',
        extraBody: '[Docs](../../docs/spec.md)',
      })
      await Bun.write(join(root, 'docs', 'spec.md'), '# spec')

      await writeSkill({
        root,
        skill: 'beta',
        name: 'beta',
        description: 'Use when editing Bun tooling and agent routing behavior.',
        extraBody: '[Alpha](../alpha/SKILL.md)',
      })

      const summary = await auditSkills(root)
      const alpha = summary.reports.find((report) => report.name === 'alpha')
      const beta = summary.reports.find((report) => report.name === 'beta')

      expect(alpha?.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'no-use-when-language' }),
          expect.objectContaining({ code: 'vague-description' }),
          expect.objectContaining({ code: 'link-outside-skills' }),
        ]),
      )
      expect(beta?.warnings).toEqual([])
      expect(summary.totals.byLinkClassification['inter-skill']).toBe(1)
      expect(summary.totals.byLinkClassification['repo-outside-skills']).toBe(1)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  test('formats a readable text report', async () => {
    const root = await createTempRepo()
    try {
      await writeSkill({
        root,
        skill: 'alpha',
        name: 'alpha',
        description: 'Use when auditing skill frontmatter and links.',
      })

      const summary = await auditSkills(root)
      const text = formatTextReport(summary)

      expect(text).toContain('skills audited: 1')
      expect(text).toContain('skills/alpha/SKILL.md')
      expect(text).toContain('warnings: none')
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  test('reports invalid frontmatter when unsupported keys are present', async () => {
    const root = await createTempRepo()
    try {
      const skillDir = join(root, 'skills', 'alpha')
      await mkdir(skillDir, { recursive: true })
      await Bun.write(
        join(skillDir, 'SKILL.md'),
        [
          '---',
          'name: alpha',
          'description: Use when auditing invalid frontmatter.',
          'assets:',
          '  - schema.json',
          '---',
          '',
          '# alpha',
          '',
          'Body.',
          '',
        ].join('\n'),
      )

      const summary = await auditSkills(root)
      const report = summary.reports[0]

      expect(report?.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'invalid-frontmatter' })]),
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})
