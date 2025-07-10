import { expect, describe, it } from 'bun:test'
import { behavioral, bThread, bSync, type SnapshotMessage } from 'plaited/behavioral'

/**
 * Test suite for demonstrating the 'interrupt' idiom in behavioral programming.
 * An interrupt allows an event to terminate a b-thread's current execution flow.
 */
describe('interrupt', () => {
  /**
   * Defines a b-thread 'addHot' that waits for an 'add' event.
   * If the 'add' event occurs, it proceeds to request a 'hot' event.
   * However, this thread can be interrupted by a 'terminate' event while waiting for 'add'.
   * The `true` argument makes the thread repeat its behavior.
   */
  const addHot = bThread(
    [bSync({ waitFor: 'add', interrupt: ['terminate'] }), bSync({ request: { type: 'hot' } })],
    true,
  )

  /**
   * Test case: Ensures the 'addHot' thread functions correctly without interruption.
   * Triggering 'add' multiple times should result in multiple 'hot' events being requested.
   * The thread remains pending, waiting for the next 'add' event.
   */
  it('should not interrupt', () => {
    const actual: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()
    bThreads.set({ addHot })
    useFeedback({
      hot() {
        actual.push('hot')
      },
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot', 'hot'])
    expect(bThreads.has('addHot')).toEqual({ running: false, pending: true })
  })

  /**
   * Test case: Verifies that the 'terminate' event correctly interrupts the 'addHot' b-thread.
   *
   * Steps:
   * 1. Set up the b-program with the 'addHot' thread.
   * 2. Register a feedback handler to track 'hot' events.
   * 3. Trigger 'add' twice, causing 'addHot' to request 'hot' twice.
   * 4. Trigger the 'terminate' event, which is configured as an interrupt for 'addHot'.
   * 5. Trigger 'add' again after the interrupt.
   *
   * Expected outcome:
   * - The 'hot' event should only be recorded twice (from before the interrupt).
   * - The 'addHot' thread should be terminated by the 'terminate' event.
   * - Subsequent 'add' events should not trigger 'hot' requests because the thread is no longer active.
   * - The `bThreads.has('addHot')` check should confirm the thread is neither running nor pending.
   */
  it('should interrupt', () => {
    const snapshots: SnapshotMessage[] = []
    const actual: string[] = []
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    bThreads.set({ addHot })
    useFeedback({
      hot() {
        actual.push('hot')
      },
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'terminate' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot'])
    expect(bThreads.has('addHot')).toEqual({ running: false, pending: false })
    expect(snapshots).toMatchSnapshot()
  })
})
