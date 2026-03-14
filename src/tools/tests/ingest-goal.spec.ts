/**
 * Tests for goal factory → JSON-LD vertex ingestion (ingest-goal).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { ingestGoal } from '../ingest-goal.ts'

// ============================================================================
// Fixtures
// ============================================================================

const FIXTURES_DIR = join(import.meta.dir, 'fixtures/ingest-goal')
const MEMORY_DIR = join(FIXTURES_DIR, '.memory')

beforeAll(async () => {
  // Create a minimal goal factory
  await Bun.write(
    join(FIXTURES_DIR, 'goals/my-goal.ts'),
    `import { bThread, bSync } from '../../behavioral/behavioral.ts'
export const myGoal = {
  $: '🎯',
  create: (bThreads: { set: (t: Record<string, unknown>) => void }) => {
    bThreads.set({
      trackProgress: bThread([
        bSync({ waitFor: 'task' }),
      ]),
      checkComplete: bThread([
        bSync({ waitFor: 'tool_result' }),
      ]),
    })
  },
}
`,
  )

  // Create a factory with no threads
  await Bun.write(
    join(FIXTURES_DIR, 'goals/empty-goal.ts'),
    `export const emptyGoal = {
  $: '🎯',
  create: () => {},
}
`,
  )
})

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true })
})

// ============================================================================
// Tests
// ============================================================================

describe('ingestGoal', () => {
  test('generates correct JSON-LD vertex', async () => {
    const factoryPath = join(FIXTURES_DIR, 'goals/my-goal.ts')
    const result = await ingestGoal(factoryPath, MEMORY_DIR)

    expect(result.vertex['@type']).toBe('Goal')
    expect(result.vertex['@id']).toBe('bp:thread/goal_my-goal')
    expect(result.vertex.brand).toBe('🎯')
    expect(result.vertex['schema:name']).toBe('my-goal')
    expect(result.vertex.source).toBe(factoryPath)
  })

  test('extracts thread names from factory', async () => {
    const factoryPath = join(FIXTURES_DIR, 'goals/my-goal.ts')
    const result = await ingestGoal(factoryPath, MEMORY_DIR)

    const threads = result.vertex.threads as string[]
    expect(threads).toContain('bp:thread/trackProgress')
    expect(threads).toContain('bp:thread/checkComplete')
  })

  test('writes .jsonld file to threads/ directory', async () => {
    const factoryPath = join(FIXTURES_DIR, 'goals/my-goal.ts')
    const result = await ingestGoal(factoryPath, MEMORY_DIR)

    expect(result.vertexPath).toContain('threads/goal_my-goal.jsonld')
    const fileExists = await Bun.file(result.vertexPath).exists()
    expect(fileExists).toBe(true)

    // Verify file content matches returned vertex
    const fileContent = JSON.parse(await Bun.file(result.vertexPath).text())
    expect(fileContent['@id']).toBe('bp:thread/goal_my-goal')
  })

  test('handles factory with no threads', async () => {
    const factoryPath = join(FIXTURES_DIR, 'goals/empty-goal.ts')
    const result = await ingestGoal(factoryPath, MEMORY_DIR)

    expect(result.vertex['@type']).toBe('Goal')
    expect(result.vertex.threads).toEqual([])
  })

  test('non-existent file throws', async () => {
    await expect(ingestGoal('/tmp/does-not-exist.ts', MEMORY_DIR)).rejects.toThrow('does not exist')
  })

  test('vertex includes timestamp', async () => {
    const factoryPath = join(FIXTURES_DIR, 'goals/my-goal.ts')
    const result = await ingestGoal(factoryPath, MEMORY_DIR)

    expect(typeof result.vertex.timestamp).toBe('string')
    // Should be a valid ISO date
    const date = new Date(result.vertex.timestamp as string)
    expect(date.getTime()).toBeGreaterThan(0)
  })

  test('vertex includes JSON-LD context', async () => {
    const factoryPath = join(FIXTURES_DIR, 'goals/my-goal.ts')
    const result = await ingestGoal(factoryPath, MEMORY_DIR)

    const ctx = result.vertex['@context'] as Record<string, string>
    expect(ctx.bp).toBe('urn:bp:')
    expect(ctx.schema).toBe('https://schema.org/')
  })
})
