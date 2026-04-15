import { describe, expect, test } from 'bun:test'
import { behavioral, type DeadlockSnapshot, type SelectionSnapshot, type SnapshotMessage } from 'plaited/behavioral'
import * as z from 'zod'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'
import { bSync, bThread } from '../behavioral.shared.ts'

const onType = (type: string) => ({
  type,
  sourceSchema: z.enum(['trigger', 'request']),
  detailSchema: z.unknown(),
})

describe(SNAPSHOT_MESSAGE_KINDS.deadlock, () => {
  test('publishes deadlock snapshot when candidates exist but none are selectable', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      safety: bThread([bSync({ block: onType('dangerous') })], true),
      interruptor: bThread([bSync({ interrupt: onType('dangerous') })], true),
    })

    trigger({ type: 'dangerous' })

    const deadlocks = snapshots.filter((s): s is DeadlockSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(deadlocks).toHaveLength(1)

    const dangerousBid = deadlocks[0]!.bids.find((bid) => bid.type === 'dangerous')
    expect(dangerousBid).toBeDefined()
    expect(dangerousBid!.selected).toBe(false)
    expect(dangerousBid!.reason).toBe('blocked')
    expect(dangerousBid!.blockedBy?.label).toBe('safety')
    expect(typeof dangerousBid!.blockedBy?.id).toBe('string')
    expect(dangerousBid!.interrupts?.label).toBe('interruptor')
    expect(typeof dangerousBid!.interrupts?.id).toBe('string')
    expect(deadlocks[0]!.summary.candidateCount).toBe(1)
    expect(deadlocks[0]!.summary.blockedCount).toBe(1)
    expect(deadlocks[0]!.summary.unblockedCount).toBe(0)
    expect(deadlocks[0]!.summary.blockers[0]!.label).toBe('safety')
    expect(deadlocks[0]!.summary.interrupters[0]!.label).toBe('interruptor')

    const selectionSnapshots = snapshots.filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
    expect(selectionSnapshots).toHaveLength(0)
  })

  test('does not publish deadlock snapshot when no candidates exist', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      watcher: bThread([bSync({ waitFor: onType('dangerous') })], true),
    })

    expect(snapshots).toHaveLength(0)
  })

  test('publishes selection snapshot when enabled candidates exist and keeps priority selection behavior', () => {
    const snapshots: SnapshotMessage[] = []
    const selected: string[] = []
    const { addBThreads, trigger, useFeedback, useSnapshot } = behavioral()

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

    addBThreads({
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

  test('selection snapshot marks only the exact chosen candidate as selected', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      blockSecond: bThread(
        [
          bSync({
            block: {
              type: 'same_type',
              sourceSchema: z.literal('request'),
              detailSchema: z.object({ n: z.literal(2) }),
            },
          }),
        ],
        true,
      ),
      first: bThread([bSync({ request: { type: 'same_type', detail: { n: 1 } } })]),
      second: bThread([bSync({ request: { type: 'same_type', detail: { n: 2 } } })]),
    })

    trigger({ type: 'kickoff' })

    const selections = snapshots.filter(
      (snapshot): snapshot is SelectionSnapshot =>
        snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection &&
        snapshot.bids.some((bid) => bid.type === 'same_type' && bid.selected),
    )
    expect(selections).toHaveLength(1)
    const sameTypeBids = selections[0]!.bids.filter((bid) => bid.type === 'same_type')
    expect(sameTypeBids).toHaveLength(2)
    expect(sameTypeBids.filter((bid) => bid.selected)).toHaveLength(1)
    expect(sameTypeBids.find((bid) => bid.selected)?.detail).toEqual({ n: 1 })
  })
})
