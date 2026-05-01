import { describe, expect, test } from 'bun:test'

import type { JsonObject, SnapshotMessage, Spec } from '../../behavioral.ts'
import { replayToFrontier } from '../replay-to-frontier.ts'

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

const deadlockSnapshot = ({ step }: { step: number }): SnapshotMessage => ({
  kind: 'deadlock',
  step,
})

describe('replayToFrontier', () => {
  test('reconstructs the current frontier from selection.selected snapshots', () => {
    const specs: Spec[] = [
      {
        label: 'producer',
        thread: {
          once: true,
          syncPoints: [{ request: { type: 'task' } }],
        },
      },
      {
        label: 'consumer',
        thread: {
          once: true,
          syncPoints: [{ waitFor: [onType('task')] }, { request: { type: 'ack' } }],
        },
      },
    ]

    const result = replayToFrontier({
      specs,
      snapshotMessages: [selectionSnapshot({ type: 'task' })],
    })

    expect(result.frontier).toEqual({
      status: 'ready',
      candidates: [{ priority: 2, type: 'ack' }],
      enabled: [{ priority: 2, type: 'ack' }],
    })
  })

  test('ignores frontier and deadlock snapshots during replay', () => {
    const specs: Spec[] = [
      {
        label: 'chooseA',
        thread: {
          once: true,
          syncPoints: [{ request: { type: 'A' } }],
        },
      },
      {
        label: 'watchA',
        thread: {
          once: true,
          syncPoints: [{ waitFor: [onType('A')] }, { request: { type: 'B' } }],
        },
      },
    ]

    const selectionOnly = replayToFrontier({
      specs,
      snapshotMessages: [selectionSnapshot({ type: 'A' })],
    })

    const withEvidence = replayToFrontier({
      specs,
      snapshotMessages: [
        frontierSnapshot({
          step: 0,
          status: 'ready',
          candidates: [{ priority: 1, type: 'A' }],
          enabled: [{ priority: 1, type: 'A' }],
        }),
        selectionSnapshot({ step: 0, type: 'A' }),
        frontierSnapshot({
          step: 1,
          status: 'ready',
          candidates: [{ priority: 2, type: 'B' }],
          enabled: [{ priority: 2, type: 'B' }],
        }),
        deadlockSnapshot({ step: 1 }),
      ],
    })

    expect(withEvidence).toEqual(selectionOnly)
  })

  test('handles ingress selected events', () => {
    const specs: Spec[] = [
      {
        label: 'watcher',
        thread: {
          once: true,
          syncPoints: [{ waitFor: [onType('ping')] }, { request: { type: 'pong' } }],
        },
      },
    ]

    const result = replayToFrontier({
      specs,
      snapshotMessages: [selectionSnapshot({ type: 'ping', ingress: true })],
    })

    expect(result.frontier).toEqual({
      status: 'ready',
      candidates: [{ priority: 1, type: 'pong' }],
      enabled: [{ priority: 1, type: 'pong' }],
    })
  })

  test('matches ingress selections to internal pending requests by event identity', () => {
    const specs: Spec[] = [
      {
        label: 'requestPing',
        thread: {
          once: true,
          syncPoints: [{ request: { type: 'ping' } }],
        },
      },
    ]

    const result = replayToFrontier({
      specs,
      snapshotMessages: [selectionSnapshot({ type: 'ping', ingress: true })],
    })

    expect(result.frontier).toEqual({
      status: 'idle',
      candidates: [],
      enabled: [],
    })
  })

  test('throws when a selected event is not enabled', () => {
    const specs: Spec[] = [
      {
        label: 'chooseA',
        thread: {
          once: true,
          syncPoints: [{ request: { type: 'A' } }],
        },
      },
    ]

    expect(() =>
      replayToFrontier({
        specs,
        snapshotMessages: [selectionSnapshot({ type: 'B' })],
      }),
    ).toThrow(/not enabled/)
  })
})
