/**
 * Tests for skill directory → JSON-LD vertex ingestion (ingest-skill).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { ingestSkill } from '../ingest-skill.ts'

// ============================================================================
// Fixtures
// ============================================================================

const FIXTURES_DIR = join(import.meta.dir, 'fixtures/ingest-skill')
const MEMORY_DIR = join(FIXTURES_DIR, '.memory')

beforeAll(async () => {
  // Create a skill directory with SKILL.md and reference files
  await Bun.write(
    join(FIXTURES_DIR, 'test-skill/SKILL.md'),
    `---
name: test-skill
description: A test skill for unit testing
license: ISC
---

# Test Skill

This is a test skill.
`,
  )

  // Reference file with bThread and event refs
  await Bun.write(
    join(FIXTURES_DIR, 'test-skill/references/patterns.ts'),
    `// Reference file with BP patterns
const THREADS = ['bp:thread/taskGate', 'bp:thread/batchCompletion']
const EVENTS = ['bp:event/task', 'bp:event/execute', 'bp:event/tool_result']
export { THREADS, EVENTS }
`,
  )

  // Skill with no references
  await Bun.write(
    join(FIXTURES_DIR, 'empty-skill/SKILL.md'),
    `---
name: empty-skill
description: A skill with no TypeScript references
---

# Empty Skill

Just markdown, no code.
`,
  )

  // Skill with dependency reference
  await Bun.write(
    join(FIXTURES_DIR, 'dep-skill/SKILL.md'),
    `---
name: dep-skill
description: A skill that depends on another
---

# Dep Skill
`,
  )
  await Bun.write(
    join(FIXTURES_DIR, 'dep-skill/references/impl.ts'),
    `import { something } from '../other-skill/utils.ts'
export const x = something
`,
  )
})

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true })
})

// ============================================================================
// Tests
// ============================================================================

describe('ingestSkill', () => {
  test('generates correct JSON-LD Skill vertex', async () => {
    const skillDir = join(FIXTURES_DIR, 'test-skill')
    const result = await ingestSkill(skillDir, MEMORY_DIR)

    expect(result.vertex['@type']).toBe('Skill')
    expect(result.vertex['@id']).toBe('skill://test-skill')
    expect(result.vertex['schema:name']).toBe('test-skill')
    expect(result.vertex['schema:description']).toBe('A test skill for unit testing')
  })

  test('scans TypeScript files for thread references', async () => {
    const skillDir = join(FIXTURES_DIR, 'test-skill')
    const result = await ingestSkill(skillDir, MEMORY_DIR)

    const provides = result.vertex.provides as { '@id': string }[]
    expect(provides).toBeDefined()
    const threadIds = provides.map((p) => p['@id'])
    expect(threadIds).toContain('bp:thread/taskGate')
    expect(threadIds).toContain('bp:thread/batchCompletion')
  })

  test('scans TypeScript files for event references', async () => {
    const skillDir = join(FIXTURES_DIR, 'test-skill')
    const result = await ingestSkill(skillDir, MEMORY_DIR)

    const provides = result.vertex.provides as { references: string[] }[]
    expect(provides).toBeDefined()
    const allEvents = provides.flatMap((p) => p.references)
    expect(allEvents).toContain('bp:event/task')
    expect(allEvents).toContain('bp:event/execute')
  })

  test('writes .jsonld file to skills/ directory', async () => {
    const skillDir = join(FIXTURES_DIR, 'test-skill')
    const result = await ingestSkill(skillDir, MEMORY_DIR)

    expect(result.vertexPath).toContain('skills/test-skill.jsonld')
    const fileExists = await Bun.file(result.vertexPath).exists()
    expect(fileExists).toBe(true)
  })

  test('handles skill with no TypeScript references', async () => {
    const skillDir = join(FIXTURES_DIR, 'empty-skill')
    const result = await ingestSkill(skillDir, MEMORY_DIR)

    expect(result.vertex['@type']).toBe('Skill')
    expect(result.vertex.provides).toBeUndefined()
    expect(result.vertex.requires).toBeUndefined()
  })

  test('detects cross-skill dependencies', async () => {
    const skillDir = join(FIXTURES_DIR, 'dep-skill')
    const result = await ingestSkill(skillDir, MEMORY_DIR)

    const requires = result.vertex.requires as { '@id': string }[]
    expect(requires).toBeDefined()
    expect(requires.some((r) => r['@id'] === 'skill://other-skill')).toBe(true)
  })

  test('missing SKILL.md throws', async () => {
    await expect(ingestSkill('/tmp/no-skill-here', MEMORY_DIR)).rejects.toThrow('No SKILL.md found')
  })

  test('vertex includes JSON-LD context and timestamp', async () => {
    const skillDir = join(FIXTURES_DIR, 'test-skill')
    const result = await ingestSkill(skillDir, MEMORY_DIR)

    const ctx = result.vertex['@context'] as Record<string, string>
    expect(ctx.bp).toBe('urn:bp:')
    expect(typeof result.vertex.timestamp).toBe('string')
  })
})
