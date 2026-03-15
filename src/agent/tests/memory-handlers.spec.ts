/**
 * Tests for memory lifecycle handlers (commit_snapshot, consolidate, defrag).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_EVENTS } from '../agent.constants.ts'
import { createMemoryHandlers, loadDecisionsJsonl } from '../memory-handlers.ts'

// ============================================================================
// Helpers
// ============================================================================

const TEMP_DIR = join(import.meta.dir, 'fixtures/memory-handlers-test')

/**
 * Initialize a temporary git repo with a .memory/ structure.
 *
 * @internal
 */
const initTestRepo = async (repoDir: string, sessionId: string) => {
  const memoryDir = join(repoDir, '.memory')
  const sessionDir = join(memoryDir, 'sessions', sessionId)
  const decisionsDir = join(sessionDir, 'decisions')
  const commitsDir = join(sessionDir, 'commits')

  // Create repo directory first — Bun.spawnSync needs cwd to exist
  mkdirSync(repoDir, { recursive: true })

  // Initialize git repo
  Bun.spawnSync(['git', 'init'], { cwd: repoDir })
  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: repoDir })
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoDir })

  // Create initial structure + commit
  await Bun.write(join(repoDir, 'README.md'), '# Test\n')
  await Bun.write(
    join(decisionsDir, 'decision-001.jsonld'),
    JSON.stringify({
      '@id': `${sessionId}/decision/1`,
      '@type': 'SelectionDecision',
      bids: [{ thread: 'bp:thread/t1', event: 'bp:event/task', selected: true }],
    }),
  )
  await Bun.write(
    join(decisionsDir, 'decision-002.jsonld'),
    JSON.stringify({
      '@id': `${sessionId}/decision/2`,
      '@type': 'SelectionDecision',
      bids: [{ thread: 'bp:thread/t1', event: 'bp:event/tool_result', selected: true }],
    }),
  )

  Bun.spawnSync(['git', 'add', '-A'], { cwd: repoDir })
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: repoDir })

  return { memoryDir, sessionDir, decisionsDir, commitsDir }
}

// ============================================================================
// Tests
// ============================================================================

beforeAll(async () => {
  // Ensure fixture dir exists
  await Bun.write(join(TEMP_DIR, '.gitkeep'), '')
})

afterAll(() => {
  rmSync(TEMP_DIR, { recursive: true, force: true })
})

