/**
 * Tests for snapshot writer — useSnapshot → JSON-LD decision persistence.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { SnapshotMessage } from '../../behavioral/behavioral.schemas.ts'
import type { MemoryHandlers } from '../memory-handlers.ts'
import { createSnapshotWriter } from '../snapshot-writer.ts'

// ============================================================================
// Helpers
// ============================================================================

const TEMP_DIR = join(import.meta.dir, 'fixtures/snapshot-writer-test')
const SESSION_ID = 'sess_snapshot'
const MEMORY_DIR = join(TEMP_DIR, '.memory')
const DECISIONS_DIR = join(MEMORY_DIR, 'sessions', SESSION_ID, 'decisions')

/**
 * Create a mock MemoryHandlers that records tracked decisions.
 */
const createMockHandlers = (): MemoryHandlers & { tracked: string[] } => {
  const tracked: string[] = []
  return {
    trackDecision: (id: string) => {
      tracked.push(id)
    },
    tracked,
  } as MemoryHandlers & { tracked: string[] }
}

/**
 * Build a selection snapshot message with the given bids.
 */
const selectionSnapshot = (
  bids: Array<{
    thread: string
    type: string
    selected: boolean
    priority: number
    trigger?: boolean
    blockedBy?: string
    interrupts?: string
    detail?: unknown
  }>,
): SnapshotMessage => ({
  kind: 'selection',
  bids: bids.map((b) => ({
    thread: b.thread,
    trigger: b.trigger ?? false,
    selected: b.selected,
    type: b.type,
    priority: b.priority,
    ...(b.blockedBy && { blockedBy: b.blockedBy }),
    ...(b.interrupts && { interrupts: b.interrupts }),
    ...(b.detail !== undefined && { detail: b.detail }),
  })),
})

// ============================================================================
// Lifecycle
// ============================================================================

beforeAll(async () => {
  await Bun.write(join(TEMP_DIR, '.gitkeep'), '')
})

afterAll(() => {
  rmSync(TEMP_DIR, { recursive: true, force: true })
})

// ============================================================================
// Tests
// ============================================================================

