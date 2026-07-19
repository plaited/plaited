import { describe, expect, test } from 'bun:test'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { FeedbackError, SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

/**
 * Test suite for the FeedbackError snapshot message.
 * When a addHandler handler throws during side-effect execution,
 * the error surfaces through useSnapshot as a { kind: SNAPSHOT_MESSAGE_KINDS.feedback_error } message.
 */
describe(SNAPSHOT_MESSAGE_KINDS.feedback_error, () => {
  test('publishes feedback-error when handler throws synchronously', () => {
    const snapshots: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useAddHandler, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    addThread('requestAction', { rules: [{ request: { type: 'doWork' } }], once: true })
    addHandler('doWork', () => {
      throw new Error('handler failed')
    })
    trigger({ type: 'start' })

    const errors = snapshots.filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(1)

    const error = errors[0]!
    expect(error).toEqual({
      kind: SNAPSHOT_MESSAGE_KINDS.feedback_error,
      type: 'doWork',
      detail: undefined,
      error: 'handler failed',
    })
  })

  test('publishes feedback-error with event detail', () => {
    const snapshots: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useAddHandler, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    addThread('requestAction', {
      rules: [{ request: { type: 'process', detail: { id: 42 } } }],
      once: true,
    })
    addHandler('process', () => {
      throw new TypeError('invalid input')
    })
    trigger({ type: 'start' })

    const errors = snapshots.filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(1)

    const error = errors[0]!
    expect(error).toEqual({
      kind: SNAPSHOT_MESSAGE_KINDS.feedback_error,
      type: 'process',
      detail: { id: 42 },
      error: 'invalid input',
    })
  })

  test('stringifies non-Error thrown values', () => {
    const snapshots: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useAddHandler, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    addThread('requestAction', { rules: [{ request: { type: 'fail' } }], once: true })
    addHandler('fail', () => {
      throw 'string error'
    })
    trigger({ type: 'start' })

    const errors = snapshots.filter((s): s is FeedbackError => s.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error).toBe('string error')
  })

  test('frontier and selection snapshots precede feedback-error in message order', () => {
    const snapshots: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useAddHandler, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    addThread('requestAction', { rules: [{ request: { type: 'boom' } }], once: true })
    addHandler('boom', () => {
      throw new Error('exploded')
    })
    trigger({ type: 'start' })

    expect(snapshots.length).toBeGreaterThanOrEqual(2)

    const frontierIndex = snapshots.findIndex((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.frontier)
    const selectionIndex = snapshots.findIndex((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
    const errorIndex = snapshots.findIndex((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error)
    expect(frontierIndex).not.toBe(-1)
    expect(selectionIndex).not.toBe(-1)
    expect(errorIndex).not.toBe(-1)
    expect(frontierIndex).toBeLessThan(selectionIndex)
    expect(selectionIndex).toBeLessThan(errorIndex)
  })

  test('no feedback-error when handler succeeds', () => {
    const snapshots: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useAddHandler, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    addThread('requestAction', { rules: [{ request: { type: 'ok' } }], once: true })
    addHandler('ok', () => {})
    trigger({ type: 'start' })

    const errors = snapshots.filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(0)
    expect(snapshots.some((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.frontier)).toBe(true)
    expect(snapshots.some((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)).toBe(true)
  })
})
