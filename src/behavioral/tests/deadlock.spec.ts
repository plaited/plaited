import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread, type DeadlockSnapshot, type SnapshotMessage } from 'plaited/behavioral'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'

describe(SNAPSHOT_MESSAGE_KINDS.deadlock, () => {
  test('publishes deadlock snapshot when candidates exist but none are selectable', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      safety: bThread([bSync({ block: 'dangerous' })], true),
      interruptor: bThread([bSync({ interrupt: 'dangerous' })], true),
    })

    trigger({ type: 'dangerous' })

    const deadlocks = snapshots.filter((s): s is DeadlockSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(deadlocks).toHaveLength(1)

    const dangerousBid = deadlocks[0]!.bids.find((bid) => bid.type === 'dangerous')
    expect(dangerousBid).toBeDefined()
    expect(dangerousBid!.selected).toBe(false)
    expect(dangerousBid!.reason).toBe('blocked')
    expect(dangerousBid!.blockedBy).toEqual({ label: 'safety' })
    expect(dangerousBid!.interrupts).toEqual({ label: 'interruptor' })
    expect(dangerousBid!.trigger).toBe(true)
    expect(deadlocks[0]!.summary).toEqual({
      candidateCount: 1,
      blockedCount: 1,
      unblockedCount: 0,
      blockers: [{ label: 'safety' }],
      interruptors: [{ label: 'interruptor' }],
    })

    const selectionSnapshots = snapshots.filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
    expect(selectionSnapshots).toHaveLength(0)
  })

  test('does not publish deadlock snapshot when no candidates exist', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      watcher: bThread([bSync({ waitFor: 'dangerous' })], true),
    })

    expect(snapshots).toHaveLength(0)
  })

  test('publishes selection snapshot when enabled candidates exist and keeps priority selection behavior', () => {
    const snapshots: SnapshotMessage[] = []
    const selected: string[] = []
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    useFeedback({
      low: () => {
        selected.push('low')
      },
      high: () => {
        selected.push('high')
      },
    })

    bThreads.set({
      low: bThread([bSync({ request: { type: 'low' } })]),
      high: bThread([bSync({ request: { type: 'high' } })]),
    })

    trigger({ type: 'tick' })

    expect(selected[0]).toBe('low')
    const deadlocks = snapshots.filter((s): s is DeadlockSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(deadlocks).toHaveLength(0)
    const selections = snapshots.filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
    expect(selections.length).toBeGreaterThan(0)
  })
})
