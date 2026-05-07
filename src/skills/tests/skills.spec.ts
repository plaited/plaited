import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'

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

const createFirstPartyPlaitedFrontmatter = (capabilityYaml: string): string => `metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
${capabilityYaml}`

const runSkillsCommand = async (input: unknown) =>
  Bun.$`bun ./bin/plaited.ts skills ${JSON.stringify(input)}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

describe('skills CLI commands', () => {
  test('skills CLI mode=catalog includes .agents/skills entries', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        skillParentDir: 'nested/skills',
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

      const result = await runSkillsCommand({ mode: 'catalog', rootDir })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.errors).toEqual([])
      expect(output.catalog).toEqual([
        {
          name: 'alpha',
          description: 'Alpha description',
          path: '/nested/skills/alpha/SKILL.md',
        },
        {
          name: 'local',
          description: 'Local description',
          path: '/.agents/skills/local/SKILL.md',
        },
      ])
    })
  })

  test('skills CLI mode=catalog returns catalog and validation errors', async () => {
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

      const result = await runSkillsCommand({ mode: 'catalog', rootDir })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.catalog).toHaveLength(1)
      expect(output.errors).toHaveLength(1)
      expect(output.errors[0]?.message).toContain('Missing YAML frontmatter')
    })
  })

  test('skills CLI mode=validate returns structured result for missing files', async () => {
    const skillPath = join('/tmp', `plaited-missing-skill-${Date.now()}`, 'SKILL.md')
    const result = await runSkillsCommand({ mode: 'validate', skillPath })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.ok).toBeFalse()
    expect(output.errors[0]).toContain('Skill markdown not found')
  })

  test('skills CLI mode=links returns JSON arrays instead of sets', async () => {
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

      const result = await runSkillsCommand({ mode: 'links', rootDir, path: 'skills/delta' })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(Array.isArray(output.links.present)).toBeTrue()
      expect(Array.isArray(output.links.missing)).toBeTrue()
      expect(output.errors).toEqual([])
      expect(output.links.present).toEqual([{ value: 'references/setup.md', text: 'setup' }])
      expect(output.links.missing).toEqual([{ value: 'references/missing.md', text: 'missing' }])
    })
  })

  test('skills CLI mode=instructions returns body and structured errors', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'epsilon',
        name: 'epsilon',
        description: 'Epsilon description',
        body: 'Epsilon body.',
      })

      const success = await runSkillsCommand({ mode: 'instructions', rootDir, path: 'skills/epsilon' })
      expect(success.exitCode).toBe(0)
      expect(JSON.parse(success.stdout.toString().trim())).toEqual({
        body: 'Epsilon body.',
        errors: [],
      })

      const missing = await runSkillsCommand({ mode: 'instructions', rootDir, path: 'skills/missing' })
      expect(missing.exitCode).toBe(0)
      const output = JSON.parse(missing.stdout.toString().trim())
      expect(output.body).toBeNull()
      expect(output.errors).toEqual([
        {
          skillPath: join(rootDir, 'skills', 'missing', 'SKILL.md'),
          message: `Skill markdown not found: ${join(rootDir, 'skills', 'missing', 'SKILL.md')}`,
        },
      ])
    })
  })

  test('skills CLI mode=frontmatter returns frontmatter object and structured errors', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'zeta',
        name: 'zeta',
        description: 'Zeta description',
        body: 'Zeta body.',
      })

      const success = await runSkillsCommand({ mode: 'frontmatter', rootDir, path: 'skills/zeta' })
      expect(success.exitCode).toBe(0)
      expect(JSON.parse(success.stdout.toString().trim())).toEqual({
        frontmatter: {
          name: 'zeta',
          description: 'Zeta description',
        },
        errors: [],
      })

      const missing = await runSkillsCommand({ mode: 'frontmatter', rootDir, path: 'skills/missing' })
      expect(missing.exitCode).toBe(0)
      const output = JSON.parse(missing.stdout.toString().trim())
      expect(output.frontmatter).toBeNull()
      expect(output.errors).toEqual([
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

      const result = await runSkillsCommand({ mode: 'validate', skillPath })

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

      const result = await runSkillsCommand({ mode: 'instructions', rootDir, path: 'skills/kappa' })

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

      const result = await runSkillsCommand({ mode: 'frontmatter', rootDir, path: 'skills/lambda' })

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
    const result = await runSkillsCommand({})

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

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

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

  test('skills CLI mode=registry reads first-party workflow metadata without a handler', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'grill-me',
        name: 'grill-me',
        description: 'Interview the user until a design is resolved.',
        frontmatterExtras: createFirstPartyPlaitedFrontmatter(`      - id: interview.design
        type: workflow
        lane: private
        phase: analysis
        audience: [analyst, coder]
        actions: [question, clarify, decide]
        sideEffects: none
        source:
          type: first-party`),
        body: 'Ask one question at a time.',
      })

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.errors).toEqual([])
      expect(output.registry).toEqual([
        {
          skill: {
            name: 'grill-me',
            description: 'Interview the user until a design is resolved.',
            path: '/skills/grill-me/SKILL.md',
          },
          origin: {
            kind: 'first-party',
          },
          capabilities: [
            {
              id: 'interview.design',
              address: 'grill-me/interview.design',
              type: 'workflow',
              lane: 'private',
              phase: 'analysis',
              audience: ['analyst', 'coder'],
              actions: ['question', 'clarify', 'decide'],
              sideEffects: 'none',
              source: {
                type: 'first-party',
              },
            },
          ],
        },
      ])
    })
  })

  test('skills CLI mode=registry rejects workflow capabilities that declare a handler', async () => {
    await withTempRoot(async (rootDir) => {
      await writeSkillFile({
        rootDir,
        dirName: 'grill-me',
        name: 'grill-me',
        description: 'Interview the user until a design is resolved.',
        frontmatterExtras: createFirstPartyPlaitedFrontmatter(`      - id: interview.design
        type: workflow
        lane: private
        phase: analysis
        audience: [analyst]
        actions: [question]
        sideEffects: none
        handler:
          type: cli
          command: scripts/run.ts
        source:
          type: first-party`),
        body: 'Ask one question at a time.',
      })

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.registry).toEqual([])
      expect(output.errors).toHaveLength(1)
      expect(output.errors[0]?.message).toContain('handler')
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

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

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

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

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

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

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

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

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

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

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

      const result = await runSkillsCommand({ mode: 'registry', rootDir })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.registry).toEqual([])
      expect(output.errors).toHaveLength(1)
      expect(output.errors[0]?.message).toContain('capabilities.0.sideEffects')
    })
  })
})
