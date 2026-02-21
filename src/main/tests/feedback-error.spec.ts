import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread, type FeedbackError, type SnapshotMessage } from 'plaited'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'

/**
 * Test suite for the FeedbackError snapshot message.
 * When a useFeedback handler throws during side-effect execution,
 * the error surfaces through useSnapshot as a { kind: SNAPSHOT_MESSAGE_KINDS.feedback_error } message.
 */
describe(SNAPSHOT_MESSAGE_KINDS.feedback_error, () => {
  test('publishes feedback-error when handler throws synchronously', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    bThreads.set({
      requestAction: bThread([bSync({ request: { type: 'doWork' } })]),
    })
    useFeedback({
      doWork() {
        throw new Error('handler failed')
      },
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
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    bThreads.set({
      requestAction: bThread([bSync({ request: { type: 'process', detail: { id: 42 } } })]),
    })
    useFeedback({
      process() {
        throw new TypeError('invalid input')
      },
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
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    bThreads.set({
      requestAction: bThread([bSync({ request: { type: 'fail' } })]),
    })
    useFeedback({
      fail() {
        throw 'string error'
      },
    })
    trigger({ type: 'start' })

    const errors = snapshots.filter((s): s is FeedbackError => s.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error).toBe('string error')
  })

  test('selection snapshot precedes feedback-error in message order', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    bThreads.set({
      requestAction: bThread([bSync({ request: { type: 'boom' } })]),
    })
    useFeedback({
      boom() {
        throw new Error('exploded')
      },
    })
    trigger({ type: 'start' })

    expect(snapshots.length).toBeGreaterThanOrEqual(2)

    const selectionIndex = snapshots.findIndex((s) => s.kind === 'selection')
    const errorIndex = snapshots.findIndex((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error)
    expect(selectionIndex).not.toBe(-1)
    expect(errorIndex).not.toBe(-1)
    expect(selectionIndex).toBeLessThan(errorIndex)
  })

  test('no feedback-error when handler succeeds', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    bThreads.set({
      requestAction: bThread([bSync({ request: { type: 'ok' } })]),
    })
    useFeedback({
      ok() {
        /* no error */
      },
    })
    trigger({ type: 'start' })

    const errors = snapshots.filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(0)
    expect(snapshots.every((s) => s.kind === 'selection')).toBe(true)
  })
})
