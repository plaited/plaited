import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { DeadlockSnapshot, FrontierSnapshot, SelectionSnapshot, SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral, sync, thread } from './helpers.ts'

const onType = (type: string) => ({
  type,
})

describe(SNAPSHOT_MESSAGE_KINDS.deadlock, () => {
  test('publishes deadlock snapshot when candidates exist but none are selectable', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      safety: thread([sync({ block: onType('dangerous') })]),
      interruptor: thread([sync({ interrupt: onType('dangerous') })]),
    })

    trigger({ type: 'dangerous' })

    const frontiers = snapshots.filter((s): s is FrontierSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.frontier)
    expect(frontiers).toHaveLength(1)
    expect(frontiers[0]!.status).toBe('deadlock')
    expect(frontiers[0]!.candidates).toEqual([
      {
        type: 'dangerous',
        ingress: true,
        priority: 0,
      },
    ])
    expect(frontiers[0]!.enabled).toEqual([])

    const deadlocks = snapshots.filter((s): s is DeadlockSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(deadlocks).toHaveLength(1)
    expect(deadlocks[0]!.step).toBe(frontiers[0]!.step)

    const selectionSnapshots = snapshots.filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
    expect(selectionSnapshots).toHaveLength(0)

    const frontierIndex = snapshots.findIndex((snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.frontier)
    const deadlockIndex = snapshots.findIndex((snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(frontierIndex).toBeGreaterThanOrEqual(0)
    expect(deadlockIndex).toBeGreaterThan(frontierIndex)
  })

  test('does not publish deadlock snapshot when no candidates exist', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      watcher: thread([sync({ waitFor: onType('dangerous') })]),
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
      low: thread([sync({ request: { type: 'low' } })], true),
      high: thread([sync({ request: { type: 'high' } })], true),
    })

    trigger({ type: 'tick' })

    expect(selected[0]).toBe('low')
    const deadlocks = snapshots.filter((s): s is DeadlockSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(deadlocks).toHaveLength(0)
    const frontiers = snapshots.filter((s): s is FrontierSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.frontier)
    const selections = snapshots.filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
    expect(frontiers.length).toBeGreaterThan(0)
    expect(selections.length).toBeGreaterThan(0)
    const lowSelection = selections.find((selection) => selection.selected.type === 'low')
    expect(lowSelection).toBeDefined()
    expect(lowSelection!.selected.ingress).toBeUndefined()
    const lowFrontier = frontiers.find((frontier) => frontier.step === lowSelection!.step)
    expect(lowFrontier).toBeDefined()
    expect(lowFrontier!.enabled.some((candidate) => candidate.type === 'low')).toBe(true)
    const frontierIndex = snapshots.findIndex((snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.frontier)
    const selectionIndex = snapshots.findIndex((snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection)
    expect(selectionIndex).toBeGreaterThan(frontierIndex)
  })

  test('selection snapshot reports the chosen candidate event', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      blockSecond: thread([
        sync({
          block: {
            type: 'same_type',
            detailSchema: z.object({ n: z.literal(2) }),
          },
        }),
      ]),
      first: thread([sync({ request: { type: 'same_type', detail: { n: 1 } } })], true),
      second: thread([sync({ request: { type: 'same_type', detail: { n: 2 } } })], true),
    })

    trigger({ type: 'kickoff' })

    const frontier = snapshots.find(
      (snapshot): snapshot is FrontierSnapshot =>
        snapshot.kind === SNAPSHOT_MESSAGE_KINDS.frontier &&
        snapshot.status === 'ready' &&
        snapshot.candidates.some((candidate) => candidate.type === 'same_type'),
    )
    expect(frontier).toBeDefined()
    expect(frontier!.candidates.filter((candidate) => candidate.type === 'same_type')).toHaveLength(2)

    const selection = snapshots.find(
      (snapshot): snapshot is SelectionSnapshot =>
        snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection && snapshot.selected.type === 'same_type',
    )
    expect(selection).toBeDefined()
    const selectionFrontier = snapshots.find(
      (snapshot): snapshot is FrontierSnapshot =>
        snapshot.kind === SNAPSHOT_MESSAGE_KINDS.frontier && snapshot.step === selection!.step,
    )
    expect(selectionFrontier).toBeDefined()
    expect(selectionFrontier!.candidates.some((candidate) => candidate.type === 'same_type')).toBe(true)
    expect(selection!.selected.detail).toEqual({ n: 1 })
  })
})
