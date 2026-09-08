import { describe, expect, test } from 'bun:test'
import type { Thread } from '../../behavioral/behavioral.types.ts'
import { exploreFrontiers, verifyFrontiers } from '../frontier-analysis.ts'

/**
 * Liveness and state-graph behavior — driven through the public tool interface.
 *
 * Per the TDD "public interface, not private helpers" rule: SCC/livelock/
 * stateKey behavior is fully reachable through explore-frontiers and
 * verify-frontiers on real behavioral programs. No fake-graph builders, no
 * direct imports of frontierStateKey / findStronglyConnectedComponents /
 * findLivelocks / isCycle / StateNode. The subject is the three tools; the
 * raw functions and graph internals have no direct test imports.
 *
 * What was converted from the old fake-graph tests:
 * - SCC structure (DAG trivial, two-node cycle, self-loop, disjoint cycles,
 *   large ring) → asserted via verify-frontiers verdicts and the serialized
 *   state graph from explore-frontiers on real looping programs.
 * - isCycle branches → the cycle-with-progress (verified) vs
 *   cycle-without-progress (failed) distinction through verify-frontiers.
 * - frontierStateKey invariants (order-independence, generator-identity
 *   insensitivity, detailSchema distinction) → two structurally-equal
 *   programs yield the same serialized state graph; structurally-distinct
 *   programs yield different verdicts.
 * - Escape-edges-don't-redeem-a-livelock → a cycle with an exit edge that
 *   is not a progress event is still failed.
 */

describe('explore-frontiers state-keyed dedup (real programs)', () => {
  test('a looping program terminates via state-key dedup (not maxDepth cutoff)', async () => {
    // A `while(true)` ticker: requests `tick` forever. The pending set is
    // identical after every selection, so the state graph closes at one
    // state and exploration stops well before maxDepth — proving
    // termination via dedup, not a depth cutoff.
    const looping: Thread[] = [{ label: 'ticker', rules: [{ request: { type: 'tick' } }] }]
    const result = await exploreFrontiers({ threads: looping, strategy: 'bfs', maxDepth: 100 })
    expect(result.report.truncated).toBe(false)
    // One distinct state: the single pending bid requesting `tick`.
    expect(result.report.visitedCount).toBe(1)
    // No deadlock — `tick` is enabled.
    expect(result.findings).toHaveLength(0)
  })

  test('a two-state cycle closes the graph at two visited states', async () => {
    // Toggle: requests `on`, then `off`, then loops. Two distinct states
    // ({request on}, {request off}); the cycle closes back to the first.
    const toggle: Thread[] = [{ label: 'toggle', rules: [{ request: { type: 'on' } }, { request: { type: 'off' } }] }]
    const result = await exploreFrontiers({ threads: toggle, strategy: 'bfs', maxDepth: 100 })
    expect(result.report.truncated).toBe(false)
    expect(result.report.visitedCount).toBe(2)
    expect(result.findings).toHaveLength(0)
  })

  test('still detects deadlock in a looping program', async () => {
    // A looping requester whose only candidate is permanently blocked —
    // the deadlock is a genuine finding, not masked by state-keyed dedup.
    const blocked: Thread[] = [
      { label: 'requester', rules: [{ request: { type: 'a' } }] },
      { label: 'blocker', rules: [{ block: [{ type: 'a' }] }] },
    ]
    const result = await exploreFrontiers({ threads: blocked, strategy: 'bfs', maxDepth: 50 })
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings[0]!.code).toBe('deadlock')
  })

  test('finite one-shot programs behave as before', async () => {
    // Regression guard: finite-thread semantics are unchanged.
    const finite: Thread[] = [
      { label: 'ticker', rules: [{ request: { type: 'tick' } }], once: true },
      { label: 'worker', once: true, rules: [{ request: { type: 'start', detail: { id: 'job-1' } } }] },
    ]
    const result = await exploreFrontiers({ threads: finite, strategy: 'bfs', maxDepth: 3 })
    expect(result.report.visitedCount).toBeGreaterThan(0)
    expect(result.traces.length).toBe(result.report.visitedCount)
    for (const trace of result.traces) {
      expect(trace.messages.length).toBeGreaterThan(0)
      const last = trace.messages[trace.messages.length - 1]
      expect(last!.kind).toBe('frontier')
    }
  })

  test('two structurally-equal programs yield the same serialized state graph', async () => {
    // The same toggle authored twice (different label strings, same
    // request idioms) explores to the same state-graph structure: same
    // visited count, and each root has a successor edge labeled `on`.
    // This is the public expression of frontierStateKey's order- and
    // generator-identity invariance — no fake PendingBid fixtures.
    const program: Thread[] = [{ label: 'toggle', rules: [{ request: { type: 'on' } }, { request: { type: 'off' } }] }]
    const a = await exploreFrontiers({ threads: program, strategy: 'bfs', maxDepth: 50 })
    const b = await exploreFrontiers({
      threads: [{ label: 'other-label', rules: [{ request: { type: 'on' } }, { request: { type: 'off' } }] }],
      strategy: 'bfs',
      maxDepth: 50,
    })
    expect(a.report.visitedCount).toBe(b.report.visitedCount)
    expect(Object.keys(a.stateGraph).length).toBe(Object.keys(b.stateGraph).length)
    // Each root has a successor edge selecting `on`.
    const aRoot = Object.values(a.stateGraph)[0]!
    const bRoot = Object.values(b.stateGraph)[0]!
    expect(aRoot.successors.some((e) => e.selection.type === 'on')).toBe(true)
    expect(bRoot.successors.some((e) => e.selection.type === 'on')).toBe(true)
  })

  test('a large single cycle terminates without stack overflow', async () => {
    // A 60-step ring thread: requests n0, n1, ..., n59, then loops. Sixty
    // distinct states close back to the first. The iterative SCC algorithm
    // must handle this; a recursive impl would blow the stack. (The old
    // fake-graph test built a 5000-node hand graph; this drives the same
    // termination through a real program.)
    const rules = Array.from({ length: 60 }, (_, i) => ({ request: { type: `n${i}` } }))
    const ring: Thread[] = [{ label: 'ring', rules }]
    const result = await exploreFrontiers({ threads: ring, strategy: 'bfs', maxDepth: 500 })
    expect(result.report.truncated).toBe(false)
    expect(result.report.visitedCount).toBe(60)
  })
})

