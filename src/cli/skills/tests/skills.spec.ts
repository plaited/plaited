import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import {
  findSkillDirectories,
  getSkillInstructionResourceLinks,
  isValidSkill,
  loadSkillCatalog,
  loadSkillInstructions,
  skillsCatalog,
  skillsLinks,
  skillsValidate,
  validateSkill,
  validateSkillLocalLinks,
} from '../skills.ts'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../../')

const createTempRoot = (): string =>
  join('/tmp', `plaited-skill-tests-${Date.now()}-${Math.random().toString(16).slice(2)}`)

const withTempRoot = async (run: (rootDir: string) => Promise<void>): Promise<void> => {
  const rootDir = createTempRoot()
  await Bun.$`mkdir -p ${rootDir}`

  try {
    await run(rootDir)
  } finally {
    await Bun.$`rm -rf ${rootDir}`
  }
}

const writeSkillFile = async ({
  rootDir,
  skillParentDir = 'skills',
  dirName,
  name,
  description,
  body,
}: {
  rootDir: string
  skillParentDir?: string
  dirName: string
  name: string
  description: string
  body: string
}): Promise<string> => {
  const skillDir = join(rootDir, skillParentDir, dirName)
  await Bun.$`mkdir -p ${skillDir}`
  await Bun.write(
    join(skillDir, 'SKILL.md'),
    `---
name: ${name}
description: ${description}
---

${body}
`,
  )
  return skillDir
}

describe('findSkillDirectories', () => {
  test('finds and sorts skill directories, including .agents/skills', async () => {
    await withTempRoot(async (rootDir) => {
      const alpha = join(rootDir, 'nested', 'skills', 'alpha')
      const local = join(rootDir, '.agents', 'skills', 'local')
      const zeta = join(rootDir, 'skills', 'zeta')
      await Bun.$`mkdir -p ${alpha} ${zeta} ${local}`
      await Bun.write(join(alpha, 'SKILL.md'), '---\nname: alpha\ndescription: Alpha\n---\n\nBody\n')
      await Bun.write(join(zeta, 'SKILL.md'), '---\nname: zeta\ndescription: Zeta\n---\n\nBody\n')
      await Bun.write(join(local, 'SKILL.md'), '---\nname: local\ndescription: Local\n---\n\nBody\n')

      const skillDirs = await findSkillDirectories(rootDir)

      expect(skillDirs).toEqual([alpha, local, zeta].sort())
    })
  })
})

describe('validateSkill', () => {
  test('returns structured errors for invalid markdown', () => {
    expect(validateSkill('# no frontmatter')).toEqual({
      ok: false,
      errors: ['Invalid skill frontmatter: Missing YAML frontmatter'],
    })
  })
})

describe('isValidSkill', () => {
  test('returns true for valid markdown and matching directory name', () => {
    const markdown = `---
name: sample-skill
description: Sample
---

Hello
`
    const isValid = isValidSkill(markdown, {
      skillPath: '/tmp/workspace/skills/sample-skill/SKILL.md',
    })

    expect(isValid).toBeTrue()
  })

  test('returns false when directory name does not match skill name', () => {
    const markdown = `---
name: sample-skill
description: Sample
---

Hello
`
    const isValid = isValidSkill(markdown, {
      skillPath: '/tmp/workspace/skills/not-sample/SKILL.md',
    })

    expect(isValid).toBeFalse()
  })

  test('returns false for invalid markdown', () => {
    expect(isValidSkill('# no frontmatter')).toBeFalse()
  })
})

describe('validateSkillLocalLinks', () => {
  test('returns present and missing sets with link value and text', async () => {
    const uniqueId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const skillDir = join('/tmp', `plaited-skill-links-${uniqueId}`)

    await Bun.$`mkdir -p ${join(skillDir, 'references')} ${join(skillDir, 'scripts')}`
    await Bun.write(join(skillDir, 'references', 'setup.md'), '# setup')
    await Bun.write(join(skillDir, 'scripts', 'run.ts'), 'export {}\n')

    const links = await validateSkillLocalLinks({
      skillDir,
      markdownBody: `
See [setup guide](references/setup.md) and [missing doc](references/missing.md).
![diagram](assets/diagram.png)
[](<scripts/run.ts>)
`,
    })

    expect(links.present).toBeInstanceOf(Set)
    expect(links.missing).toBeInstanceOf(Set)
    expect([...links.present]).toEqual([
      { value: 'references/setup.md', text: 'setup guide' },
      { value: 'scripts/run.ts', text: 'scripts/run.ts' },
    ])
    expect([...links.missing]).toEqual([
      { value: 'assets/diagram.png', text: 'diagram' },
      { value: 'references/missing.md', text: 'missing doc' },
    ])

    await Bun.$`rm -rf ${skillDir}`
  })
})

