import { test, expect } from 'bun:test'
import { behavioral, bSync, bThread, type SnapshotMessage } from 'plaited/behavioral'

/**
 * Test scenario: Demonstrates a basic behavioral program (`bProgram`).
 * It features a single b-thread (`addHot`) that sequentially requests the 'hot' event three times.
 * This showcases the fundamental concept of a thread making requests.
 *
 * Setup:
 * - A `bProgram` instance is created.
 * - A b-thread named 'addHot' is defined using `bThread` and `bSync`.
 *   - It consists of three steps, each requesting the 'hot' event.
 * - A feedback handler using `useFeedback` is registered to track when 'hot' events are selected.
 * - The program is initiated by triggering a 'start' event (though any event could start it).
 *
 * Expected Outcome:
 * - The 'hot' event handler should be called three times, in sequence.
 * - The `actual` array should contain ['hot', 'hot', 'hot'].
 */
test('Add hot water 3 times', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()
  bThreads.set({
    addHot: bThread([
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
    ]),
  })
  useFeedback({
    hot() {
      actual.push('hot')
    },
  })
  trigger({ type: 'start' })
  expect(actual).toEqual(['hot', 'hot', 'hot'])
})

/**
 * Test scenario: Illustrates the behavior of multiple independent b-threads running concurrently.
 * One thread (`addHot`) requests 'hot' three times, while another (`addCold`) requests 'cold' three times.
 * This demonstrates the default event selection strategy based on thread registration order (priority).
 *
 * Setup:
 * - Similar to the previous test, but with an additional 'addCold' thread.
 * - Feedback handlers are registered for both 'hot' and 'cold' events.
 *
 * Expected Outcome:
 * - Since 'addHot' is registered first (implicitly higher priority), all its 'hot' requests
 *   are selected and executed before any 'cold' requests from 'addCold'.
 * - The `actual` array should contain ['hot', 'hot', 'hot', 'cold', 'cold', 'cold'].
 */
test('Add hot/cold water 3 times', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()
  bThreads.set({
    addHot: bThread([
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
    ]),
    addCold: bThread([
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
    ]),
  })
  useFeedback({
    hot() {
      actual.push('hot')
    },
    cold() {
      actual.push('cold')
    },
  })
  trigger({ type: 'start' })
  expect(actual).toEqual(['hot', 'hot', 'hot', 'cold', 'cold', 'cold'])
})

/**
 * Test scenario: Demonstrates thread coordination using `waitFor` and `block`.
 * A third thread 'mixHotCold' is introduced to enforce alternation between 'hot' and 'cold' events.
 * It waits for 'hot' while blocking 'cold', then waits for 'cold' while blocking 'hot', repeating indefinitely.
 * This ensures the 'hot' and 'cold' events are interleaved.
 */
test('interleave', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()
  bThreads.set({
    addHot: bThread([
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
    ]),
    addCold: bThread([
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
    ]),
    mixHotCold: bThread([bSync({ waitFor: 'hot', block: 'cold' }), bSync({ waitFor: 'cold', block: 'hot' })], true),
  })
  useFeedback({
    hot() {
      actual.push('hot')
    },
    cold() {
      actual.push('cold')
    },
  })
  trigger({ type: 'start' })
  expect(actual).toEqual(['hot', 'cold', 'hot', 'cold', 'hot', 'cold'])
})

/**
 * Test scenario: Demonstrates the use of `useSnapshot` to capture the state
 * of the behavioral program at each step (super-step).
 * This is useful for debugging and understanding the event selection process.
 * The captured snapshots are compared against a baseline snapshot.
 */
test('logging', () => {
  const snapshots: SnapshotMessage[] = []
  const { bThreads, trigger, useSnapshot } = behavioral()
  useSnapshot((snapshot: SnapshotMessage) => {
    snapshots.push(snapshot)
  })
  bThreads.set({
    addHot: bThread([
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
    ]),
    addCold: bThread([
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
    ]),
    mixHotCold: bThread([bSync({ waitFor: 'hot', block: 'cold' }), bSync({ waitFor: 'cold', block: 'hot' })], true),
  })
  trigger({ type: 'start' })
  expect(snapshots).toMatchSnapshot()
})
