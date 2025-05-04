import { test, expect } from 'bun:test'
import { bProgram, bSync, bThread, type SnapshotMessage } from 'plaited/behavioral'

/**
 * Test scenario: Demonstrates a simple behavioral program with a single thread
 * that requests the 'hot' event three times sequentially.
 */
test('Add hot water 3 times', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()
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
 * Test scenario: Demonstrates a behavioral program with two independent threads.
 * One thread requests 'hot' three times, and the other requests 'cold' three times.
 * Without coordination, the 'hot' requests are selected first due to priority,
 * followed by the 'cold' requests.
 */
test('Add hot/cold water 3 times', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()
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
  const { bThreads, trigger, useFeedback } = bProgram()
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
  const { bThreads, trigger, useSnapshot } = bProgram()
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
