import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'

type ListOutput = {
  rules: string[]
}

type ScaffoldOutput = {
  dryRun: boolean
  actions: string[]
}

const binDir = join(import.meta.dir, '../../bin')

describe('scaffold-rules', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(import.meta.dir, `test-scaffold-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('--list flag', () => {
    test('outputs available rules as JSON', async () => {
      const result: ListOutput = await $`bun ${binDir}/cli.ts scaffold-rules --list`.json()

      expect(result).toHaveProperty('rules')
      expect(result.rules).toBeArray()
      expect(result.rules.length).toBeGreaterThan(0)
    })

    test('includes expected compressed rules', async () => {
      const result: ListOutput = await $`bun ${binDir}/cli.ts scaffold-rules --list`.json()

      expect(result.rules).toContain('accuracy')
      expect(result.rules).toContain('bun')
      expect(result.rules).toContain('core')
      expect(result.rules).toContain('documentation')
      expect(result.rules).toContain('modules')
      expect(result.rules).toContain('testing')
      expect(result.rules).toContain('workflow')
    })

    test('short flag -l works', async () => {
      const result: ListOutput = await $`bun ${binDir}/cli.ts scaffold-rules -l`.json()

      expect(result).toHaveProperty('rules')
      expect(result.rules).toBeArray()
    })
  })

  describe('--dry-run flag', () => {
    test('outputs planned actions without executing', async () => {
      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules --dry-run`.json()

      expect(result.dryRun).toBe(true)
      expect(result.actions).toBeArray()
      expect(result.actions).toContain('create: AGENTS.md (rules section)')
    })

    test('does not create files in dry-run mode', async () => {
      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules --dry-run`.json()

      expect(await Bun.file(join(testDir, 'AGENTS.md')).exists()).toBe(false)
    })

    test('short flag -n works', async () => {
      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules -n`.json()

      expect(result.dryRun).toBe(true)
    })
  })

  describe('AGENTS.md behavior', () => {
    test('creates AGENTS.md if it does not exist', async () => {
      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.quiet()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toContain('# AGENTS')
      expect(content).toContain('## Rules')
      expect(content).toContain('<!-- PLAITED-RULES-START -->')
      expect(content).toContain('<!-- PLAITED-RULES-END -->')
      expect(content).toContain('# Core Conventions')
    })

    test('appends rules with markers to existing AGENTS.md', async () => {
      await Bun.write(join(testDir, 'AGENTS.md'), '# My Project\n\nCustom content\n')

      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.quiet()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toStartWith('# My Project\n\nCustom content\n')
      expect(content).toContain('<!-- PLAITED-RULES-START -->')
      expect(content).toContain('## Rules')
      expect(content).toContain('<!-- PLAITED-RULES-END -->')
    })

    test('updates existing markers without overwriting user content', async () => {
      const initial =
        '# Project\n\nUser notes\n\n<!-- PLAITED-RULES-START -->\n\n## Rules\n\n- old rule\n\n<!-- PLAITED-RULES-END -->\n\nMore user content\n'
      await Bun.write(join(testDir, 'AGENTS.md'), initial)

      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.json()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toContain('User notes')
      expect(content).toContain('More user content')
      expect(content).not.toContain('old rule')
      expect(content).toContain('# Core Conventions')
      expect(result.actions).toContain('update: AGENTS.md (rules section)')
    })

    test('appends when only start marker exists (no end marker)', async () => {
      const malformed = '# Project\n\n<!-- PLAITED-RULES-START -->\n\nOrphan content\n'
      await Bun.write(join(testDir, 'AGENTS.md'), malformed)

      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.json()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toContain('# Core Conventions')
      expect(result.actions).toContain('append: AGENTS.md (rules section)')
    })

    test('appends when markers are reversed (end before start)', async () => {
      const reversed =
        '# Project\n\n<!-- PLAITED-RULES-END -->\n\nMiddle\n\n<!-- PLAITED-RULES-START -->\n\nOld rules\n'
      await Bun.write(join(testDir, 'AGENTS.md'), reversed)

      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.json()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toContain('# Core Conventions')
      expect(result.actions).toContain('append: AGENTS.md (rules section)')
    })

    test('appends when only end marker exists (no start marker)', async () => {
      const malformed = '# Project\n\nSome content\n\n<!-- PLAITED-RULES-END -->\n'
      await Bun.write(join(testDir, 'AGENTS.md'), malformed)

      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.json()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toContain('# Core Conventions')
      expect(result.actions).toContain('append: AGENTS.md (rules section)')
    })
  })

  describe('CLAUDE.md behavior', () => {
    test('adds @AGENTS.md reference to existing CLAUDE.md', async () => {
      await Bun.write(join(testDir, 'CLAUDE.md'), '# Claude Config\n\nSome settings\n')

      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.quiet()

      const content = await Bun.file(join(testDir, 'CLAUDE.md')).text()
      expect(content).toStartWith('@AGENTS.md\n\n')
      expect(content).toContain('# Claude Config')
    })

    test('skips CLAUDE.md if @AGENTS.md reference already exists', async () => {
      await Bun.write(join(testDir, 'CLAUDE.md'), '@AGENTS.md\n\n# Claude Config\n')

      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.json()

      const skipAction = result.actions.find((a) => a.includes('CLAUDE.md') && a.includes('skip'))
      expect(skipAction).toBeDefined()
    })

    test('adds reference when @AGENTS.md only appears inline (not at start of line)', async () => {
      await Bun.write(join(testDir, 'CLAUDE.md'), '# Config\n\nSee `@AGENTS.md` for details\n')

      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.json()

      const content = await Bun.file(join(testDir, 'CLAUDE.md')).text()
      expect(content).toStartWith('@AGENTS.md\n\n')
      expect(result.actions).toContain('update: CLAUDE.md (added @AGENTS.md reference)')
    })

    test('does not create CLAUDE.md if it does not exist', async () => {
      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.quiet()

      expect(await Bun.file(join(testDir, 'CLAUDE.md')).exists()).toBe(false)
    })
  })

  describe('output structure', () => {
    test('returns JSON with expected fields', async () => {
      const result: ScaffoldOutput = await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.json()

      expect(result).toHaveProperty('dryRun')
      expect(result).toHaveProperty('actions')
      expect(result.dryRun).toBe(false)
      expect(result.actions).toBeArray()
    })
  })

  describe('rule content', () => {
    test('AGENTS.md contains TypeScript conventions', async () => {
      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.quiet()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toContain('Type over interface')
      expect(content).toContain('Arrow functions')
    })

    test('AGENTS.md contains test conventions', async () => {
      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.quiet()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toContain('test not it')
      expect(content).toContain('No conditional assertions')
    })

    test('rules include verification patterns', async () => {
      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.quiet()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).toContain('*Verify:*')
      expect(content).toContain('*Fix:*')
    })

    test('rules are compressed (no verbose examples)', async () => {
      await $`cd ${testDir} && bun ${binDir}/cli.ts scaffold-rules`.quiet()

      const content = await Bun.file(join(testDir, 'AGENTS.md')).text()
      expect(content).not.toContain('// ✅ Good')
      expect(content).not.toContain('// ❌ Avoid')
    })
  })
})
