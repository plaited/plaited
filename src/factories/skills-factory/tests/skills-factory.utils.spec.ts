import { afterEach, describe, expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  findSkillDirectories,
  isValidSkill,
  SkillFrontMatterSchema,
  validateSkillLocalLinks,
} from '../skills-factory.utils.ts'

describe('SkillFrontMatterSchema', () => {
  test('accepts required and optional AgentSkills frontmatter fields', () => {
    const result = SkillFrontMatterSchema.parse({
      name: 'search-bun-docs',
      description: 'Search the Bun documentation.',
      license: 'ISC',
      compatibility: 'Requires bun and network access',
      'allowed-tools': 'Bash Read Write',
      metadata: {
        owner: 'docs',
      },
    })

    expect(result.name).toBe('search-bun-docs')
    expect(result['allowed-tools']).toBe('Bash Read Write')
    expect(result.metadata).toEqual({ owner: 'docs' })
  })

  test('rejects missing required fields', () => {
    expect(() =>
      SkillFrontMatterSchema.parse({
        description: 'Missing name',
      }),
    ).toThrow()
  })

  test('rejects non-string metadata values', () => {
    expect(() =>
      SkillFrontMatterSchema.parse({
        name: 'typed-metadata',
        description: 'Metadata must stay string typed',
        metadata: {
          count: 3,
        },
      }),
    ).toThrow()
  })

  test('rejects allowed-tools when it is not a space-delimited string', () => {
    expect(() =>
      SkillFrontMatterSchema.parse({
        name: 'bad-tools',
        description: 'Wrong allowed-tools format',
        'allowed-tools': ['Bash', 'Read'],
      }),
    ).toThrow()
  })

  test('rejects names that violate the documented pattern', () => {
    expect(() =>
      SkillFrontMatterSchema.parse({
        name: 'Bad_Skill',
        description: 'Invalid skill name',
      }),
    ).toThrow()
  })
})

describe('isValidSkill', () => {
  afterEach(() => {
    mock.restore()
  })

  test('returns true for valid SKILL.md content', () => {
    const markdown = `---
name: search-bun-docs
description: Search the Bun documentation.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash Read Write
metadata:
  owner: docs
---

# Search Bun Docs
`

    expect(isValidSkill(markdown)).toBe(true)
  })

  test('returns false when frontmatter is missing', () => {
    expect(isValidSkill('# No frontmatter')).toBe(false)
  })

  test('returns false and logs a useful error for invalid frontmatter', () => {
    const loggedMessages: string[] = []
    const consoleError = mock((message?: unknown) => {
      loggedMessages.push(String(message))
    })
    console.error = consoleError

    const markdown = `---
name: invalid-skill
description: Broken metadata
metadata:
  count: 3
---

Body.
`

    expect(isValidSkill(markdown)).toBe(false)
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(loggedMessages[0]).toContain('Invalid skill frontmatter')
    expect(loggedMessages[0]).toContain('metadata.count')
  })

  test('returns false when the skill body is empty', () => {
    expect(
      isValidSkill(`---
name: search-bun-docs
description: Search the Bun documentation.
---`),
    ).toBe(false)
  })

  test('returns false when the directory name does not match the skill name', () => {
    const loggedMessages: string[] = []
    const consoleError = mock((message?: unknown) => {
      loggedMessages.push(String(message))
    })
    console.error = consoleError

    const markdown = `---
name: search-bun-docs
description: Search the Bun documentation.
---

Body.
`

    expect(isValidSkill(markdown, { skillPath: '/tmp/not-the-skill-name/SKILL.md' })).toBe(false)
    expect(loggedMessages[0]).toContain("directory name 'not-the-skill-name'")
  })
})

describe('validateSkillLocalLinks', () => {
  let tempDir: string | undefined

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  test('reports present and missing local link targets', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skills-factory-utils-'))
    mkdirSync(join(tempDir, 'references'), { recursive: true })
    mkdirSync(join(tempDir, 'assets'), { recursive: true })
    await Bun.write(join(tempDir, 'references', 'setup.md'), '# Setup')
    await Bun.write(join(tempDir, 'assets', 'diagram.png'), 'png')

    const validation = await validateSkillLocalLinks({
      skillDir: tempDir,
      markdownBody: `
See [setup](references/setup.md), ![diagram](assets/diagram.png), and [missing](scripts/build.ts).
`,
    })

    expect(validation.present).toEqual(['assets/diagram.png', 'references/setup.md'])
    expect(validation.missing).toEqual(['scripts/build.ts'])
  })
})

describe('findSkillDirectories', () => {
  let tempDir: string | undefined

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  test('finds skill directories matching the skills glob pattern', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skills-factory-utils-'))
    const alphaDir = join(tempDir, 'packages', 'skills', 'alpha-skill')
    const betaDir = join(tempDir, 'vendor', 'skills', 'beta-skill')

    mkdirSync(alphaDir, { recursive: true })
    mkdirSync(betaDir, { recursive: true })

    await Bun.write(join(alphaDir, 'SKILL.md'), '---\nname: alpha-skill\ndescription: Alpha\n---\n')
    await Bun.write(join(betaDir, 'SKILL.md'), '---\nname: beta-skill\ndescription: Beta\n---\n')

    const skillDirs = await findSkillDirectories(tempDir)

    expect(skillDirs).toEqual([alphaDir, betaDir])
  })

  test('returns sorted directories', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skills-factory-utils-'))
    const zebraDir = join(tempDir, 'zeta', 'skills', 'zebra')
    const alphaDir = join(tempDir, 'alpha', 'skills', 'alpha')

    mkdirSync(zebraDir, { recursive: true })
    mkdirSync(alphaDir, { recursive: true })

    await Bun.write(join(zebraDir, 'SKILL.md'), '---\nname: zebra\ndescription: Zebra\n---\n')
    await Bun.write(join(alphaDir, 'SKILL.md'), '---\nname: alpha\ndescription: Alpha\n---\n')

    const skillDirs = await findSkillDirectories(tempDir)

    expect(skillDirs).toEqual([alphaDir, zebraDir])
  })
})
