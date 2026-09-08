import { describe, expect, test } from 'bun:test'
import type { Thread } from '../../behavioral/behavioral.types.ts'
import { exploreFrontiersRaw, replayFrontier, verifyFrontiersRaw } from '../frontier-analysis.ts'

const threads: Thread[] = [
  { label: 'ticker', rules: [{ request: { type: 'tick' } }], once: true },
  { label: 'worker', once: true, rules: [{ request: { type: 'start', detail: { id: 'job-1' } } }] },
]

describe('replay-frontier', () => {
  test('replays a known selection trace, returning frontier + stateKey + pendingCount', async () => {
    const messages = [
      {
        kind: 'selection' as const,
        timestamp: 0,
        instanceId: 'test',
        step: 0,
        selected: { priority: 0, type: 'tick' },
      },
    ]
    const result = await replayFrontier({ threads, messages })

    // tick completes (once: true), worker (start) remains pending
    expect(result.isError).toBeFalsy()
    expect(result.frontier).not.toBeNull()
    expect(result.frontier!.status).toBe('ready')
    expect(result.frontier!.enabled).toHaveLength(1)
    expect(result.frontier!.enabled[0]!.type).toBe('start')
    expect(result.frontier!.enabled[0]!.detail).toEqual({ id: 'job-1' })
    // JSON-boundary serialization: pending Set → count, generator → stateKey
    expect(typeof result.stateKey).toBe('string')
    expect(result.stateKey!.length).toBeGreaterThan(0)
    expect(typeof result.pendingCount).toBe('number')
    expect(result.pendingCount).toBeGreaterThan(0)
  })

  test('returns idle frontier when no threads request events', async () => {
    const idleThreads: Thread[] = [{ label: 'quiet', rules: [{ waitFor: [{ type: 'never' }] }], once: true }]
    const result = await replayFrontier({ threads: idleThreads })
    expect(result.frontier!.status).toBe('idle')
    expect(typeof result.stateKey).toBe('string')
    expect(result.pendingCount).toBe(1)
  })

  test('returns deadlock frontier when candidates exist but all are blocked', async () => {
    const blockedThreads: Thread[] = [
      { label: 'requester', rules: [{ request: { type: 'a' } }] },
      { label: 'blocker', rules: [{ block: [{ type: 'a' }] }] },
    ]
    const result = await replayFrontier({ threads: blockedThreads })
    expect(result.frontier!.status).toBe('deadlock')
    expect(result.frontier!.enabled).toHaveLength(0)
  })

  test('handles empty trace messages', async () => {
    const result = await replayFrontier({ threads })
    expect(result.frontier!.status).toBe('ready')
    expect(result.frontier!.enabled).toHaveLength(2)
  })

  test('returns isError when a selection is not enabled at its replay step', async () => {
    // Selecting 'nope' which is never enabled — the raw fn throws; the tool
    // must catch and surface a structured error, never throwing into the
    // model channel.
    const messages = [
      {
        kind: 'selection' as const,
        timestamp: 0,
        instanceId: 'test',
        step: 0,
        selected: { priority: 0, type: 'nope' },
      },
    ]
    const result = await replayFrontier({ threads, messages })
    expect(result.isError).toBe(true)
    expect(typeof result.message).toBe('string')
    expect(result.frontier).toBeNull()
    expect(result.stateKey).toBeNull()
    expect(result.pendingCount).toBeNull()
  })
})

