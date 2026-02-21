import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread, type RestrictedTriggerError, type SnapshotMessage } from 'plaited'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'

/**
 * Test suite for the trigger_error snapshot message.
 * When a restricted trigger rejects an event not in the allowed set,
 * the error surfaces through useSnapshot as a { kind: SNAPSHOT_MESSAGE_KINDS.trigger_error } message.
 */
describe(SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error, () => {
  test('publishes trigger_error when event type is not allowed', () => {
    const snapshots: SnapshotMessage[] = []
    const { useSnapshot, useRestrictedTrigger } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const restricted = useRestrictedTrigger(['allowed_event'])
    restricted({ type: 'not_allowed' })

    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]!).toEqual({
      kind: SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
      type: 'not_allowed',
      error: 'Event type "not_allowed" is not in the allowed set: [allowed_event]',
    })
  })

  test('allowed events pass through to the BP engine', () => {
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

    const restricted = useRestrictedTrigger(['allowed_event'])
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

    const restricted = useRestrictedTrigger(['ok'])
    restricted({ type: 'blocked', detail: { id: 99 } })

    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]!.detail).toEqual({ id: 99 })
    expect(errors[0]!.error).toContain('blocked')
    expect(errors[0]!.error).toContain('ok')
  })

  test('lists all allowed events in error message', () => {
    const snapshots: SnapshotMessage[] = []
    const { useSnapshot, useRestrictedTrigger } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const restricted = useRestrictedTrigger(['alpha', 'beta', 'gamma'])
    restricted({ type: 'delta' })

    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error).toBe('Event type "delta" is not in the allowed set: [alpha, beta, gamma]')
  })

  test('empty allowed set rejects all events', () => {
    const snapshots: SnapshotMessage[] = []
    const { useSnapshot, useRestrictedTrigger } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })

    const restricted = useRestrictedTrigger([])
    restricted({ type: 'anything' })

    const errors = snapshots.filter(
      (s): s is RestrictedTriggerError => s.kind === SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error).toContain('anything')
  })
})
