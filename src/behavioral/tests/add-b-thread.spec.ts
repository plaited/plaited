import { describe, expect, test } from 'bun:test'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { DeadlockSnapshot, SelectionSnapshot, SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral, onType, sync, thread } from './helpers.ts'

describe('addBThreads', () => {
  test('supports dynamic thread installation from feedback handlers', () => {
    const actual: string[] = []
    const { addBThreads, trigger, useFeedback } = behavioral()

    addBThreads({
      addHotOnce: sync({ request: { type: 'hot_1' } }),
      mixHotCold: thread(
        [
          sync({
            waitFor: [onType('hot_1'), onType('hot')],
            block: onType('cold'),
          }),
          sync({
            waitFor: onType('cold'),
            block: [onType('hot_1'), onType('hot')],
          }),
        ],
        true,
      ),
    })

    useFeedback({
      hot_1() {
        actual.push('hot')
        trigger({ type: 'cold' })
        addBThreads({
          addMoreHot: thread([sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } })]),
          addMoreCold: thread([sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } })]),
        })
      },
      cold() {
        actual.push('cold')
      },
      hot() {
        actual.push('hot')
      },
    })

    trigger({ type: 'start' })

    expect(actual).toHaveLength(6)
    expect(actual.filter((event) => event === 'hot')).toHaveLength(3)
    expect(actual.filter((event) => event === 'cold')).toHaveLength(3)
  })

  test('selection snapshots include thread labels for independently added workers', () => {
    const snapshots: SnapshotMessage[] = []
    const completions: string[] = []
    const { addBThreads, trigger, useFeedback, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      workerA: thread([sync({ waitFor: onType('start') }), sync({ request: { type: 'done_a' } })]),
      workerB: thread([sync({ waitFor: onType('start') }), sync({ request: { type: 'done_b' } })]),
    })

    useFeedback({
      done_a() {
        completions.push('done')
      },
      done_b() {
        completions.push('done')
      },
    })

    trigger({ type: 'start' })

    expect(completions).toHaveLength(2)
    const selectionSnapshots = snapshots.filter(
      (snapshot): snapshot is SelectionSnapshot => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection,
    )
    const doneBids = selectionSnapshots
      .flatMap((snapshot) => snapshot.bids)
      .filter((bid) => bid.type === 'done_a' || bid.type === 'done_b')

    expect(new Set(doneBids.map((bid) => bid.thread.label))).toEqual(new Set(['workerA', 'workerB']))
    expect(doneBids.every((bid) => !bid.thread.id || bid.thread.id.length > 0)).toBe(true)
  })

  test('deadlock snapshots preserve blocker and interrupter labels', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      guard: thread([sync({ block: onType('dangerous') })], true),
      watchdog: thread([sync({ interrupt: onType('dangerous') })], true),
      requester: thread([sync({ request: { type: 'dangerous' } })]),
    })

    trigger({ type: 'start' })

    const deadlockSnapshot = snapshots.find(
      (snapshot): snapshot is DeadlockSnapshot => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.deadlock,
    )
    expect(deadlockSnapshot).toBeDefined()

    const dangerousBid = deadlockSnapshot?.bids.find((bid) => bid.type === 'dangerous')
    expect(dangerousBid).toBeDefined()
    expect(dangerousBid?.blockedBy?.label).toBe('guard')
    expect(dangerousBid?.interrupts?.label).toBe('watchdog')
    expect(deadlockSnapshot?.summary.blockers.map((ref) => ref.label)).toEqual(['guard'])
    expect(deadlockSnapshot?.summary.interrupters.map((ref) => ref.label)).toEqual(['watchdog'])
  })
})
