import { describe, expect, test } from 'bun:test'

import type { BPEvent, JsonObject, SnapshotMessage, Spec } from '../../behavioral.ts'
import { exploreFrontiers } from '../explore-frontiers.ts'

const onType = (type: string) => ({ type })

const selectionSnapshot = ({
  step = 0,
  type,
  detail,
  ingress,
}: {
  step?: number
  type: string
  detail?: JsonObject
  ingress?: true
}): SnapshotMessage => ({
  kind: 'selection',
  step,
  selected: {
    type,
    ...(detail === undefined ? {} : { detail }),
    ...(ingress === undefined ? {} : { ingress }),
  },
})

const frontierSnapshot = ({
  step,
  status,
  candidates,
  enabled,
}: {
  step: number
  status: 'ready' | 'deadlock' | 'idle'
  candidates: Array<{ priority: number; type: string; detail?: JsonObject; ingress?: true }>
  enabled: Array<{ priority: number; type: string; detail?: JsonObject; ingress?: true }>
}): SnapshotMessage => ({
  kind: 'frontier',
  step,
  status,
  candidates,
  enabled,
})

const deadlockReachableSpecs = (): Spec[] => [
  {
    label: 'chooseA',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'A' } }],
    },
  },
  {
    label: 'chooseB',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'B' } }],
    },
  },
  {
    label: 'deadlockAfterA',
    thread: {
      once: true,
      syncPoints: [{ waitFor: [onType('A')] }, { block: [onType('B')] }],
    },
  },
]

const branchingSpecs = (): Spec[] => [
  {
    label: 'chooseA',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'A' } }, { request: { type: 'A1' } }],
    },
  },
  {
    label: 'chooseB',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'B' } }, { request: { type: 'B1' } }],
    },
  },
]

const selectedTypes = (trace: { snapshotMessages: SnapshotMessage[] }) =>
  trace.snapshotMessages.flatMap((snapshot) => (snapshot.kind === 'selection' ? [snapshot.selected.type] : []))

