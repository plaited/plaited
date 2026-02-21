import { describe, expect, test } from 'bun:test'
import { type BThreadsWarning, behavioral, bSync, bThread, type SnapshotMessage } from 'plaited'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'

/**
 * Test suite for the bthreads_warning snapshot message.
 * When bThreads.set() attempts to add a thread with an identifier that
 * already exists, the duplicate is ignored and a warning is published
 * through useSnapshot as a { kind: SNAPSHOT_MESSAGE_KINDS.bthreads_warning } message.
 */
describe(SNAPSHOT_MESSAGE_KINDS.bthreads_warning, () => {
  test('publishes warning when adding a duplicate running thread', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      myThread: bThread([bSync({ waitFor: 'event_a' })]),
    })
    bThreads.set({
      myThread: bThread([bSync({ waitFor: 'event_b' })]),
    })

    const warnings = snapshots.filter((s): s is BThreadsWarning => s.kind === SNAPSHOT_MESSAGE_KINDS.bthreads_warning)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!).toEqual({
      kind: SNAPSHOT_MESSAGE_KINDS.bthreads_warning,
      thread: 'myThread',
      warning:
        'Thread "myThread" already exists and cannot be replaced. Use the \'interrupt\' idiom to terminate threads explicitly.',
    })
  })

  test('warning message includes the thread name', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      specialThread: bThread([bSync({ waitFor: 'x' })]),
    })
    bThreads.set({
      specialThread: bThread([bSync({ waitFor: 'y' })]),
    })

    const warnings = snapshots.filter((s): s is BThreadsWarning => s.kind === SNAPSHOT_MESSAGE_KINDS.bthreads_warning)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.thread).toBe('specialThread')
    expect(warnings[0]!.warning).toContain('specialThread')
  })

  test('no warning when thread names are unique', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      threadA: bThread([bSync({ waitFor: 'x' })]),
    })
    bThreads.set({
      threadB: bThread([bSync({ waitFor: 'y' })]),
    })

    const warnings = snapshots.filter((s): s is BThreadsWarning => s.kind === SNAPSHOT_MESSAGE_KINDS.bthreads_warning)
    expect(warnings).toHaveLength(0)
  })

  test('multiple duplicate threads each produce a warning', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      alpha: bThread([bSync({ waitFor: 'x' })]),
      beta: bThread([bSync({ waitFor: 'y' })]),
    })
    bThreads.set({
      alpha: bThread([bSync({ waitFor: 'a' })]),
      beta: bThread([bSync({ waitFor: 'b' })]),
    })

    const warnings = snapshots.filter((s): s is BThreadsWarning => s.kind === SNAPSHOT_MESSAGE_KINDS.bthreads_warning)
    expect(warnings).toHaveLength(2)
    const threadNames = warnings.map((w) => w.thread)
    expect(threadNames).toContain('alpha')
    expect(threadNames).toContain('beta')
  })

  test('duplicate thread is ignored — original thread continues', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    let received = ''
    bThreads.set({
      listener: bThread([bSync({ waitFor: 'event_a' }), bSync({ request: { type: 'done' } })]),
    })
    useFeedback({
      done() {
        received = 'original'
      },
    })

    // Attempt to replace with a thread that waits for a different event
    bThreads.set({
      listener: bThread([bSync({ waitFor: 'event_b' }), bSync({ request: { type: 'done_replacement' } })]),
    })

    // The original thread waits for event_a — triggering it should activate it
    trigger({ type: 'event_a' })
    expect(received).toBe('original')

    // Verify the warning was published
    const warnings = snapshots.filter((s): s is BThreadsWarning => s.kind === SNAPSHOT_MESSAGE_KINDS.bthreads_warning)
    expect(warnings).toHaveLength(1)
  })
})
