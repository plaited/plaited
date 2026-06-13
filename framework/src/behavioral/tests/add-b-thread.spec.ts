import { describe, expect, test } from 'bun:test'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { DeadlockSnapshot, FrontierSnapshot, SelectionSnapshot, SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'
import { sync, thread } from '../behavioral.utils.ts'

const onType = (type: string) => ({ type })

describe('addThread', () => {
  test('supports dynamic thread installation from feedback handlers', () => {
    const actual: string[] = []
    const { addThread, trigger, addHandler } = behavioral()

    addThread('addHotOnce', thread([sync({ request: { type: 'hot_1' } })], true))
    addThread(
      'mixHotCold',
      thread([
        sync({
          waitFor: [onType('hot_1'), onType('hot')],
          block: onType('cold'),
        }),
        sync({
          waitFor: onType('cold'),
          block: [onType('hot_1'), onType('hot')],
        }),
      ]),
    )

    addHandler('hot_1', () => {
      actual.push('hot')
      trigger({ type: 'cold' })
      addThread('addMoreHot', thread([sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } })], true))
      addThread('addMoreCold', thread([sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } })], true))
    })
    addHandler('cold', () => {
      actual.push('cold')
    })
    addHandler('hot', () => {
      actual.push('hot')
    })

    trigger({ type: 'start' })

    expect(actual).toHaveLength(6)
    expect(actual.filter((event) => event === 'hot')).toHaveLength(3)
    expect(actual.filter((event) => event === 'cold')).toHaveLength(3)
  })

  test('frontier and selection snapshots include worker requests and selected events', () => {
    const snapshots: SnapshotMessage[] = []
    const completions: string[] = []
    const { addThread, trigger, addHandler, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addThread('workerA', thread([sync({ waitFor: onType('start') }), sync({ request: { type: 'done_a' } })], true))
    addThread('workerB', thread([sync({ waitFor: onType('start') }), sync({ request: { type: 'done_b' } })], true))

    addHandler('done_a', () => {
      completions.push('done')
    })
    addHandler('done_b', () => {
      completions.push('done')
    })

    trigger({ type: 'start' })

    expect(completions).toHaveLength(2)
    const frontierSnapshots = snapshots.filter(
      (snapshot): snapshot is FrontierSnapshot =>
        snapshot.kind === SNAPSHOT_MESSAGE_KINDS.frontier && snapshot.status === 'ready',
    )
    const doneCandidates = frontierSnapshots
      .flatMap((snapshot) => snapshot.candidates)
      .filter((candidate) => candidate.type === 'done_a' || candidate.type === 'done_b')
    expect(new Set(doneCandidates.map((candidate) => candidate.type))).toEqual(new Set(['done_a', 'done_b']))
    expect(doneCandidates.every((candidate) => candidate.ingress === undefined)).toBe(true)

    const selectionSnapshots = snapshots.filter(
      (snapshot): snapshot is SelectionSnapshot => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection,
    )
    expect(selectionSnapshots.some((snapshot) => snapshot.selected.type === 'done_a')).toBe(true)
    expect(selectionSnapshots.some((snapshot) => snapshot.selected.type === 'done_b')).toBe(true)
  })

  test('deadlock snapshots publish frontier status and step continuity', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addThread('guard', thread([sync({ block: onType('dangerous') })]))
    addThread('watchdog', thread([sync({ interrupt: onType('dangerous') })]))
    addThread('requester', thread([sync({ request: { type: 'dangerous' } })], true))

    trigger({ type: 'start' })

    const deadlockFrontier = snapshots.find(
      (snapshot): snapshot is FrontierSnapshot =>
        snapshot.kind === SNAPSHOT_MESSAGE_KINDS.frontier && snapshot.status === 'deadlock',
    )
    expect(deadlockFrontier).toBeDefined()
    expect(deadlockFrontier!.candidates.some((candidate) => candidate.type === 'dangerous')).toBe(true)
    expect(deadlockFrontier!.enabled).toEqual([])

    const deadlockSnapshot = snapshots.find(
      (snapshot): snapshot is DeadlockSnapshot => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.deadlock,
    )
    expect(deadlockSnapshot).toBeDefined()
    expect(deadlockSnapshot!.step).toBe(deadlockFrontier!.step)
  })
})