describe('loadSkillCatalog', () => {
  test('includes both skills/* and .agents/skills/* entries from rootDir', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        skillParentDir: 'skills',
        dirName: 'alpha',
        name: 'alpha',
        description: 'Alpha description',
        body: 'Alpha body.',
      })
      await writeSkillFile({
        rootDir,
        skillParentDir: '.agents/skills',
        dirName: 'local',
        name: 'local',
        description: 'Local description',
        body: 'Local body.',
      })

      const result = await loadSkillCatalog(rootDir)

      expect(result.errors).toEqual([])
      expect(result.catalog).toEqual([
        {
          name: 'alpha',
          description: 'Alpha description',
          path: '/skills/alpha/SKILL.md',
        },
        {
          name: 'local',
          description: 'Local description',
          path: '/.agents/skills/local/SKILL.md',
        },
      ])
    })
  })

  test('returns valid catalog entries with paths and invalid entries as errors', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'alpha',
        name: 'alpha',
        description: 'Alpha description',
        body: 'Alpha body.',
      })

      const brokenDir = join(rootDir, 'skills', 'broken')
      await Bun.$`mkdir -p ${brokenDir}`
      await Bun.write(join(brokenDir, 'SKILL.md'), '# missing frontmatter')

      const result = await loadSkillCatalog(rootDir)

      expect(result.catalog).toEqual([
        {
          name: 'alpha',
          description: 'Alpha description',
          path: '/skills/alpha/SKILL.md',
        },
      ])
      expect(result.errors).toEqual([
        {
          path: '/skills/broken/SKILL.md',
          message: 'Invalid skill frontmatter: Missing YAML frontmatter',
        },
      ])
    })
  })
})

describe('loadSkillInstructions', () => {
  test('returns markdown body for a valid skill', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'gamma',
        name: 'gamma',
        description: 'Gamma description',
        body: 'Gamma body content.',
      })

      const body = await loadSkillInstructions(rootDir, 'skills/gamma')

      expect(body).toBe('Gamma body content.')
    })
  })

  test('returns undefined when skill markdown is missing or invalid', async () => {
    await withTempRoot(async (rootDir) => {
      const missing = await loadSkillInstructions(rootDir, 'skills/does-not-exist')
      expect(missing).toBeUndefined()

      const brokenDir = join(rootDir, 'skills', 'broken')
      await Bun.$`mkdir -p ${brokenDir}`
      await Bun.write(join(brokenDir, 'SKILL.md'), '# missing frontmatter')

      const invalid = await loadSkillInstructions(rootDir, 'skills/broken')
      expect(invalid).toBeUndefined()
    })
  })
})

describe('getSkillInstructionResourceLinks', () => {
  test('returns links and empty errors for valid skills', async () => {
    await withTempRoot(async (rootDir) => {
      const skillDir = await writeSkillFile({
        rootDir,
        dirName: 'delta',
        name: 'delta',
        description: 'Delta description',
        body: 'See [setup](references/setup.md) and [missing](references/missing.md).',
      })
      await Bun.$`mkdir -p ${join(skillDir, 'references')}`
      await Bun.write(join(skillDir, 'references', 'setup.md'), '# setup')

      const result = await getSkillInstructionResourceLinks(rootDir, 'skills/delta')

      expect(result).toBeDefined()
      expect(result?.errors).toEqual([])
      expect(result ? [...result.links.present] : []).toEqual([{ value: 'references/setup.md', text: 'setup' }])
      expect(result ? [...result.links.missing] : []).toEqual([{ value: 'references/missing.md', text: 'missing' }])
    })
  })

  test('returns validation errors and empty links for invalid skill markdown', async () => {
    await withTempRoot(async (rootDir) => {
      const brokenDir = join(rootDir, 'skills', 'broken')
      await Bun.$`mkdir -p ${brokenDir}`
      await Bun.write(join(brokenDir, 'SKILL.md'), '# missing frontmatter')

      const result = await getSkillInstructionResourceLinks(rootDir, 'skills/broken')

      expect(result).toBeDefined()
      expect(result?.errors).toEqual([
        {
          skillPath: join(rootDir, 'skills', 'broken', 'SKILL.md'),
          message: 'Invalid skill frontmatter: Missing YAML frontmatter',
        },
      ])
      expect(result ? [...result.links.present] : []).toEqual([])
      expect(result ? [...result.links.missing] : []).toEqual([])
    })
  })
})

