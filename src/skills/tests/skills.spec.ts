import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import {
  findSkillDirectories,
  getSkillInstructionResourceLinks,
  loadSkillCatalog,
  loadSkillFrontmatter,
  loadSkillInstructions,
  skillsCatalog,
  skillsFrontmatter,
  skillsInstructions,
  skillsLinks,
  skillsValidate,
  validateSkill,
} from '../skills.ts'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

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
  frontmatterExtras,
  body,
}: {
  rootDir: string
  skillParentDir?: string
  dirName: string
  name: string
  description: string
  frontmatterExtras?: string
  body: string
}): Promise<string> => {
  const skillDir = join(rootDir, skillParentDir, dirName)
  await Bun.$`mkdir -p ${skillDir}`
  const extras = frontmatterExtras ? `${frontmatterExtras.trimEnd()}\n` : ''
  await Bun.write(
    join(skillDir, 'SKILL.md'),
    `---
name: ${name}
description: ${description}
${extras}---

${body}
`,
  )
  return skillDir
}

const createPlaitedFrontmatter = (capabilityYaml: string): string => `metadata:
  plaited:
    kind: generated-skill
    origin:
      kind: generated
      source:
        type: remote-mcp
        url: https://bun.com/docs/mcp
    capabilities:
${capabilityYaml}`

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

