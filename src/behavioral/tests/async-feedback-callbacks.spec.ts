import { expect, test } from 'bun:test'
import { behavioral } from '../behavioral.ts'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Test suite for verifying the behavior of asynchronous feedback callbacks
 * within the bProgram execution cycle.
 */
test('async feedback ELEMENT_CALLBACKS', async () => {
  /** Records the order of execution steps. */
  const actual: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  /** Define behavioral threads using bSync for simplicity. */
  addThread({ label: 'onInit', rules: [{ request: { type: 'init' } }], once: true })
  addThread({ label: 'afterInit', rules: [{ request: { type: 'afterInit' } }], once: true })

  /** Register feedback handlers for specific events. */
  addHandler('init', async () => {
    actual.push('init')
    await wait(100)

    trigger({ type: 'update', detail: { status: 'update' } })
  })
  addHandler('afterInit', () => {
    actual.push('afterInit')
  })
  addHandler('update', () => {
    actual.push('update')
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