describe('createMemoryHandlers', () => {
  describe('commit_snapshot', () => {
    test('commits changes and triggers snapshot_committed', async () => {
      const repoDir = join(TEMP_DIR, 'commit-test')
      const sessionId = 'sess_commit'
      const { memoryDir } = await initTestRepo(repoDir, sessionId)

      const triggered: { type: string; detail?: unknown }[] = []
      const trigger = (event: { type: string; detail?: unknown }) => {
        triggered.push(event)
      }

      const handlers = createMemoryHandlers({
        trigger,
        memoryPath: memoryDir,
        sessionId,
      })

      // Make a code change
      await Bun.write(join(repoDir, 'new-file.ts'), 'export const x = 1\n')

      // Call commit_snapshot handler
      await handlers[AGENT_EVENTS.commit_snapshot]!({
        modulePath: repoDir,
        toolResult: { tool_call_id: 'tc-1', output: 'written' },
      })

      // Should have triggered snapshot_committed
      expect(triggered.length).toBe(1)
      expect(triggered[0]!.type).toBe(AGENT_EVENTS.snapshot_committed)
      const detail = triggered[0]!.detail as { sha: string; modulePath: string }
      expect(detail.sha).toMatch(/^[a-f0-9]{40}$/)
      expect(detail.modulePath).toBe(repoDir)
    })

    test('writes commit vertex file (one-behind pattern)', async () => {
      const repoDir = join(TEMP_DIR, 'vertex-test')
      const sessionId = 'sess_vertex'
      const { memoryDir, commitsDir } = await initTestRepo(repoDir, sessionId)

      const triggered: { type: string; detail?: unknown }[] = []
      const trigger = (event: { type: string; detail?: unknown }) => {
        triggered.push(event)
      }

      const handlers = createMemoryHandlers({
        trigger,
        memoryPath: memoryDir,
        sessionId,
      })

      // Track some decisions
      const trackDecision = (handlers as unknown as { trackDecision: (id: string) => void }).trackDecision
      trackDecision('sess_vertex/decision/1')
      trackDecision('sess_vertex/decision/2')

      // Make a change and commit
      await Bun.write(join(repoDir, 'code.ts'), 'export const y = 2\n')
      await handlers[AGENT_EVENTS.commit_snapshot]!({
        modulePath: repoDir,
        toolResult: { tool_call_id: 'tc-1', output: 'written' },
      })

      // Check that commit vertex was written
      const detail = triggered[0]!.detail as { sha: string }
      const vertexPath = join(commitsDir, `${detail.sha}.jsonld`)
      const exists = await Bun.file(vertexPath).exists()
      expect(exists).toBe(true)

      const vertex = JSON.parse(await Bun.file(vertexPath).text())
      expect(vertex['@type']).toBe('Commit')
      expect(vertex.sha).toBe(detail.sha)
      expect(vertex.attestsTo).toEqual(['sess_vertex/decision/1', 'sess_vertex/decision/2'])
    })
  })

  describe('consolidate', () => {
    test('archives decisions to JSONL and writes meta', async () => {
      const repoDir = join(TEMP_DIR, 'consolidate-test')
      const sessionId = 'sess_consolidate'
      const { memoryDir, sessionDir } = await initTestRepo(repoDir, sessionId)

      const handlers = createMemoryHandlers({
        trigger: () => {},
        memoryPath: memoryDir,
        sessionId,
      })

      await handlers[AGENT_EVENTS.consolidate]!({
        sessionId,
        memoryPath: memoryDir,
      })

      // Check decisions.jsonl was written and parseable via Bun.JSONL
      const jsonlPath = join(sessionDir, 'decisions.jsonl')
      const jsonlExists = await Bun.file(jsonlPath).exists()
      expect(jsonlExists).toBe(true)

      const jsonlContent = await Bun.file(jsonlPath).text()
      const decisions = Bun.JSONL.parse(jsonlContent)
      expect(decisions.length).toBe(2) // 2 decision files
      expect((decisions[0] as Record<string, unknown>)['@type']).toBe('SelectionDecision')

      // Check meta.jsonld was written
      const metaPath = join(sessionDir, 'meta.jsonld')
      const metaExists = await Bun.file(metaPath).exists()
      expect(metaExists).toBe(true)

      const meta = JSON.parse(await Bun.file(metaPath).text())
      expect(meta['@type']).toBe('Session')
      expect(meta['@id']).toBe(sessionId)
      expect(meta.decisionCount).toBe(2)
    })
  })

  describe('defrag', () => {
    test('archives and removes old sessions beyond keepSessions limit', async () => {
      const repoDir = join(TEMP_DIR, 'defrag-test')
      const memoryDir = join(repoDir, '.memory')

      // Create repo directory first
      mkdirSync(repoDir, { recursive: true })

      // Initialize git repo
      Bun.spawnSync(['git', 'init'], { cwd: repoDir })
      Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: repoDir })
      Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoDir })

      // Create 4 sessions with content
      for (const name of ['sess_01', 'sess_02', 'sess_03', 'sess_04']) {
        const sessionDir = join(memoryDir, 'sessions', name)
        await Bun.write(join(sessionDir, 'meta.jsonld'), JSON.stringify({ '@id': name, '@type': 'Session' }))
        await Bun.write(join(sessionDir, 'decisions', 'dec.jsonld'), JSON.stringify({ '@id': `${name}/d1` }))
      }

      Bun.spawnSync(['git', 'add', '-A'], { cwd: repoDir })
      Bun.spawnSync(['git', 'commit', '-m', 'initial with 4 sessions'], { cwd: repoDir })

      const handlers = createMemoryHandlers({
        trigger: () => {},
        memoryPath: memoryDir,
        sessionId: 'sess_04',
        keepSessions: 2,
      })

      await handlers[AGENT_EVENTS.defrag]!({ memoryPath: memoryDir })

      // Directories should be removed
      const sess01Exists = await Bun.file(join(memoryDir, 'sessions/sess_01/meta.jsonld')).exists()
      const sess02Exists = await Bun.file(join(memoryDir, 'sessions/sess_02/meta.jsonld')).exists()
      const sess03Exists = await Bun.file(join(memoryDir, 'sessions/sess_03/meta.jsonld')).exists()
      const sess04Exists = await Bun.file(join(memoryDir, 'sessions/sess_04/meta.jsonld')).exists()

      expect(sess01Exists).toBe(false)
      expect(sess02Exists).toBe(false)
      expect(sess03Exists).toBe(true)
      expect(sess04Exists).toBe(true)

      // Archives should exist
      const archive01Exists = await Bun.file(join(memoryDir, 'sessions/sess_01.tar.gz')).exists()
      const archive02Exists = await Bun.file(join(memoryDir, 'sessions/sess_02.tar.gz')).exists()
      expect(archive01Exists).toBe(true)
      expect(archive02Exists).toBe(true)

      // Archives should be valid gzip (check magic bytes)
      const archive01Bytes = await Bun.file(join(memoryDir, 'sessions/sess_01.tar.gz')).bytes()
      expect(archive01Bytes[0]).toBe(0x1f)
      expect(archive01Bytes[1]).toBe(0x8b)
    })
  })
})

// ============================================================================
// loadDecisionsJsonl
// ============================================================================

describe('loadDecisionsJsonl', () => {
  const JSONL_DIR = join(TEMP_DIR, 'jsonl-test')

  test('parses decisions.jsonl via Bun.JSONL', async () => {
    const jsonlPath = join(JSONL_DIR, 'decisions.jsonl')
    const doc1 = { '@id': 'test/d1', '@type': 'SelectionDecision', bids: [] }
    const doc2 = { '@id': 'test/d2', '@type': 'SelectionDecision', bids: [] }
    await Bun.write(jsonlPath, `${JSON.stringify(doc1)}\n${JSON.stringify(doc2)}\n`)

    const decisions = await loadDecisionsJsonl(jsonlPath)
    expect(decisions).toHaveLength(2)
    expect((decisions[0] as Record<string, unknown>)['@id']).toBe('test/d1')
    expect((decisions[1] as Record<string, unknown>)['@id']).toBe('test/d2')
  })

  test('returns empty array for missing file', async () => {
    const decisions = await loadDecisionsJsonl(join(JSONL_DIR, 'nonexistent.jsonl'))
    expect(decisions).toEqual([])
  })
})
