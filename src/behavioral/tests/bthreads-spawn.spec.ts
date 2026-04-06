import { describe, expect, test } from 'bun:test'
import { type BThreadsWarning, behavioral, bSync, bThread, type SnapshotMessage } from 'plaited/behavioral'
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
})
