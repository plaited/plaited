import { describe, expect, test } from 'bun:test'
import { TRACE_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { DeadlockTrace, FrontierTrace, SelectionTrace, Trace } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

const onType = (type: string) => ({
  type,
})

describe(TRACE_MESSAGE_KINDS.deadlock, () => {
  test('publishes deadlock snapshot when candidates exist but none are selectable', () => {
    const snapshots: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    useTrace((snapshot: Trace) => {
      snapshots.push(snapshot)
    })

    addThread('safety', { rules: [{ block: [onType('dangerous')] }] })
    addThread('interruptor', { rules: [{ interrupt: [onType('dangerous')] }] })

    trigger({ type: 'dangerous' })

    const frontiers = snapshots.filter((s): s is FrontierTrace => s.kind === TRACE_MESSAGE_KINDS.frontier)
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

    const deadlocks = snapshots.filter((s): s is DeadlockTrace => s.kind === TRACE_MESSAGE_KINDS.deadlock)
    expect(deadlocks).toHaveLength(1)
    expect(deadlocks[0]!.step).toBe(frontiers[0]!.step)

    const selectionSnapshots = snapshots.filter((s) => s.kind === TRACE_MESSAGE_KINDS.selection)
    expect(selectionSnapshots).toHaveLength(0)

    const frontierIndex = snapshots.findIndex((snapshot) => snapshot.kind === TRACE_MESSAGE_KINDS.frontier)
    const deadlockIndex = snapshots.findIndex((snapshot) => snapshot.kind === TRACE_MESSAGE_KINDS.deadlock)
    expect(frontierIndex).toBeGreaterThanOrEqual(0)
    expect(deadlockIndex).toBeGreaterThan(frontierIndex)
  })

  test('does not publish deadlock snapshot when no candidates exist', () => {
    const snapshots: Trace[] = []
    const { useAddThread, useTrace } = behavioral()
    const addThread = useAddThread()

    useTrace((snapshot: Trace) => {
      snapshots.push(snapshot)
    })

    addThread('watcher', { rules: [{ waitFor: [onType('dangerous')] }] })

    expect(snapshots).toHaveLength(0)
  })

  test('publishes selection snapshot when enabled candidates exist and keeps priority selection behavior', () => {
    const snapshots: Trace[] = []
    const selected: string[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    useTrace((snapshot: Trace) => {
      snapshots.push(snapshot)
    })

    addHandler('low', () => {
      selected.push('low')
    })
    addHandler('high', () => {
      selected.push('high')
    })

    addThread('low', { rules: [{ request: { type: 'low' } }], once: true })
    addThread('high', { rules: [{ request: { type: 'high' } }], once: true })

    trigger({ type: 'tick' })

    expect(selected[0]).toBe('low')
    const deadlocks = snapshots.filter((s): s is DeadlockTrace => s.kind === TRACE_MESSAGE_KINDS.deadlock)
    expect(deadlocks).toHaveLength(0)
    const frontiers = snapshots.filter((s): s is FrontierTrace => s.kind === TRACE_MESSAGE_KINDS.frontier)
    const selections = snapshots.filter((s): s is SelectionTrace => s.kind === TRACE_MESSAGE_KINDS.selection)
    expect(frontiers.length).toBeGreaterThan(0)
    expect(selections.length).toBeGreaterThan(0)
    const lowSelection = selections.find((selection) => selection.selected.type === 'low')
    expect(lowSelection).toBeDefined()
    expect(lowSelection!.selected.ingress).toBeUndefined()
    const lowFrontier = frontiers.find((frontier) => frontier.step === lowSelection!.step)
    expect(lowFrontier).toBeDefined()
    expect(lowFrontier!.enabled.some((candidate) => candidate.type === 'low')).toBe(true)
    const frontierIndex = snapshots.findIndex((snapshot) => snapshot.kind === TRACE_MESSAGE_KINDS.frontier)
    const selectionIndex = snapshots.findIndex((snapshot) => snapshot.kind === TRACE_MESSAGE_KINDS.selection)
    expect(selectionIndex).toBeGreaterThan(frontierIndex)
  })

  test('selection snapshot reports the chosen candidate event', () => {
    const snapshots: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    useTrace((snapshot: Trace) => {
      snapshots.push(snapshot)
    })

    addThread('blockSecond', {
      rules: [
        {
          block: [
            {
              type: 'same_type',
              detailSchema: {
                type: 'object' as const,
                properties: { n: { const: 2 } },
                required: ['n'],
                additionalProperties: false,
              },
            },
          ],
        },
      ],
    })
    addThread('first', { rules: [{ request: { type: 'same_type', detail: { n: 1 } } }], once: true })
    addThread('second', { rules: [{ request: { type: 'same_type', detail: { n: 2 } } }], once: true })

    trigger({ type: 'kickoff' })

    const frontier = snapshots.find(
      (snapshot): snapshot is FrontierTrace =>
        snapshot.kind === TRACE_MESSAGE_KINDS.frontier &&
        snapshot.status === 'ready' &&
        snapshot.candidates.some((candidate) => candidate.type === 'same_type'),
    )
    expect(frontier).toBeDefined()
    expect(frontier!.candidates.filter((candidate) => candidate.type === 'same_type')).toHaveLength(2)

    const selection = snapshots.find(
      (snapshot): snapshot is SelectionTrace =>
        snapshot.kind === TRACE_MESSAGE_KINDS.selection && snapshot.selected.type === 'same_type',
    )
    expect(selection).toBeDefined()
    const selectionFrontier = snapshots.find(
      (snapshot): snapshot is FrontierTrace =>
        snapshot.kind === TRACE_MESSAGE_KINDS.frontier && snapshot.step === selection!.step,
    )
    expect(selectionFrontier).toBeDefined()
    expect(selectionFrontier!.candidates.some((candidate) => candidate.type === 'same_type')).toBe(true)
    expect(selection!.selected.detail).toEqual({ n: 1 })
  })
})
