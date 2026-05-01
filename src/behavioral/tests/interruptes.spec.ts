import { describe, expect, test } from 'bun:test'
import { SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral, onType, sync, thread } from './helpers.ts'

/**
 * Test suite for demonstrating the 'interrupt' idiom in behavioral programming.
 * An interrupt allows an event to terminate a b-thread's current execution flow.
 */
describe('interrupt', () => {
  /**
   * Defines a b-thread 'addHot' that waits for an 'add' event.
   * If the 'add' event occurs, it proceeds to request a 'hot' event.
   * However, this thread can be interrupted by a 'terminate' event while waiting for 'add'.
   * Omitted `once` makes the thread repeat its behavior.
   */
  const addHot = thread([
    sync({ waitFor: onType('add'), interrupt: [onType('terminate')] }),
    sync({ request: { type: 'hot' } }),
  ])

  /**
   * Test case: Ensures the 'addHot' thread functions correctly without interruption.
   * Triggering 'add' multiple times should result in multiple 'hot' events being requested.
   * The thread remains pending, waiting for the next 'add' event.
   */
  test('should not interrupt', () => {
    const actual: string[] = []
    const { addBThreads, trigger, useFeedback } = behavioral()
    addBThreads({ addHot })
    useFeedback({
      hot() {
        actual.push('hot')
      },
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot', 'hot'])
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
  test('should interrupt', () => {
    const snapshots: SnapshotMessage[] = []
    const actual: string[] = []
    const { addBThreads, trigger, useFeedback, useSnapshot } = behavioral()
    useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(snapshot)
    })
    addBThreads({ addHot })
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
    expect(snapshots.some((snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection)).toBe(true)
    const terminateSelection = snapshots.find(
      (snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection && snapshot.selected.type === 'terminate',
    )
    expect(terminateSelection).toBeDefined()
  })
})
