import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

/**
 * Test suite for useSnapshot concurrent listener behaviour.
 * Verifies that multiple snapshot listeners can coexist and that
 * disconnecting one does not break the others.
 */
describe('useSnapshot', () => {
  test('second listener still receives after first disconnects', () => {
    const snapshotsA: SnapshotMessage[] = []
    const snapshotsB: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    const disconnectA = useSnapshot((msg: SnapshotMessage) => {
      snapshotsA.push(msg)
    })
    useSnapshot((msg: SnapshotMessage) => {
      snapshotsB.push(msg)
    })

    addThread('req', { rules: [{ request: { type: 'ping' } }], once: true })

    // Both listeners receive the first selection snapshot
    trigger({ type: 'start' })
    expect(snapshotsA.length).toBeGreaterThan(0)
    expect(snapshotsB.length).toBeGreaterThan(0)

    const countA = snapshotsA.length
    const countB = snapshotsB.length

    // Disconnect listener A
    disconnectA()

    // Set up a new thread and trigger again
    addThread('req2', { rules: [{ request: { type: 'pong' } }], once: true })
    trigger({ type: 'go' })

    // A should not have received any new messages
    expect(snapshotsA.length).toBe(countA)
    // B should still be receiving
    expect(snapshotsB.length).toBeGreaterThan(countB)
  })

  test('re-subscribing after full disconnect still works', () => {
    const snapshotsA: SnapshotMessage[] = []
    const snapshotsB: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    const disconnectA = useSnapshot((msg: SnapshotMessage) => {
      snapshotsA.push(msg)
    })
    const disconnectB = useSnapshot((msg: SnapshotMessage) => {
      snapshotsB.push(msg)
    })

    addThread('req', { rules: [{ request: { type: 'ping' } }], once: true })
    trigger({ type: 'start' })

    // Both received
    expect(snapshotsA.length).toBeGreaterThan(0)
    expect(snapshotsB.length).toBeGreaterThan(0)

    // Disconnect both
    disconnectA()
    disconnectB()

    // Re-subscribe — publisher is always available
    const snapshotsC: SnapshotMessage[] = []
    useSnapshot((msg: SnapshotMessage) => {
      snapshotsC.push(msg)
    })

    addThread('req2', { rules: [{ request: { type: 'pong' } }], once: true })
    trigger({ type: 'go' })

    expect(snapshotsC.length).toBeGreaterThan(0)
  })
})
