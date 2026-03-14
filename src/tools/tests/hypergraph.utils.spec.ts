/**
 * Tests for hypergraph utility functions (provenance derivation + session summary).
 *
 * @remarks
 * Uses inline fixtures — no new fixture files needed.
 */

import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { buildSessionSummary, deriveProvenanceEdges, EVENT_CAUSATION } from '../hypergraph.utils.ts'

// ============================================================================
// deriveProvenanceEdges
// ============================================================================

describe('deriveProvenanceEdges', () => {
  test('thread continuity between consecutive decisions', () => {
    const decisions = [
      {
        '@id': 'session/s1/decision/1',
        bids: [
          { thread: 'bp:thread/taskGate', event: 'bp:event/task', selected: true },
          { thread: 'bp:thread/maxIterations', event: 'bp:event/execute', selected: false },
        ],
      },
      {
        '@id': 'session/s1/decision/2',
        bids: [{ thread: 'bp:thread/taskGate', event: 'bp:event/gate_approved', selected: true }],
      },
    ]
    const edges = deriveProvenanceEdges(decisions)
    const continuity = edges.filter((e) => e.kind === 'thread_continuity')
    expect(continuity.length).toBe(1)
    expect(continuity[0]!.via).toBe('bp:thread/taskGate')
    expect(continuity[0]!.from).toBe('session/s1/decision/1')
    expect(continuity[0]!.to).toBe('session/s1/decision/2')
  })

  test('block→unblock transitions', () => {
    const decisions = [
      {
        '@id': 'session/s1/decision/1',
        bids: [
          {
            thread: 'bp:thread/sim_guard_tc-1',
            event: 'bp:event/execute',
            selected: false,
            blockedBy: 'bp:thread/sim_guard_tc-1',
          },
        ],
      },
      {
        '@id': 'session/s1/decision/2',
        bids: [
          {
            thread: 'bp:thread/unblocker',
            event: 'bp:event/simulation_result',
            selected: true,
            interrupts: 'bp:thread/sim_guard_tc-1',
          },
        ],
      },
    ]
    const edges = deriveProvenanceEdges(decisions)
    const unblock = edges.filter((e) => e.kind === 'block_unblock')
    expect(unblock.length).toBe(1)
    expect(unblock[0]!.via).toBe('bp:thread/sim_guard_tc-1')
  })

  test('event chain via EVENT_CAUSATION (task → context_assembly)', () => {
    const decisions = [
      {
        '@id': 'session/s1/decision/1',
        bids: [{ thread: 'bp:thread/t1', event: 'bp:event/task', selected: true }],
      },
      {
        '@id': 'session/s1/decision/2',
        bids: [{ thread: 'bp:thread/t2', event: 'bp:event/context_assembly', selected: true }],
      },
    ]
    const edges = deriveProvenanceEdges(decisions)
    const chain = edges.filter((e) => e.kind === 'event_chain')
    expect(chain.length).toBe(1)
    expect(chain[0]!.via).toBe('task->context_assembly')
  })

  test('empty input → empty', () => {
    expect(deriveProvenanceEdges([])).toEqual([])
  })

  test('single decision → empty', () => {
    const decisions = [
      {
        '@id': 'session/s1/decision/1',
        bids: [{ thread: 'bp:thread/t1', event: 'bp:event/task', selected: true }],
      },
    ]
    expect(deriveProvenanceEdges(decisions)).toEqual([])
  })

  test('proactive event chain (tick → sensor_sweep)', () => {
    const decisions = [
      {
        '@id': 'session/s1/decision/1',
        bids: [{ thread: 'bp:thread/heartbeat', event: 'bp:event/tick', selected: true }],
      },
      {
        '@id': 'session/s1/decision/2',
        bids: [{ thread: 'bp:thread/sensors', event: 'bp:event/sensor_sweep', selected: true }],
      },
    ]
    const edges = deriveProvenanceEdges(decisions)
    const chain = edges.filter((e) => e.kind === 'event_chain')
    expect(chain.length).toBe(1)
    expect(chain[0]!.via).toBe('tick->sensor_sweep')
  })

  test('sensor_delta merges into reactive path via context_assembly', () => {
    const decisions = [
      {
        '@id': 'session/s1/decision/1',
        bids: [{ thread: 'bp:thread/sensors', event: 'bp:event/sensor_delta', selected: true }],
      },
      {
        '@id': 'session/s1/decision/2',
        bids: [{ thread: 'bp:thread/ctx', event: 'bp:event/context_assembly', selected: true }],
      },
    ]
    const edges = deriveProvenanceEdges(decisions)
    const chain = edges.filter((e) => e.kind === 'event_chain')
    expect(chain.length).toBe(1)
    expect(chain[0]!.via).toBe('sensor_delta->context_assembly')
  })

  test('terminal events have no successors in EVENT_CAUSATION', () => {
    expect(EVENT_CAUSATION.has('sleep')).toBe(false)
    expect(EVENT_CAUSATION.has('snapshot_committed')).toBe(false)
    expect(EVENT_CAUSATION.has('consolidate')).toBe(false)
    expect(EVENT_CAUSATION.has('defrag')).toBe(false)
  })

  test('tool_result branches to invoke_inference and commit_snapshot', () => {
    const successors = EVENT_CAUSATION.get('tool_result')
    expect(successors).toBeDefined()
    expect(successors).toContain('invoke_inference')
    expect(successors).toContain('commit_snapshot')
  })

  test('no selected bids → no edges', () => {
    const decisions = [
      {
        '@id': 'session/s1/decision/1',
        bids: [{ thread: 'bp:thread/t1', event: 'bp:event/task', selected: false }],
      },
      {
        '@id': 'session/s1/decision/2',
        bids: [{ thread: 'bp:thread/t1', event: 'bp:event/invoke_inference', selected: false }],
      },
    ]
    const edges = deriveProvenanceEdges(decisions)
    // No thread continuity (none selected), no event chain (none selected)
    expect(edges).toEqual([])
  })
})

