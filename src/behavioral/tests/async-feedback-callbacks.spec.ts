import { expect, test } from 'bun:test'
import { behavioral, bSync } from 'plaited'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Test suite for verifying the behavior of asynchronous feedback callbacks
 * within the bProgram execution cycle.
 */
test('async feedback ELEMENT_CALLBACKS', async () => {
  /** Records the order of execution steps. */
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()

  /** Define behavioral threads using bSync for simplicity. */
  bThreads.set({
    /** A thread that requests the 'init' event immediately. */
    onInit: bSync({ request: { type: 'init' } }),
    /** A thread that requests the 'afterInit' event immediately. */
    afterInit: bSync({ request: { type: 'afterInit' } }),
  })

  /** Register feedback handlers for specific events. */
  useFeedback({
    /**
     * An asynchronous handler for the 'init' event.
     * It records its execution, waits for a short period,
     * and then triggers a new 'update' event.
     */
    async init() {
      actual.push('init')
      await wait(100) // Simulate async operation
      // Triggering another event from within an async feedback handler.
      trigger({ type: 'update', detail: 'update' })
    },
    /**
     * A synchronous handler for the 'afterInit' event.
     * It records its execution.
     */
    afterInit() {
      actual.push('afterInit')
    },
    /**
     * A synchronous handler for the 'update' event.
     * It records its execution.
     */
    update() {
      actual.push('update')
    },
  })

  /** Trigger the initial 'start' event to begin the test. */
  trigger({ type: 'start' })

  /** Verify the order of execution after the initial events. */
  expect(actual).toEqual(['init', 'afterInit'])

  /** Wait for asynchronous operations to complete. */
  await wait(100)

  /** Verify the order of execution after the 'update' event. */
  expect(actual).toEqual(['init', 'afterInit', 'update'])
})
