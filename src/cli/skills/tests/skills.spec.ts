import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  findSkillDirectories,
  getSkillInstructionResourceLinks,
  isValidSkill,
  loadSkillCatalog,
  loadSkillInstructions,
  validateSkillLocalLinks,
} from '../skills.ts'

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
  dirName,
  name,
  description,
  body,
}: {
  rootDir: string
  dirName: string
  name: string
  description: string
  body: string
}): Promise<string> => {
  const skillDir = join(rootDir, 'skills', dirName)
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
  test('finds and sorts skill directories', async () => {
    await withTempRoot(async (rootDir) => {
      const alpha = join(rootDir, 'nested', 'skills', 'alpha')
      const zeta = join(rootDir, 'skills', 'zeta')
      await Bun.$`mkdir -p ${alpha} ${zeta}`
      await Bun.write(join(alpha, 'SKILL.md'), '---\nname: alpha\ndescription: Alpha\n---\n\nBody\n')
      await Bun.write(join(zeta, 'SKILL.md'), '---\nname: zeta\ndescription: Zeta\n---\n\nBody\n')

      const skillDirs = await findSkillDirectories(rootDir)

      expect(skillDirs).toEqual([alpha, zeta].sort())
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
          message: 'Invalid skill markdown',
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
        { skillPath: join(rootDir, 'skills', 'broken', 'SKILL.md'), message: 'Invalid skill markdown' },
      ])
      expect(result ? [...result.links.present] : []).toEqual([])
      expect(result ? [...result.links.missing] : []).toEqual([])
    })
  })
})