describe('exploreFrontiers', () => {
  test('starts from provided snapshotMessages', () => {
    const prefix = [selectionSnapshot({ type: 'A' })]
    const result = exploreFrontiers({
      specs: deadlockReachableSpecs(),
      snapshotMessages: prefix,
    })

    expect(result.traces[0]?.snapshotMessages.slice(0, prefix.length)).toEqual(prefix)
  })

  test('appends frontier snapshots to recorded traces', () => {
    const result = exploreFrontiers({
      specs: deadlockReachableSpecs(),
      maxDepth: 0,
    })

    expect(result.traces).toEqual([
      {
        snapshotMessages: [
          frontierSnapshot({
            step: 0,
            status: 'ready',
            candidates: [
              { priority: 1, type: 'A' },
              { priority: 2, type: 'B' },
            ],
            enabled: [
              { priority: 1, type: 'A' },
              { priority: 2, type: 'B' },
            ],
          }),
        ],
      },
    ])
  })

  test('appends selection snapshots for successors', () => {
    const result = exploreFrontiers({
      specs: deadlockReachableSpecs(),
      maxDepth: 1,
    })

    expect(result.traces).toContainEqual({
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'A' }),
        frontierSnapshot({
          step: 1,
          status: 'deadlock',
          candidates: [{ priority: 2, type: 'B' }],
          enabled: [],
        }),
      ],
    })
    expect(result.traces).toContainEqual({
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'B' }),
        frontierSnapshot({
          step: 1,
          status: 'ready',
          candidates: [{ priority: 1, type: 'A' }],
          enabled: [{ priority: 1, type: 'A' }],
        }),
      ],
    })
  })

  test('orders traces breadth-first with bfs strategy', () => {
    const result = exploreFrontiers({
      specs: branchingSpecs(),
      strategy: 'bfs',
      maxDepth: 2,
    })

    expect(result.traces.map(selectedTypes)).toEqual([
      [],
      ['A'],
      ['B'],
      ['A', 'B'],
      ['A', 'A1'],
      ['B', 'A'],
      ['B', 'B1'],
    ])
  })

  test('orders traces depth-first with dfs strategy', () => {
    const result = exploreFrontiers({
      specs: branchingSpecs(),
      strategy: 'dfs',
      maxDepth: 2,
    })

    expect(result.traces.map(selectedTypes)).toEqual([
      [],
      ['B'],
      ['B', 'B1'],
      ['B', 'A'],
      ['A'],
      ['A', 'A1'],
      ['A', 'B'],
    ])
  })

  test('throws for unsupported direct-call strategy values', () => {
    expect(() =>
      exploreFrontiers({
        specs: branchingSpecs(),
        strategy: 'bogus' as never,
      }),
    ).toThrow(/Unsupported frontier exploration strategy "bogus"/)
  })

  test('deadlock findings end with frontier then deadlock', () => {
    const result = exploreFrontiers({
      specs: deadlockReachableSpecs(),
    })

    expect(result.findings).toContainEqual({
      code: 'deadlock',
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'A' }),
        frontierSnapshot({
          step: 1,
          status: 'deadlock',
          candidates: [{ priority: 2, type: 'B' }],
          enabled: [],
        }),
        {
          kind: 'deadlock',
          step: 1,
        },
      ],
    })
  })

  test('does not record a deadlock finding when a trigger can escape the deadlock', () => {
    const result = exploreFrontiers({
      specs: [
        {
          label: 'requestAck',
          thread: {
            once: true,
            syncPoints: [{ request: { type: 'ack' } }],
          },
        },
        {
          label: 'blockAckUntilPing',
          thread: {
            once: true,
            syncPoints: [{ block: [onType('ack')], waitFor: [onType('ping')] }],
          },
        },
      ],
      triggers: [{ type: 'ping' }],
      maxDepth: 1,
    })

    expect(result.findings).toEqual([])
    expect(result.traces).toContainEqual({
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'ping', ingress: true }),
        frontierSnapshot({
          step: 1,
          status: 'ready',
          candidates: [{ priority: 1, type: 'ack' }],
          enabled: [{ priority: 1, type: 'ack' }],
        }),
      ],
    })
  })

  test('explores supplied trigger events as ingress selections', () => {
    const result = exploreFrontiers({
      specs: [
        {
          label: 'watcher',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }, { request: { type: 'ack' } }],
          },
        },
      ],
      triggers: [{ type: 'ping' }],
      maxDepth: 1,
    })

    expect(result.traces).toContainEqual({
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'ping', ingress: true }),
        frontierSnapshot({
          step: 1,
          status: 'ready',
          candidates: [{ priority: 1, type: 'ack' }],
          enabled: [{ priority: 1, type: 'ack' }],
        }),
      ],
    })
  })

  test('trigger exploration works when a trigger matches a pending request', () => {
    const trigger: BPEvent = { type: 'ping' }
    const result = exploreFrontiers({
      specs: [
        {
          label: 'requestPing',
          thread: {
            once: true,
            syncPoints: [{ request: { type: 'ping' } }],
          },
        },
      ],
      triggers: [trigger],
      maxDepth: 1,
    })

    expect(result.traces).toContainEqual({
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'ping', ingress: true }),
        frontierSnapshot({
          step: 1,
          status: 'idle',
          candidates: [],
          enabled: [],
        }),
      ],
    })
  })

  test('skips unrelated triggers that only satisfy their own ingress request', () => {
    const result = exploreFrontiers({
      specs: [
        {
          label: 'watchPing',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }],
          },
        },
      ],
      triggers: [{ type: 'noise' }],
    })

    expect(result.traces).toEqual([
      {
        snapshotMessages: [
          frontierSnapshot({
            step: 0,
            status: 'idle',
            candidates: [],
            enabled: [],
          }),
        ],
      },
    ])
    expect(result.findings).toEqual([])
    expect(result.report.truncated).toBe(false)
  })

  test('maxDepth counts selections instead of total snapshots', () => {
    const result = exploreFrontiers({
      specs: deadlockReachableSpecs(),
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'B' }),
        frontierSnapshot({
          step: 1,
          status: 'idle',
          candidates: [],
          enabled: [],
        }),
      ],
      maxDepth: 1,
    })

    expect(result.report).toEqual({
      strategy: 'bfs',
      selectionPolicy: 'all-enabled',
      visitedCount: 1,
      findingCount: 0,
      truncated: true,
      maxDepth: 1,
    })
  })

  test('maxDepth marks truncated when it cuts trigger successors from idle frontiers', () => {
    const result = exploreFrontiers({
      specs: [
        {
          label: 'watcher',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }, { request: { type: 'ack' } }],
          },
        },
        {
          label: 'blockAckAfterPing',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }, { block: [onType('ack')] }],
          },
        },
      ],
      triggers: [{ type: 'ping' }],
      maxDepth: 0,
    })

    expect(result.report).toEqual({
      strategy: 'bfs',
      selectionPolicy: 'all-enabled',
      visitedCount: 1,
      findingCount: 0,
      truncated: true,
      maxDepth: 0,
    })
  })
})
