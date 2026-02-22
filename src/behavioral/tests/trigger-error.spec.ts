import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread, type RestrictedTriggerError, type SnapshotMessage } from 'plaited'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'

/**
 * Test suite for the restricted_trigger_error snapshot message.
 * When a restricted trigger rejects an event that is in the restricted set,
 * the error surfaces through useSnapshot as a
 * { kind: SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error } message.
 */
describe(SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error, () => {
  test('publishes trigger_error when event type is restricted', () => {
    const snapshots: SnapshotMessage[] = []
    const { useSnapshot, useRestrictedTrigger } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const restricted = useRestrictedTrigger('blocked_event')
    restricted({ type: 'blocked_event' })

    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]!).toEqual({
      kind: SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
      type: 'blocked_event',
      error: 'Event type "blocked_event" is in the restricted set: [blocked_event]',
    })
  })

  test('non-restricted events pass through to the BP engine', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, useFeedback, useSnapshot, useRestrictedTrigger } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    let received = false
    bThreads.set({
      listener: bThread([bSync({ waitFor: 'allowed_event' })]),
    })
    useFeedback({
      allowed_event() {
        received = true
      },
    })

    const restricted = useRestrictedTrigger('blocked_event')
    restricted({ type: 'allowed_event' })

    expect(received).toBe(true)
    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(0)
  })

  test('includes detail in trigger_error snapshot', () => {
    const snapshots: SnapshotMessage[] = []
    const { useSnapshot, useRestrictedTrigger } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const restricted = useRestrictedTrigger('blocked')
    restricted({ type: 'blocked', detail: { id: 99 } })

    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]!.detail).toEqual({ id: 99 })
    expect(errors[0]!.error).toContain('blocked')
  })

  test('lists all restricted events in error message', () => {
    const snapshots: SnapshotMessage[] = []
    const { useSnapshot, useRestrictedTrigger } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const restricted = useRestrictedTrigger('alpha', 'beta', 'gamma')
    restricted({ type: 'alpha' })

    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error).toBe('Event type "alpha" is in the restricted set: [alpha, beta, gamma]')
  })

  test('empty restricted set allows all events', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, useFeedback, useSnapshot, useRestrictedTrigger } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    let received = false
    bThreads.set({
      listener: bThread([bSync({ waitFor: 'anything' })]),
    })
    useFeedback({
      anything() {
        received = true
      },
    })

    const restricted = useRestrictedTrigger()
    restricted({ type: 'anything' })

    expect(received).toBe(true)
    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(0)
  })
})
