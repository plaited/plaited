import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread, type SnapshotMessage } from 'plaited/behavioral'

/**
 * Test suite for useSnapshot concurrent listener behaviour.
 * Verifies that multiple snapshot listeners can coexist and that
 * disconnecting one does not break the others.
 */
describe('useSnapshot', () => {
  test('second listener still receives after first disconnects', () => {
    const snapshotsA: SnapshotMessage[] = []
    const snapshotsB: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    const disconnectA = useSnapshot((msg: SnapshotMessage) => {
      snapshotsA.push(msg)
    })
    useSnapshot((msg: SnapshotMessage) => {
      snapshotsB.push(msg)
    })

    addBThreads({
      req: bThread([bSync({ request: { type: 'ping' } })]),
    })

    // Both listeners receive the first selection snapshot
    trigger({ type: 'start' })
    expect(snapshotsA.length).toBeGreaterThan(0)
    expect(snapshotsB.length).toBeGreaterThan(0)

    const countA = snapshotsA.length
    const countB = snapshotsB.length

    // Disconnect listener A
    disconnectA()

    // Set up a new thread and trigger again
    addBThreads({
      req2: bThread([bSync({ request: { type: 'pong' } })]),
    })
    trigger({ type: 'go' })

    // A should not have received any new messages
    expect(snapshotsA.length).toBe(countA)
    // B should still be receiving
    expect(snapshotsB.length).toBeGreaterThan(countB)
  })

  test('re-subscribing after full disconnect still works', () => {
    const snapshotsA: SnapshotMessage[] = []
    const snapshotsB: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    const disconnectA = useSnapshot((msg: SnapshotMessage) => {
      snapshotsA.push(msg)
    })
    const disconnectB = useSnapshot((msg: SnapshotMessage) => {
      snapshotsB.push(msg)
    })

    addBThreads({
      req: bThread([bSync({ request: { type: 'ping' } })]),
    })
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

    addBThreads({
      req2: bThread([bSync({ request: { type: 'pong' } })]),
    })
    trigger({ type: 'go' })

    expect(snapshotsC.length).toBeGreaterThan(0)
  })
})
