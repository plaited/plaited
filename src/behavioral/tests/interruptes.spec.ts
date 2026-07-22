import { describe, expect, test } from 'bun:test'
import { TRACE_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { Trace } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

const onType = (type: string) => ({ type })

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
  const addHot = {
    rules: [{ waitFor: [onType('add')], interrupt: [onType('terminate')] }, { request: { type: 'hot' } }],
  }

  /**
   * Test case: Ensures the 'addHot' thread functions correctly without interruption.
   * Triggering 'add' multiple times should result in multiple 'hot' events being requested.
   * The thread remains pending, waiting for the next 'add' event.
   */
  test('should not interrupt', () => {
    const actual: string[] = []
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    addThread('addHot', addHot)
    addHandler('hot', () => {
      actual.push('hot')
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
    const traces: Trace[] = []
    const actual: string[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useTrace((trace: Trace) => {
      traces.push(trace)
    })
    addThread('addHot', addHot)
    addHandler('hot', () => {
      actual.push('hot')
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'terminate' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot'])
    expect(traces.some((trace) => trace.kind === TRACE_MESSAGE_KINDS.selection)).toBe(true)
    const terminateSelection = traces.find(
      (trace) => trace.kind === TRACE_MESSAGE_KINDS.selection && trace.selected.type === 'terminate',
    )
    expect(terminateSelection).toBeDefined()
  })
})