// ============================================================================
// buildSessionSummary
// ============================================================================

const FIXTURES_DIR = resolve(import.meta.dir, 'fixtures/hypergraph')

describe('buildSessionSummary', () => {
  test('aggregates thread types', async () => {
    const meta = await buildSessionSummary(FIXTURES_DIR, 'session/test')
    expect(meta.threadTypes.length).toBeGreaterThan(0)
    // From decision fixtures: taskGate, maxIterations, sim_guard_tc-1, batchCompletion, alpha, beta, gamma
    expect(meta.threadTypes).toContain('taskGate')
    expect(meta.threadTypes).toContain('batchCompletion')
  })

  test('aggregates outcome events from selected bids', async () => {
    const meta = await buildSessionSummary(FIXTURES_DIR, 'session/test')
    expect(meta.outcomeEvents.length).toBeGreaterThan(0)
    // decision-001: selected task, decision-002: selected tool_result, decision-003: selected invoke_inference
    expect(meta.outcomeEvents).toContain('task')
    expect(meta.outcomeEvents).toContain('tool_result')
    expect(meta.outcomeEvents).toContain('invoke_inference')
  })

  test('extracts toolsUsed from execute details', async () => {
    // The fixture decisions don't have detail.toolCall.name, so toolsUsed should be empty
    const meta = await buildSessionSummary(FIXTURES_DIR, 'session/test')
    expect(Array.isArray(meta.toolsUsed)).toBe(true)
  })

  test('correct decisionCount', async () => {
    const meta = await buildSessionSummary(FIXTURES_DIR, 'session/test')
    // 4 decision files in fixtures
    expect(meta.decisionCount).toBe(4)
  })

  test('works without embedder (embedding undefined)', async () => {
    const meta = await buildSessionSummary(FIXTURES_DIR, 'session/test')
    expect(meta.embedding).toBeUndefined()
    expect(meta['@type']).toBe('Session')
    expect(meta['@id']).toBe('session/test')
  })

  test('works with embedder mock', async () => {
    const mockEmbedder = {
      embed: async (_text: string) => new Float32Array([0.1, 0.2, 0.3]),
    }
    const meta = await buildSessionSummary(FIXTURES_DIR, 'session/test', mockEmbedder)
    expect(meta.embedding).toBeDefined()
    expect(meta.embedding).toEqual([expect.closeTo(0.1, 2), expect.closeTo(0.2, 2), expect.closeTo(0.3, 2)])
  })

  test('collects commit vertex @id values', async () => {
    const meta = await buildSessionSummary(FIXTURES_DIR, 'session/test')
    expect(meta.commits).toBeDefined()
    expect(meta.commits).toContain('session/sess_test/commit/abc1234')
  })
})