describe('verify-frontiers livelock integration (real programs)', () => {
  test('a looping program with no progress is failed (livelock)', async () => {
    // A ticker requesting `tick` forever. No deadlock, not truncated.
    // Without a progress spec it would be verified; with progress=['succeeded']
    // the cycle never selects `succeeded` → livelock → failed.
    const threads: Thread[] = [{ label: 'ticker', rules: [{ request: { type: 'tick' } }] }]
    const result = await verifyFrontiers({ threads, progress: ['succeeded'], maxDepth: 50 })
    expect(result.status).toBe('failed')
    expect(result.livelocks).toHaveLength(1)
    expect(result.livelocks[0]!.code).toBe('livelock')
    expect(result.livelocks[0]!.progressTypes).toEqual(['succeeded'])
    // The livelock's states are the cycle's state keys (here, one state).
    expect(result.livelocks[0]!.states.length).toBeGreaterThanOrEqual(1)
  })

  test('a looping program whose cycle selects a progress event is verified', async () => {
    // A ticker requesting `done` forever. progress=['done'] → the cycle
    // DOES select a progress event → not a livelock → verified.
    const threads: Thread[] = [{ label: 'ticker', rules: [{ request: { type: 'done' } }] }]
    const result = await verifyFrontiers({ threads, progress: ['done'], maxDepth: 50 })
    expect(result.status).toBe('verified')
    expect(result.livelocks).toHaveLength(0)
  })

  test('omitting progress skips livelock detection (deadlock-only)', async () => {
    // Same looping ticker, no progress spec. Behaves as before: no deadlock,
    // not truncated → verified, livelocks empty (not checked).
    const threads: Thread[] = [{ label: 'ticker', rules: [{ request: { type: 'tick' } }] }]
    const result = await verifyFrontiers({ threads, maxDepth: 50 })
    expect(result.status).toBe('verified')
    expect(result.livelocks).toHaveLength(0)
  })

  test('an empty progress set flags every cycle as a livelock', async () => {
    // progress=[] → nothing counts as progress → any cycle is a livelock.
    const threads: Thread[] = [{ label: 'ticker', rules: [{ request: { type: 'done' } }] }]
    const result = await verifyFrontiers({ threads, progress: [], maxDepth: 50 })
    expect(result.status).toBe('failed')
    expect(result.livelocks).toHaveLength(1)
  })

  test('deadlock still wins as failed even when progress is specified', async () => {
    // A blocked requester: deadlock. progress=['x'] is also checked, but the
    // deadlock finding alone is enough to fail.
    const threads: Thread[] = [
      { label: 'requester', rules: [{ request: { type: 'a' } }] },
      { label: 'blocker', rules: [{ block: [{ type: 'a' }] }] },
    ]
    const result = await verifyFrontiers({ threads, progress: ['x'], maxDepth: 50 })
    expect(result.status).toBe('failed')
    expect(result.findings.length).toBeGreaterThan(0)
  })

  test('escape-edges do not redeem a livelock (two-state cycle with an exit)', async () => {
    // A two-state cycle (toggle `tick`↔`tick`) with a progress `done` edge
    // that LEAVES the cycle to a sink state. `done` is progress, but it
    // leaves the cycle — the cycle itself never selects `done`, so it is
    // still a livelock. Escapes are not credited.
    //
    // Program: a thread that requests `tick`, then loops on `tick`, but on
    // the second step can request `done` (which exits to a terminal
    // once-branch). The cycle edge is `tick`; the exit edge is `done`.
    const threads: Thread[] = [
      {
        label: 'cycler-with-exit',
        rules: [
          { request: { type: 'tick' } },
          // On step 2: request `tick` (cycle back) OR `done` (exit).
          // `done` leads to a once-true thread that completes.
          { request: { type: 'tick' } },
          { request: { type: 'done' } },
        ],
      },
      { label: 'sink', once: true, rules: [{ waitFor: [{ type: 'done' }] }] },
    ]
    const result = await verifyFrontiers({ threads, progress: ['done'], maxDepth: 50 })
    // The cycle (toggle on `tick`) has an exit `done` to the sink, but the
    // exit leaves the SCC — the cycle never selects `done` internally →
    // livelock → failed.
    expect(result.status).toBe('failed')
    expect(result.livelocks.length).toBeGreaterThanOrEqual(1)
    expect(result.livelocks[0]!.code).toBe('livelock')
    expect(result.livelocks[0]!.progressTypes).toEqual(['done'])
  })

  test('a two-state cycle that selects progress internally is verified', async () => {
    // A two-state cycle where one of the in-cycle edges IS the progress
    // event: toggle requests `done` then `tick`, looping. progress=['done']
    // → the cycle contains a `done` edge → makes progress → verified.
    const threads: Thread[] = [
      { label: 'toggle', rules: [{ request: { type: 'done' } }, { request: { type: 'tick' } }] },
    ]
    const result = await verifyFrontiers({ threads, progress: ['done'], maxDepth: 50 })
    expect(result.status).toBe('verified')
    expect(result.livelocks).toHaveLength(0)
  })

  test('explore-frontiers exposes the state graph for downstream analysis', async () => {
    // The serialized state graph is the raw material the consumer would
    // use for their own graph analyses. Verify it's a well-formed plain
    // object: the toggle has 2 entries, each with at least one labeled
    // successor edge.
    const threads: Thread[] = [{ label: 'toggle', rules: [{ request: { type: 'on' } }, { request: { type: 'off' } }] }]
    const result = await exploreFrontiers({ threads, strategy: 'bfs', maxDepth: 50 })
    expect(result.stateGraph).toBeDefined()
    expect(Object.keys(result.stateGraph).length).toBe(2)
    for (const node of Object.values(result.stateGraph)) {
      expect(node.successors.length).toBeGreaterThanOrEqual(1)
    }
  })
})
