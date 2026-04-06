import { describe, expect, test } from 'bun:test'
import {
  type BThreadsWarning,
  behavioral,
  bSync,
  bThread,
  type DeadlockSnapshot,
  type SelectionSnapshot,
  type SnapshotMessage,
} from 'plaited/behavioral'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'

describe('bThreads.spawn', () => {
  test('returns distinct ids and same-label spawns do not collide', () => {
    const { bThreads } = behavioral()
    const workerThread = bThread([bSync({ waitFor: 'start' })])

    const firstId = bThreads.spawn({ label: 'worker', thread: workerThread })
    const secondId = bThreads.spawn({ label: 'worker', thread: workerThread })

    expect(firstId).not.toBe(secondId)
    expect(bThreads.has(firstId)).toEqual({ running: true, pending: false })
    expect(bThreads.has(secondId)).toEqual({ running: true, pending: false })
  })

  test('spawned instances with the same label participate independently', () => {
    const completions: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    const createWorkerThread = () =>
      bThread([bSync({ waitFor: 'start' }), bSync({ request: () => ({ type: 'done' }) })])

    const firstId = bThreads.spawn({ label: 'worker', thread: createWorkerThread() })
    const secondId = bThreads.spawn({ label: 'worker', thread: createWorkerThread() })

    useFeedback({
      done() {
        completions.push('done')
      },
    })

    trigger({ type: 'start' })

    expect(firstId).not.toBe(secondId)
    expect(completions).toHaveLength(2)
    expect(bThreads.has(firstId)).toEqual({ running: false, pending: false })
    expect(bThreads.has(secondId)).toEqual({ running: false, pending: false })
  })

  test('spawn snapshots expose label and distinguish same-label instances by threadId', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const createWorkerThread = () =>
      bThread([bSync({ waitFor: 'start' }), bSync({ request: () => ({ type: 'done' }) })])

    const firstId = bThreads.spawn({ label: 'worker', thread: createWorkerThread() })
    const secondId = bThreads.spawn({ label: 'worker', thread: createWorkerThread() })

    trigger({ type: 'start' })

    const selectionSnapshots = snapshots.filter(
      (s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection,
    )
    expect(selectionSnapshots.length).toBeGreaterThan(0)

    const doneBids = selectionSnapshots.flatMap((snapshot) => snapshot.bids).filter((bid) => bid.type === 'done')
    expect(doneBids.length).toBeGreaterThanOrEqual(2)
    expect(doneBids.every((bid) => bid.thread === 'worker')).toBe(true)
    expect(doneBids.every((bid) => bid.threadLabel === 'worker')).toBe(true)
    const doneThreadIds = new Set(doneBids.map((bid) => bid.threadId))
    expect(doneThreadIds).toEqual(new Set([firstId, secondId]))
  })

  test('set thread snapshots remain unchanged and do not include spawned fields', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      singleton: bThread([bSync({ request: { type: 'singleton_done' } })]),
    })

    trigger({ type: 'start' })

    const selectionSnapshots = snapshots.filter(
      (s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection,
    )
    const singletonBid = selectionSnapshots
      .flatMap((snapshot) => snapshot.bids)
      .find((bid) => bid.type === 'singleton_done')

    expect(singletonBid).toBeDefined()
    expect(singletonBid!.thread).toBe('singleton')
    expect(singletonBid!.threadId).toBeUndefined()
    expect(singletonBid!.threadLabel).toBeUndefined()
  })

  test('set duplicate warnings remain unchanged', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      singleton: bThread([bSync({ waitFor: 'x' })]),
    })
    bThreads.set({
      singleton: bThread([bSync({ waitFor: 'y' })]),
    })
    bThreads.spawn({
      label: 'singleton',
      thread: bThread([bSync({ waitFor: 'z' })]),
    })

    const warnings = snapshots.filter((s): s is BThreadsWarning => s.kind === SNAPSHOT_MESSAGE_KINDS.bthreads_warning)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.thread).toBe('singleton')
  })

  test('spawned blocker and interruptor labels are used in blockedBy and interrupts', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const guardId = bThreads.spawn({
      label: 'guard',
      thread: bThread([bSync({ block: 'dangerous' })], true),
    })
    const watchdogId = bThreads.spawn({
      label: 'watchdog',
      thread: bThread([bSync({ interrupt: 'dangerous' })], true),
    })
    bThreads.set({
      requester: bThread([bSync({ request: { type: 'dangerous' } })]),
    })

    trigger({ type: 'start' })

    const deadlockSnapshot = snapshots.find((s): s is DeadlockSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(deadlockSnapshot).toBeDefined()

    const dangerousBid = deadlockSnapshot!.bids.find((bid) => bid.type === 'dangerous')
    expect(dangerousBid).toBeDefined()
    expect(dangerousBid!.blockedBy).toBe('guard')
    expect(dangerousBid!.blockedByThreadId).toBe(guardId)
    expect(dangerousBid!.interrupts).toBe('watchdog')
    expect(dangerousBid!.interruptsThreadId).toBe(watchdogId)
  })

  test('same-label spawned blockers remain attributable via blockedByThreadId', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const firstGuardId = bThreads.spawn({
      label: 'guard',
      thread: bThread([bSync({ block: 'dangerous' })], true),
    })
    const secondGuardId = bThreads.spawn({
      label: 'guard',
      thread: bThread([bSync({ block: 'dangerous' })], true),
    })
    bThreads.set({
      requester: bThread([bSync({ request: { type: 'dangerous' } })]),
    })

    trigger({ type: 'start' })

    const deadlockSnapshot = snapshots.find((s): s is DeadlockSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(deadlockSnapshot).toBeDefined()

    const dangerousBid = deadlockSnapshot!.bids.find((bid) => bid.type === 'dangerous')
    expect(dangerousBid).toBeDefined()
    expect(dangerousBid!.blockedBy).toBe('guard')
    expect(dangerousBid!.blockedByThreadId).toBeDefined()
    expect([firstGuardId, secondGuardId]).toContain(dangerousBid!.blockedByThreadId)
  })
})
