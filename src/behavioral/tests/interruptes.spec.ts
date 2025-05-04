import { expect, describe, it } from 'bun:test'
import { bProgram, bThread, bSync } from 'plaited/behavioral'

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
    const { bThreads, trigger, useFeedback } = bProgram()
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
   * Test case: Demonstrates that the 'terminate' event successfully interrupts the 'addHot' thread.
   * After being interrupted, the thread stops executing and no longer requests 'hot' events,
   * even if subsequent 'add' events are triggered.
   * The thread is no longer running or pending.
   */
  it('should interrupt', () => {
    const actual: string[] = []
    const { bThreads, trigger, useFeedback } = bProgram()
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
  })
})