describe('loadSkillFrontmatter', () => {
  test('returns parsed frontmatter object for a valid skill', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'theta',
        name: 'theta',
        description: 'Theta description',
        body: 'Theta body content.',
      })

      const frontmatter = await loadSkillFrontmatter(rootDir, 'skills/theta')

      expect(frontmatter).toEqual({
        name: 'theta',
        description: 'Theta description',
      })
    })
  })

  test('returns undefined when skill markdown is missing or invalid', async () => {
    await withTempRoot(async (rootDir) => {
      const missing = await loadSkillFrontmatter(rootDir, 'skills/does-not-exist')
      expect(missing).toBeUndefined()

      const brokenDir = join(rootDir, 'skills', 'broken')
      await Bun.$`mkdir -p ${brokenDir}`
      await Bun.write(join(brokenDir, 'SKILL.md'), '# missing frontmatter')

      const invalid = await loadSkillFrontmatter(rootDir, 'skills/broken')
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
  test('skills CLI mode=catalog includes .agents/skills entries', async () => {
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

      const input = JSON.stringify({ mode: 'catalog', rootDir })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

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

  test('skillsInstructions returns body and structured errors', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'epsilon',
        name: 'epsilon',
        description: 'Epsilon description',
        body: 'Epsilon body.',
      })

      const success = await skillsInstructions({ rootDir, path: 'skills/epsilon' })
      expect(success).toEqual({
        body: 'Epsilon body.',
        errors: [],
      })

      const missing = await skillsInstructions({ rootDir, path: 'skills/missing' })
      expect(missing.body).toBeNull()
      expect(missing.errors).toEqual([
        {
          skillPath: join(rootDir, 'skills', 'missing', 'SKILL.md'),
          message: `Skill markdown not found: ${join(rootDir, 'skills', 'missing', 'SKILL.md')}`,
        },
      ])
    })
  })

  test('skillsFrontmatter returns frontmatter object and structured errors', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'zeta',
        name: 'zeta',
        description: 'Zeta description',
        body: 'Zeta body.',
      })

      const success = await skillsFrontmatter({ rootDir, path: 'skills/zeta' })
      expect(success).toEqual({
        frontmatter: {
          name: 'zeta',
          description: 'Zeta description',
        },
        errors: [],
      })

      const missing = await skillsFrontmatter({ rootDir, path: 'skills/missing' })
      expect(missing.frontmatter).toBeNull()
      expect(missing.errors).toEqual([
        {
          skillPath: join(rootDir, 'skills', 'missing', 'SKILL.md'),
          message: `Skill markdown not found: ${join(rootDir, 'skills', 'missing', 'SKILL.md')}`,
        },
      ])
    })
  })

  test('skills CLI mode=validate prints structured JSON output', async () => {
    await withTempRoot(async (rootDir) => {
      const skillDir = await writeSkillFile({
        rootDir,
        dirName: 'omega',
        name: 'omega',
        description: 'Omega description',
        body: 'Omega body.',
      })
      const skillPath = join(skillDir, 'SKILL.md')

      const input = JSON.stringify({ mode: 'validate', skillPath })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output).toEqual({ ok: true, errors: [] })
    })
  })

  test('skills CLI mode=instructions prints body output', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'kappa',
        name: 'kappa',
        description: 'Kappa description',
        body: 'Kappa body.',
      })

      const input = JSON.stringify({ mode: 'instructions', rootDir, path: 'skills/kappa' })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output).toEqual({
        body: 'Kappa body.',
        errors: [],
      })
    })
  })

  test('skills CLI mode=frontmatter prints frontmatter output', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'lambda',
        name: 'lambda',
        description: 'Lambda description',
        body: 'Lambda body.',
      })

      const input = JSON.stringify({ mode: 'frontmatter', rootDir, path: 'skills/lambda' })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output).toEqual({
        frontmatter: {
          name: 'lambda',
          description: 'Lambda description',
        },
        errors: [],
      })
    })
  })

  test('skills CLI mode=links exits with invalid input', async () => {
    const input = JSON.stringify({})
    const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

    expect(result.exitCode).toBe(2)
    expect(result.stderr.toString()).toContain('mode')
    expect(result.stderr.toString()).toContain('invalid_union')
  })

  test('skills CLI mode=registry reads metadata.plaited from SKILL.md frontmatter', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'search-bun-docs',
        name: 'search-bun-docs',
        description: 'Search Bun docs through MCP-backed tooling.',
        frontmatterExtras: createPlaitedFrontmatter(`      - id: docs.search
        type: cli
        lane: private
        phase: context
        audience: [analyst, coder]
        actions: [search, read]
        sideEffects: none
        handler:
          type: cli
          command: scripts/search.ts
        source:
          type: remote-mcp
          tool: search_bun`),
        body: 'Use to search Bun docs.',
      })

      const input = JSON.stringify({ mode: 'registry', rootDir })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.errors).toEqual([])
      expect(output.registry).toEqual([
        {
          skill: {
            name: 'search-bun-docs',
            description: 'Search Bun docs through MCP-backed tooling.',
            path: '/skills/search-bun-docs/SKILL.md',
          },
          origin: {
            kind: 'generated',
            source: {
              type: 'remote-mcp',
              url: 'https://bun.com/docs/mcp',
            },
          },
          capabilities: [
            {
              id: 'docs.search',
              address: 'search-bun-docs/docs.search',
              type: 'cli',
              lane: 'private',
              phase: 'context',
              audience: ['analyst', 'coder'],
              actions: ['search', 'read'],
              sideEffects: 'none',
              handler: {
                type: 'cli',
                command: 'scripts/search.ts',
              },
              source: {
                type: 'remote-mcp',
                tool: 'search_bun',
              },
            },
          ],
        },
      ])
    })
  })

  test('skills CLI mode=registry rejects non-cli capability types that declare a cli handler', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'search-bun-docs',
        name: 'search-bun-docs',
        description: 'Search Bun docs through MCP-backed tooling.',
        frontmatterExtras: createPlaitedFrontmatter(`      - id: docs.search
        type: service
        lane: private
        phase: context
        audience: [analyst]
        actions: [search]
        sideEffects: none
        handler:
          type: cli
          command: scripts/server.ts
        source:
          type: remote-mcp
          tool: search_bun`),
        body: 'Use to search Bun docs.',
      })

      const input = JSON.stringify({ mode: 'registry', rootDir })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.registry).toEqual([])
      expect(output.errors).toHaveLength(1)
      expect(output.errors[0]?.message).toContain('capabilities.0.type')
    })
  })

  test('skills CLI mode=registry reports manifest validation errors for invalid capability contracts', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'search-bun-docs',
        name: 'search-bun-docs',
        description: 'Search Bun docs through MCP-backed tooling.',
        frontmatterExtras: createPlaitedFrontmatter(`      - id: docs.search
        type: cli
        lane: privte
        phase: context
        audience: []
        actions: []
        sideEffects: none
        handler:
          type: cli
          command: ../scripts/search.ts
        source:
          type: remote-mcp
          tool: search_bun`),
        body: 'Use to search Bun docs.',
      })

      const input = JSON.stringify({ mode: 'registry', rootDir })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.registry).toEqual([])
      expect(output.errors).toHaveLength(1)
      const message = output.errors[0]?.message
      expect(message).toContain('capabilities.0.lane')
      expect(message).toContain('capabilities.0.audience')
      expect(message).toContain('capabilities.0.actions')
      expect(message).toContain('capabilities.0.handler.command')
    })
  })

  test('skills CLI mode=registry rejects handler.command values that are command lines instead of paths', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'search-bun-docs',
        name: 'search-bun-docs',
        description: 'Search Bun docs through MCP-backed tooling.',
        frontmatterExtras: createPlaitedFrontmatter(`      - id: docs.search
        type: cli
        lane: private
        phase: context
        audience: [analyst]
        actions: [search]
        sideEffects: none
        handler:
          type: cli
          command: scripts/search.ts --flag
        source:
          type: remote-mcp
          tool: search_bun`),
        body: 'Use to search Bun docs.',
      })

      const input = JSON.stringify({ mode: 'registry', rootDir })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.registry).toEqual([])
      expect(output.errors).toHaveLength(1)
      expect(output.errors[0]?.message).toContain('capabilities.0.handler.command')
    })
  })

  test('skills CLI mode=registry reports manifest validation errors for invalid capability phase values', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'search-bun-docs',
        name: 'search-bun-docs',
        description: 'Search Bun docs through MCP-backed tooling.',
        frontmatterExtras: createPlaitedFrontmatter(`      - id: docs.search
        type: cli
        lane: private
        phase: planning
        audience: [analyst]
        actions: [search]
        sideEffects: none
        handler:
          type: cli
          command: scripts/search.ts
        source:
          type: remote-mcp
          tool: search_bun`),
        body: 'Use to search Bun docs.',
      })

      const input = JSON.stringify({ mode: 'registry', rootDir })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.registry).toEqual([])
      expect(output.errors).toHaveLength(1)
      expect(output.errors[0]?.message).toContain('capabilities.0.phase')
    })
  })

  test('skills CLI mode=registry reports manifest validation errors for invalid capability type values', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'search-bun-docs',
        name: 'search-bun-docs',
        description: 'Search Bun docs through MCP-backed tooling.',
        frontmatterExtras: createPlaitedFrontmatter(`      - id: docs.search
        type: magic
        lane: private
        phase: context
        audience: [analyst]
        actions: [search]
        sideEffects: none
        handler:
          type: cli
          command: scripts/search.ts
        source:
          type: remote-mcp
          tool: search_bun`),
        body: 'Use to search Bun docs.',
      })

      const input = JSON.stringify({ mode: 'registry', rootDir })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.registry).toEqual([])
      expect(output.errors).toHaveLength(1)
      expect(output.errors[0]?.message).toContain('capabilities.0.type')
    })
  })

  test('skills CLI mode=registry reports manifest validation errors for invalid capability sideEffects values', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'search-bun-docs',
        name: 'search-bun-docs',
        description: 'Search Bun docs through MCP-backed tooling.',
        frontmatterExtras: createPlaitedFrontmatter(`      - id: docs.search
        type: cli
        lane: private
        phase: context
        audience: [analyst]
        actions: [search]
        sideEffects: maybe-writes
        handler:
          type: cli
          command: scripts/search.ts
        source:
          type: remote-mcp
          tool: search_bun`),
        body: 'Use to search Bun docs.',
      })

      const input = JSON.stringify({ mode: 'registry', rootDir })
      const result = await Bun.$`bun ./bin/plaited.ts skills ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.registry).toEqual([])
      expect(output.errors).toHaveLength(1)
      expect(output.errors[0]?.message).toContain('capabilities.0.sideEffects')
    })
  })
})
