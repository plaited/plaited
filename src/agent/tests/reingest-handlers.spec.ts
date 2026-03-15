/**
 * Tests for re-ingestion handlers (reingest_skill, reingest_rules, reingest_goal).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_EVENTS } from '../agent.constants.ts'
import { createReingestHandlers } from '../reingest-handlers.ts'

// ============================================================================
// Fixtures
// ============================================================================

const TEMP_DIR = join(import.meta.dir, 'fixtures/reingest-handlers-test')
const MEMORY_DIR = join(TEMP_DIR, '.memory')

beforeAll(async () => {
  // Create a skill directory with SKILL.md
  await Bun.write(
    join(TEMP_DIR, 'skills/my-skill/SKILL.md'),
    `---
name: my-skill
description: A skill for reingest testing
---

# My Skill

Test skill content.
`,
  )

  // Create an AGENTS.md file
  await Bun.write(
    join(TEMP_DIR, 'AGENTS.md'),
    `# AGENTS.md

# Rules

## Rule One

First rule content.

## Rule Two

Second rule content.
`,
  )

  // Create a goal factory file
  await Bun.write(
    join(TEMP_DIR, 'goals/test-goal.ts'),
    `import { bThread, bSync } from '../../src/behavioral/behavioral.ts'

export const testGoal = {
  $: '🏛️',
  name: 'test-goal',
  create: () => ({
    threads: {
      myThread: bThread([
        bSync({ waitFor: 'start' }),
      ]),
    },
  }),
}
`,
  )
})

afterAll(() => {
  rmSync(TEMP_DIR, { recursive: true, force: true })
})

// ============================================================================
// Tests
// ============================================================================

describe('createReingestHandlers', () => {
  describe('reingest_skill', () => {
    test('calls ingestSkill and writes vertex to memory', async () => {
      const handlers = createReingestHandlers()
      const handler = handlers[AGENT_EVENTS.reingest_skill]
      expect(handler).toBeDefined()

      await handler!({
        skillDir: join(TEMP_DIR, 'skills/my-skill'),
        memoryDir: MEMORY_DIR,
      })

      // Verify vertex was written
      const vertexPath = join(MEMORY_DIR, 'skills/my-skill.jsonld')
      const exists = await Bun.file(vertexPath).exists()
      expect(exists).toBe(true)

      const vertex = JSON.parse(await Bun.file(vertexPath).text())
      expect(vertex['@type']).toBe('Skill')
      expect(vertex['@id']).toBe('skill://my-skill')
      expect(vertex['schema:name']).toBe('my-skill')
    })

    test('logs error for missing skill directory', async () => {
      const handlers = createReingestHandlers()
      const errors: string[] = []
      const originalError = console.error
      console.error = (msg: string) => errors.push(msg)

      await handlers[AGENT_EVENTS.reingest_skill]!({
        skillDir: '/tmp/nonexistent-skill',
        memoryDir: MEMORY_DIR,
      })

      console.error = originalError

      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('reingest_skill failed')
      expect(errors[0]).toContain('No SKILL.md found')
    })
  })

  describe('reingest_rules', () => {
    test('calls ingestRules and writes vertices to memory', async () => {
      const handlers = createReingestHandlers()
      const handler = handlers[AGENT_EVENTS.reingest_rules]
      expect(handler).toBeDefined()

      await handler!({
        path: join(TEMP_DIR, 'AGENTS.md'),
        memoryDir: MEMORY_DIR,
      })

      // Verify at least one vertex was written to rules/
      const rulesDir = join(MEMORY_DIR, 'rules')
      const glob = new Bun.Glob('*.jsonld')
      const files: string[] = []
      for await (const path of glob.scan({ cwd: rulesDir, onlyFiles: true })) {
        files.push(path)
      }
      expect(files.length).toBeGreaterThan(0)

      // Verify vertex content
      const vertexContent = await Bun.file(join(rulesDir, files[0]!)).text()
      const vertex = JSON.parse(vertexContent)
      expect(vertex['@type']).toBe('RuleSet')
    })

    test('logs error for missing rules file', async () => {
      const handlers = createReingestHandlers()
      const errors: string[] = []
      const originalError = console.error
      console.error = (msg: string) => errors.push(msg)

      await handlers[AGENT_EVENTS.reingest_rules]!({
        path: '/tmp/nonexistent-agents.md',
        memoryDir: MEMORY_DIR,
      })

      console.error = originalError

      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('reingest_rules failed')
    })
  })

  describe('reingest_goal', () => {
    test('calls ingestGoal and writes vertex to memory', async () => {
      const handlers = createReingestHandlers()
      const handler = handlers[AGENT_EVENTS.reingest_goal]
      expect(handler).toBeDefined()

      await handler!({
        path: join(TEMP_DIR, 'goals/test-goal.ts'),
        memoryDir: MEMORY_DIR,
      })

      // Verify vertex was written
      const vertexPath = join(MEMORY_DIR, 'threads/goal_test-goal.jsonld')
      const exists = await Bun.file(vertexPath).exists()
      expect(exists).toBe(true)

      const vertex = JSON.parse(await Bun.file(vertexPath).text())
      expect(vertex['@type']).toBe('Goal')
      expect(vertex.brand).toBe('🏛️')
    })

    test('logs error for missing goal factory', async () => {
      const handlers = createReingestHandlers()
      const errors: string[] = []
      const originalError = console.error
      console.error = (msg: string) => errors.push(msg)

      await handlers[AGENT_EVENTS.reingest_goal]!({
        path: '/tmp/nonexistent-goal.ts',
        memoryDir: MEMORY_DIR,
      })

      console.error = originalError

      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('reingest_goal failed')
    })
  })

  test('returns all three handlers', () => {
    const handlers = createReingestHandlers()
    expect(handlers[AGENT_EVENTS.reingest_skill]).toBeDefined()
    expect(handlers[AGENT_EVENTS.reingest_rules]).toBeDefined()
    expect(handlers[AGENT_EVENTS.reingest_goal]).toBeDefined()
  })
})