describe('createSnapshotWriter', () => {
  test('writes decision vertex on selection snapshot', async () => {
    const handlers = createMockHandlers()
    const writer = createSnapshotWriter({
      sessionId: SESSION_ID,
      memoryPath: MEMORY_DIR,
      memoryHandlers: handlers,
    })

    await writer(
      selectionSnapshot([
        { thread: 'taskGate', type: 'task', selected: true, priority: 1 },
        { thread: 'maxIterations', type: 'execute', selected: false, priority: 0 },
      ]),
    )

    // Verify file was written
    const filePath = join(DECISIONS_DIR, '1.jsonld')
    const exists = await Bun.file(filePath).exists()
    expect(exists).toBe(true)

    // Verify JSON-LD content
    const vertex = JSON.parse(await Bun.file(filePath).text())
    expect(vertex['@id']).toBe(`session/${SESSION_ID}/decision/1`)
    expect(vertex['@type']).toBe('SelectionDecision')
    expect(vertex.superstep).toBe(1)
    expect(vertex.timestamp).toBeDefined()
    expect(vertex.bids).toHaveLength(2)
  })

  test('adds bp: URI prefixes to event and thread names', async () => {
    const handlers = createMockHandlers()
    const writer = createSnapshotWriter({
      sessionId: 'sess_prefix',
      memoryPath: join(TEMP_DIR, '.memory-prefix'),
      memoryHandlers: handlers,
    })

    await writer(selectionSnapshot([{ thread: 'taskGate', type: 'task', selected: true, priority: 1 }]))

    const filePath = join(TEMP_DIR, '.memory-prefix/sessions/sess_prefix/decisions/1.jsonld')
    const vertex = JSON.parse(await Bun.file(filePath).text())
    const bid = vertex.bids[0]

    expect(bid.event).toBe('bp:event/task')
    expect(bid.thread).toBe('bp:thread/taskGate')
  })

  test('includes blockedBy and interrupts with bp: prefix', async () => {
    const handlers = createMockHandlers()
    const writer = createSnapshotWriter({
      sessionId: 'sess_block',
      memoryPath: join(TEMP_DIR, '.memory-block'),
      memoryHandlers: handlers,
    })

    await writer(
      selectionSnapshot([
        {
          thread: 'sim_guard_tc-1',
          type: 'execute',
          selected: false,
          priority: 0,
          blockedBy: 'sim_guard_tc-1',
        },
        {
          thread: 'batchCompletion',
          type: 'tool_result',
          selected: true,
          priority: 0,
          interrupts: 'sim_guard_tc-1',
        },
      ]),
    )

    const filePath = join(TEMP_DIR, '.memory-block/sessions/sess_block/decisions/1.jsonld')
    const vertex = JSON.parse(await Bun.file(filePath).text())

    expect(vertex.bids[0].blockedBy).toBe('bp:thread/sim_guard_tc-1')
    expect(vertex.bids[1].interrupts).toBe('bp:thread/sim_guard_tc-1')
  })

  test('increments superstep across multiple snapshots', async () => {
    const handlers = createMockHandlers()
    const writer = createSnapshotWriter({
      sessionId: 'sess_step',
      memoryPath: join(TEMP_DIR, '.memory-step'),
      memoryHandlers: handlers,
    })

    await writer(selectionSnapshot([{ thread: 't1', type: 'task', selected: true, priority: 0 }]))
    await writer(selectionSnapshot([{ thread: 't1', type: 'invoke_inference', selected: true, priority: 0 }]))
    await writer(selectionSnapshot([{ thread: 't1', type: 'model_response', selected: true, priority: 0 }]))

    const dir = join(TEMP_DIR, '.memory-step/sessions/sess_step/decisions')

    const v1 = JSON.parse(await Bun.file(join(dir, '1.jsonld')).text())
    const v2 = JSON.parse(await Bun.file(join(dir, '2.jsonld')).text())
    const v3 = JSON.parse(await Bun.file(join(dir, '3.jsonld')).text())

    expect(v1.superstep).toBe(1)
    expect(v2.superstep).toBe(2)
    expect(v3.superstep).toBe(3)
  })

  test('calls trackDecision with decision @id', async () => {
    const handlers = createMockHandlers()
    const writer = createSnapshotWriter({
      sessionId: 'sess_track',
      memoryPath: join(TEMP_DIR, '.memory-track'),
      memoryHandlers: handlers,
    })

    await writer(selectionSnapshot([{ thread: 't1', type: 'task', selected: true, priority: 0 }]))
    await writer(selectionSnapshot([{ thread: 't1', type: 'execute', selected: true, priority: 0 }]))

    expect(handlers.tracked).toEqual(['session/sess_track/decision/1', 'session/sess_track/decision/2'])
  })

  test('ignores non-selection snapshot messages', async () => {
    const handlers = createMockHandlers()
    const writer = createSnapshotWriter({
      sessionId: 'sess_ignore',
      memoryPath: join(TEMP_DIR, '.memory-ignore'),
      memoryHandlers: handlers,
    })

    // Send non-selection messages
    await writer({ kind: 'feedback_error', type: 'task', error: 'handler failed' })
    await writer({ kind: 'bthreads_warning', thread: 'dup', warning: 'duplicate thread' })
    await writer({
      kind: 'restricted_trigger_error',
      type: 'execute',
      error: 'not allowed',
    })

    // No files should be written
    expect(handlers.tracked).toHaveLength(0)

    const dir = join(TEMP_DIR, '.memory-ignore/sessions/sess_ignore/decisions')
    const exists = await Bun.file(join(dir, '1.jsonld')).exists()
    expect(exists).toBe(false)
  })

  test('vertex format matches fixture structure', async () => {
    const handlers = createMockHandlers()
    const writer = createSnapshotWriter({
      sessionId: 'sess_fixture',
      memoryPath: join(TEMP_DIR, '.memory-fixture'),
      memoryHandlers: handlers,
    })

    await writer(
      selectionSnapshot([
        { thread: 'taskGate', type: 'task', selected: true, priority: 1 },
        { thread: 'maxIterations', type: 'execute', selected: false, priority: 0 },
      ]),
    )

    const filePath = join(TEMP_DIR, '.memory-fixture/sessions/sess_fixture/decisions/1.jsonld')
    const vertex = JSON.parse(await Bun.file(filePath).text())

    // Should match the shape of decision-001.jsonld fixture
    expect(vertex).toHaveProperty('@id')
    expect(vertex).toHaveProperty('@type', 'SelectionDecision')
    expect(vertex).toHaveProperty('superstep')
    expect(vertex).toHaveProperty('timestamp')
    expect(vertex).toHaveProperty('bids')

    // Each bid should have event, thread, selected, priority
    for (const bid of vertex.bids) {
      expect(bid).toHaveProperty('event')
      expect(bid).toHaveProperty('thread')
      expect(bid).toHaveProperty('selected')
      expect(bid).toHaveProperty('priority')
      expect(bid.event).toMatch(/^bp:event\//)
      expect(bid.thread).toMatch(/^bp:thread\//)
    }
  })
})