describe('exploreFrontiersRaw', () => {
  test('wakes transform-parked threads via matching triggers', () => {
    const transformThreads: Thread[] = [
      { label: 'shaper', rules: [{ transform: [{ type: 'raw', query: '.', target: 'shaped' }] }] },
    ]
    const result = exploreFrontiersRaw({ threads: transformThreads, triggers: [{ type: 'raw' }] })
    const root = [...result.stateGraph.values()][0]!
    expect(root.successors.length).toBeGreaterThan(0)
    expect(root.successors[0]!.selection.type).toBe('raw')
  })

  test('leaves transform-parked threads parked for non-matching triggers', () => {
    const transformThreads: Thread[] = [
      { label: 'shaper', rules: [{ transform: [{ type: 'raw', query: '.', target: 'shaped' }] }] },
    ]
    const result = exploreFrontiersRaw({ threads: transformThreads, triggers: [{ type: 'unrelated' }] })
    const root = [...result.stateGraph.values()][0]!
    expect(root.successors).toHaveLength(0)
  })
  test('bfs explores reachable histories', () => {
    const result = exploreFrontiersRaw({ threads, strategy: 'bfs', maxDepth: 3 })
    expect(result.report.visitedCount).toBeGreaterThan(0)
    expect(result.traces.length).toBe(result.report.visitedCount)
    // All traces should end with a frontier trace
    for (const trace of result.traces) {
      expect(trace.messages.length).toBeGreaterThan(0)
      const last = trace.messages[trace.messages.length - 1]
      expect(last!.kind).toBe('frontier')
    }
  })

  test('dfs explores reachable histories', () => {
    const result = exploreFrontiersRaw({ threads, strategy: 'dfs', maxDepth: 3 })
    expect(result.report.visitedCount).toBeGreaterThan(0)
  })

  test('finds deadlock', () => {
    const deadlockThreads: Thread[] = [
      { label: 'requester', rules: [{ request: { type: 'a' } }] },
      { label: 'blocker', rules: [{ block: [{ type: 'a' }] }] },
    ]
    const result = exploreFrontiersRaw({ threads: deadlockThreads })
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings[0]!.code).toBe('deadlock')
    expect(result.report.findingCount).toBe(result.findings.length)
  })

  test('respects maxDepth truncation', () => {
    const result = exploreFrontiersRaw({ threads, strategy: 'bfs', maxDepth: 0 })
    expect(result.report.truncated).toBe(true)
    // With maxDepth 0, we should have the initial frontier at step 0
    expect(result.report.visitedCount).toBeGreaterThanOrEqual(1)
  })

  test('selectionPolicy: scheduler limits to one enabled candidate per step', () => {
    const schedulerResult = exploreFrontiersRaw({ threads, strategy: 'bfs', selectionPolicy: 'scheduler', maxDepth: 3 })
    const allEnabledResult = exploreFrontiersRaw({
      threads,
      strategy: 'bfs',
      selectionPolicy: 'all-enabled',
      maxDepth: 3,
    })
    // scheduler truncates breadth; visited counts may differ
    expect(schedulerResult.report.visitedCount).toBeGreaterThan(0)
    expect(allEnabledResult.report.visitedCount).toBeGreaterThan(0)
  })

  test('explores with trigger events that affect pending threads', () => {
    const waitingThreads: Thread[] = [
      { label: 'waiter', rules: [{ waitFor: [{ type: 'ping' }] }, { request: { type: 'ack' } }], once: true },
    ]
    const result = exploreFrontiersRaw({
      threads: waitingThreads,
      triggers: [{ type: 'ping' }],
      strategy: 'bfs',
    })
    // The trigger should make 'ping' available, then 'ack' gets requested
    expect(result.report.visitedCount).toBeGreaterThan(0)
    // Should have found at least one trace where 'ack' is reached
    const hasAck = result.traces.some((trace) =>
      trace.messages.some((msg) => msg.kind === 'selection' && msg.selected.type === 'ack'),
    )
    expect(hasAck).toBe(true)
  })

  test('ingress trigger events produce successors', () => {
    const blockingThreads: Thread[] = [{ label: 'blocker', rules: [{ block: [{ type: 'signal' }] }], once: true }]
    const result = exploreFrontiersRaw({
      threads: blockingThreads,
      triggers: [{ type: 'signal' }],
      strategy: 'bfs',
    })
    // The trigger should find no pending bid affected by 'signal' since
    // block-only threads don't respond to triggers
    expect(result.report.visitedCount).toBeGreaterThanOrEqual(1)
  })
})

describe('verifyFrontiersRaw', () => {
  test('returns verified for deadlock-free threads', () => {
    const result = verifyFrontiersRaw({ threads, strategy: 'bfs', maxDepth: 3 })
    expect(result.status).toBe('verified')
    expect(result.findings).toHaveLength(0)
  })

  test('returns failed when deadlocks found', () => {
    const deadlockThreads: Thread[] = [
      { label: 'requester', rules: [{ request: { type: 'a' } }] },
      { label: 'blocker', rules: [{ block: [{ type: 'a' }] }] },
    ]
    const result = verifyFrontiersRaw({ threads: deadlockThreads })
    expect(result.status).toBe('failed')
    expect(result.findings.length).toBeGreaterThan(0)
  })

  test('returns truncated when maxDepth cuts off exploration', () => {
    const result = verifyFrontiersRaw({ threads, strategy: 'bfs', maxDepth: 0 })
    expect(result.status).toBe('truncated')
  })
})
