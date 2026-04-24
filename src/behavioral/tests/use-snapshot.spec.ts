import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral, sync, thread } from './helpers.ts'

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
      req: thread([sync({ request: { type: 'ping' } })], true),
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
      req2: thread([sync({ request: { type: 'pong' } })], true),
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
      req: thread([sync({ request: { type: 'ping' } })], true),
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
      req2: thread([sync({ request: { type: 'pong' } })], true),
    })
    trigger({ type: 'go' })

    expect(snapshotsC.length).toBeGreaterThan(0)
  })
})
