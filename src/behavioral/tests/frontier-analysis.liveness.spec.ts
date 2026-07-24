import { describe, expect, test } from 'bun:test'
import type { PendingBid } from '../behavioral.types.ts'
import { frontierStateKey } from '../frontier-analysis.ts'

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
