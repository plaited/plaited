import { describe, expect, test } from 'bun:test'
import type { Thread } from '../behavioral.schemas.ts'
import type { PendingBid } from '../behavioral.types.ts'
import { exploreFrontiers, findStronglyConnectedComponents, frontierStateKey } from '../frontier-analysis.ts'

type FakeNode = { successors: Array<{ to: string }> }

const graph = (nodes: Record<string, string[]>): Map<string, FakeNode> =>
  new Map(Object.entries(nodes).map(([key, targets]) => [key, { successors: targets.map((to) => ({ to })) }]))

/**
 * Step 1 — canonical state-key helper.
 *
 * `frontierStateKey` collapses a pending set to a stable string that is
 * invariant under reordering and insensitive to non-stateful artifacts
 * (generator closures, compiled validators, opaque payloads). This is the
 * abstraction that lets `exploreFrontiers` close the state graph for looping
 * programs instead of chasing ever-growing traces.
 *
 * These tests are written FIRST (red). Implement `frontierStateKey` to turn
 * them green.
 */

/** Build a PendingBid with a throwaway generator so tests stay pure. */
const bid = (fields: Omit<PendingBid, 'generator'>): PendingBid => ({
  ...fields,
  generator: (function* () {
    /* dummy */
  })(),
})

describe('frontierStateKey', () => {
  test('empty pending set yields a deterministic key', () => {
    const key = frontierStateKey({ pending: new Set<PendingBid>() })
    expect(typeof key).toBe('string')
    expect(frontierStateKey({ pending: new Set<PendingBid>() })).toBe(key)
  })

  test('is invariant under pending-set insertion order', () => {
    const first = new Set<PendingBid>([
      bid({ label: 'a', priority: 1, request: { type: 'x' } }),
      bid({ label: 'b', priority: 2, waitFor: [{ type: 'y', validate: () => true }] }),
    ])
    const second = new Set<PendingBid>([
      bid({ label: 'b', priority: 2, waitFor: [{ type: 'y', validate: () => true }] }),
      bid({ label: 'a', priority: 1, request: { type: 'x' } }),
    ])
    expect(frontierStateKey({ pending: first })).toBe(frontierStateKey({ pending: second }))
  })

  test('ignores generator identity (state is the yielded idioms, not the closure)', () => {
    const withGenOne = new Set<PendingBid>([bid({ label: 'a', priority: 1, request: { type: 'x' } })])
    const withGenTwo = new Set<PendingBid>([
      { label: 'a', priority: 1, request: { type: 'x' }, generator: (function* () {})() },
    ])
    expect(frontierStateKey({ pending: withGenOne })).toBe(frontierStateKey({ pending: withGenTwo }))
  })

  test('drops compiled validators but keeps the JSON-Schema constraint', () => {
    const schema = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
    const loose = new Set<PendingBid>([
      bid({ label: 'w', priority: 1, waitFor: [{ type: 'done', validate: () => true }] }),
    ])
    const strict = new Set<PendingBid>([
      bid({
        label: 'w',
        priority: 1,
        waitFor: [{ type: 'done', detailSchema: schema, validate: () => true }],
      }),
    ])
    expect(frontierStateKey({ pending: loose })).not.toBe(frontierStateKey({ pending: strict }))
  })

  test('distinguishes request type', () => {
    const left = new Set<PendingBid>([bid({ label: 'a', priority: 1, request: { type: 'x' } })])
    const right = new Set<PendingBid>([bid({ label: 'a', priority: 1, request: { type: 'y' } })])
    expect(frontierStateKey({ pending: left })).not.toBe(frontierStateKey({ pending: right }))
  })

  test('distinguishes request detail', () => {
    const left = new Set<PendingBid>([bid({ label: 'a', priority: 1, request: { type: 'x', detail: { n: 1 } } })])
    const right = new Set<PendingBid>([bid({ label: 'a', priority: 1, request: { type: 'x', detail: { n: 2 } } })])
    expect(frontierStateKey({ pending: left })).not.toBe(frontierStateKey({ pending: right }))
  })

  test('drops the opaque payload side-channel', () => {
    const withPayload = new Set<PendingBid>([
      bid({ label: 'a', priority: 1, request: { type: 'x', payload: { secret: 'no' } as unknown } }),
    ])
    const withoutPayload = new Set<PendingBid>([bid({ label: 'a', priority: 1, request: { type: 'x' } })])
    expect(frontierStateKey({ pending: withPayload })).toBe(frontierStateKey({ pending: withoutPayload }))
  })
})

/**
 * Step 2 — state-keyed dedup + explicit labeled state graph.
 *
 * `exploreFrontiers` must deduplicate on `frontierStateKey` (the canonical state)
 * rather than the full message trace, so finite-state looping programs
 * terminate without relying on `maxDepth`. The exploration also builds an
 * explicit labeled state graph (nodes keyed by state, edges labeled by the
 * selected event) as the raw material for Step 3 cycle detection.
 *
 * Written FIRST (red). Implement state-keyed dedup + graph construction to
 * turn these green.
 */