describe('skills CLI commands', () => {
  test('skills-catalog CLI handler includes .agents/skills entries', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        skillParentDir: 'skills',
        dirName: 'alpha',
        name: 'alpha',
        description: 'Alpha description',
        body: 'Alpha body.',
      })
      await writeSkillFile({
        rootDir,
        skillParentDir: '.agents/skills',
        dirName: 'local',
        name: 'local',
        description: 'Local description',
        body: 'Local body.',
      })

      const script = "import { skillsCatalogCli } from './src/cli.ts'; await skillsCatalogCli(process.argv.slice(1));"
      const input = JSON.stringify({ rootDir })
      const result = await Bun.$`bun -e ${script} -- ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.errors).toEqual([])
      expect(output.catalog).toEqual([
        {
          name: 'alpha',
          description: 'Alpha description',
          path: '/skills/alpha/SKILL.md',
        },
        {
          name: 'local',
          description: 'Local description',
          path: '/.agents/skills/local/SKILL.md',
        },
      ])
    })
  })

  test('skillsCatalog returns catalog and validation errors', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'alpha',
        name: 'alpha',
        description: 'Alpha description',
        body: 'Alpha body.',
      })

      const brokenDir = join(rootDir, 'skills', 'broken')
      await Bun.$`mkdir -p ${brokenDir}`
      await Bun.write(join(brokenDir, 'SKILL.md'), '# missing frontmatter')

      const result = await skillsCatalog({ rootDir })

      expect(result.catalog).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.message).toContain('Missing YAML frontmatter')
    })
  })

  test('skillsValidate returns structured result for missing files', async () => {
    const skillPath = join('/tmp', `plaited-missing-skill-${Date.now()}`, 'SKILL.md')
    const result = await skillsValidate({ skillPath })

    expect(result.ok).toBeFalse()
    expect(result.errors[0]).toContain('Skill markdown not found')
  })

  test('skillsLinks returns JSON arrays instead of sets', async () => {
    await withTempRoot(async (rootDir) => {
      const skillDir = await writeSkillFile({
        rootDir,
        dirName: 'delta',
        name: 'delta',
        description: 'Delta description',
        body: 'See [setup](references/setup.md) and [missing](references/missing.md).',
      })
      await Bun.$`mkdir -p ${join(skillDir, 'references')}`
      await Bun.write(join(skillDir, 'references', 'setup.md'), '# setup')

      const result = await skillsLinks({ rootDir, path: 'skills/delta' })

      expect(Array.isArray(result.links.present)).toBeTrue()
      expect(Array.isArray(result.links.missing)).toBeTrue()
      expect(result.errors).toEqual([])
      expect(result.links.present).toEqual([{ value: 'references/setup.md', text: 'setup' }])
      expect(result.links.missing).toEqual([{ value: 'references/missing.md', text: 'missing' }])
    })
  })

  test('skills-validate CLI handler prints structured JSON output', async () => {
    await withTempRoot(async (rootDir) => {
      const skillDir = await writeSkillFile({
        rootDir,
        dirName: 'omega',
        name: 'omega',
        description: 'Omega description',
        body: 'Omega body.',
      })
      const skillPath = join(skillDir, 'SKILL.md')

      const script = "import { skillsValidateCli } from './src/cli.ts'; await skillsValidateCli(process.argv.slice(1));"
      const input = JSON.stringify({ skillPath })
      const result = await Bun.$`bun -e ${script} -- ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output).toEqual({ ok: true, errors: [] })
    })
  })

  test('skills-links CLI handler exits with invalid input', async () => {
    const script = "import { skillsLinksCli } from './src/cli.ts'; await skillsLinksCli(process.argv.slice(1));"
    const input = JSON.stringify({})
    const result = await Bun.$`bun -e ${script} -- ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

    expect(result.exitCode).toBe(2)
    expect(result.stderr.toString()).toContain('rootDir')
    expect(result.stderr.toString()).toContain('path')
  })
})
