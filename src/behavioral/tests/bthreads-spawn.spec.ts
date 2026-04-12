import { describe, expect, test } from 'bun:test'
import {
  behavioral,
  bSync,
  bThread,
  type DeadlockSnapshot,
  type SelectionSnapshot,
  type SnapshotMessage,
} from 'plaited/behavioral'
import * as z from 'zod'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'

const onType = (type: string) => ({
  type,
  sourceSchema: z.enum(['trigger', 'request', 'emit']),
  detailSchema: z.unknown(),
})

describe('addBThreads identity attribution', () => {
  test('independent workers participate and selection snapshots expose thread ids', () => {
    const snapshots: SnapshotMessage[] = []
    const completions: string[] = []
    const { addBThreads, trigger, useFeedback, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      workerA: bThread([bSync({ waitFor: onType('start') }), bSync({ request: { type: 'done_a' } })]),
      workerB: bThread([bSync({ waitFor: onType('start') }), bSync({ request: { type: 'done_b' } })]),
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
    expect(doneBids.every((bid) => bid.thread.id.length > 0)).toBe(true)
  })

  test('set thread snapshots include { label, id } references', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      singleton: bThread([bSync({ request: { type: 'singleton_done' } })]),
    })

    trigger({ type: 'start' })

    const selectionSnapshots = snapshots.filter(
      (snapshot): snapshot is SelectionSnapshot => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection,
    )
    const singletonBid = selectionSnapshots
      .flatMap((snapshot) => snapshot.bids)
      .find((bid) => bid.type === 'singleton_done')

    expect(singletonBid).toBeDefined()
    expect(singletonBid!.thread.label).toBe('singleton')
    expect(singletonBid!.thread.id.length).toBeGreaterThan(0)
  })

  test('deadlock refs include labels and ids for blockers and interrupters', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      guard: bThread([bSync({ block: onType('dangerous') })], true),
      watchdog: bThread([bSync({ interrupt: onType('dangerous') })], true),
      requester: bThread([bSync({ request: { type: 'dangerous' } })]),
    })

    trigger({ type: 'start' })

    const deadlockSnapshot = snapshots.find(
      (snapshot): snapshot is DeadlockSnapshot => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.deadlock,
    )
    expect(deadlockSnapshot).toBeDefined()

    const dangerousBid = deadlockSnapshot!.bids.find((bid) => bid.type === 'dangerous')
    expect(dangerousBid).toBeDefined()
    expect(dangerousBid!.blockedBy?.label).toBe('guard')
    expect(dangerousBid!.interrupts?.label).toBe('watchdog')
    expect(deadlockSnapshot!.summary.blockers.map((ref) => ref.label)).toEqual(['guard'])
    expect(deadlockSnapshot!.summary.interrupters.map((ref) => ref.label)).toEqual(['watchdog'])
  })
})