describe('exploreFrontiers state-keyed dedup', () => {
  test('terminates early (state graph closes) on a looping program', () => {
    // A `while(true)` ticker: requests `tick` forever. Under trace-keyed dedup
    // the trace grows every step, so a generous maxDepth is needed to keep the
    // red phase from hanging. Under state-keyed dedup the pending set is
    // identical after every selection, so the graph closes at one state and
    // exploration stops well before maxDepth — proving termination, not a
    // depth cutoff.
    const looping: Thread[] = [['ticker', { rules: [{ request: { type: 'tick' } }] }]]
    const result = exploreFrontiers({ threads: looping, strategy: 'bfs', maxDepth: 100 })
    expect(result.report.truncated).toBe(false)
    // One distinct state: the single pending bid requesting `tick`.
    expect(result.report.visitedCount).toBe(1)
    // No deadlock — `tick` is enabled.
    expect(result.findings).toHaveLength(0)
  })

  test('terminates early on a two-state cycle', () => {
    // Toggle: requests `on`, then `off`, then loops. Two distinct states
    // ({request on}, {request off}); the cycle closes back to the first
    // state. Generous maxDepth keeps the red phase from hanging.
    const toggle: Thread[] = [['toggle', { rules: [{ request: { type: 'on' } }, { request: { type: 'off' } }] }]]
    const result = exploreFrontiers({ threads: toggle, strategy: 'bfs', maxDepth: 100 })
    expect(result.report.truncated).toBe(false)
    expect(result.report.visitedCount).toBe(2)
    expect(result.findings).toHaveLength(0)
  })

  test('still detects deadlock in a looping program', () => {
    // A looping requester whose only candidate is permanently blocked — the
    // deadlock is a genuine finding, not masked by state-keyed dedup.
    const blocked: Thread[] = [
      ['requester', { rules: [{ request: { type: 'a' } }] }],
      ['blocker', { rules: [{ block: [{ type: 'a' }] }] }],
    ]
    const result = exploreFrontiers({ threads: blocked, strategy: 'bfs' })
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings[0]!.code).toBe('deadlock')
  })

  test('finite one-shot programs still behave as before', () => {
    // Regression guard: the existing finite-thread semantics are unchanged.
    const finite: Thread[] = [
      ['ticker', { rules: [{ request: { type: 'tick' } }], once: true }],
      ['worker', { once: true, rules: [{ request: { type: 'start', detail: { id: 'job-1' } } }] }],
    ]
    const result = exploreFrontiers({ threads: finite, strategy: 'bfs', maxDepth: 3 })
    expect(result.report.visitedCount).toBeGreaterThan(0)
    expect(result.traces.length).toBe(result.report.visitedCount)
    for (const trace of result.traces) {
      expect(trace.messages.length).toBeGreaterThan(0)
      const last = trace.messages[trace.messages.length - 1]
      expect(last!.kind).toBe('frontier')
    }
  })
})

/**
 * Step 3 — strongly connected components (Tarjan, iterative).
 *
 * `findStronglyConnectedComponents` returns the SCCs of a labeled state graph
 * (the structure `exploreFrontiers` builds as a side effect). An SCC of size
 * > 1, or a single node with a self-edge, is a cycle — the raw material for
 * Step 4's livelock detection. The helper is pure and depends only on node
 * adjacency (`successors: Array<{ to }>`), so tests build fake graphs directly.
 *
 * Written FIRST (red). Implement to turn green.
 */
describe('findStronglyConnectedComponents', () => {
  test('a DAG yields only trivial single-node SCCs', () => {
    // A -> B -> C, no cycles. Each node is its own trivial SCC.
    const g = graph({ A: ['B'], B: ['C'], C: [] })
    const sccs = findStronglyConnectedComponents(g)
    expect(sccs).toHaveLength(3)
    for (const scc of sccs) expect(scc).toHaveLength(1)
  })

  test('a two-node cycle is one SCC of size 2', () => {
    // A <-> B. Both in one SCC.
    const g = graph({ A: ['B'], B: ['A'] })
    const sccs = findStronglyConnectedComponents(g)
    expect(sccs).toHaveLength(1)
    expect(sccs[0]!).toHaveLength(2)
    expect([...sccs[0]!].sort()).toEqual(['A', 'B'])
  })

  test('a single node with a self-edge is a (trivial-looking but cyclic) SCC', () => {
    // A -> A. Size-1 SCC, but it IS a cycle. (isCycle interpretation is Step 4.)
    const g = graph({ A: ['A'] })
    const sccs = findStronglyConnectedComponents(g)
    expect(sccs).toHaveLength(1)
    expect(sccs[0]!).toEqual(['A'])
  })

  test('isolates a cycle embedded in a larger graph', () => {
    // A -> B <-> C -> D. {B,C} form an SCC; A and D are trivial.
    const g = graph({ A: ['B'], B: ['C'], C: ['B', 'D'], D: [] })
    const sccs = findStronglyConnectedComponents(g)
    expect(sccs).toHaveLength(3)
    const cycle = sccs.find((s) => s.length === 2)
    expect(cycle).toBeDefined()
    expect([...cycle!].sort()).toEqual(['B', 'C'])
  })

  test('handles two disjoint cycles in one graph', () => {
    // A <-> B   and   C <-> D, plus a bridge A -> C.
    const g = graph({ A: ['B', 'C'], B: ['A'], C: ['D'], D: ['C'] })
    const sccs = findStronglyConnectedComponents(g)
    const big = sccs.filter((s) => s.length === 2)
    expect(big).toHaveLength(2)
    const labels = big.map((s) => [...s].sort().join(',')).sort()
    expect(labels).toEqual(['A,B', 'C,D'])
  })

  test('an empty graph yields no SCCs', () => {
    expect(findStronglyConnectedComponents(new Map())).toEqual([])
  })

  test('terminates on a large single cycle without stack overflow', () => {
    // 5000 nodes in one big ring: 0 -> 1 -> ... -> 4999 -> 0.
    // Iterative Tarjan must handle this; a recursive impl would blow the stack.
    const nodes: Record<string, string[]> = {}
    for (let i = 0; i < 5000; i++) nodes[String(i)] = [String((i + 1) % 5000)]
    const g = graph(nodes)
    const sccs = findStronglyConnectedComponents(g)
    expect(sccs).toHaveLength(1)
    expect(sccs[0]!).toHaveLength(5000)
  })
})
