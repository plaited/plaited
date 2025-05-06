import { test, expect } from 'bun:test'
import { bProgram, bThread, bSync } from 'plaited/behavioral'

/**
 * Test scenario: Demonstrates the dynamic nature of behavioral programs.
 * This test shows that feedback handlers (`useFeedback`) can:
 * 1. Trigger new events using `trigger`.
 * 2. Add new b-threads to the program using `bThreads.set`.
 * This allows the program's behavior to evolve based on the events that occur.
 */
test('firing trigger and adding bThreads in handlers', () => {
  /** Records the sequence of 'hot' and 'cold' events. */
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()

  /** Initial setup of b-threads. */
  bThreads.set({
    /** A thread that requests 'hot_1' once. */
    addHotOnce: bSync({ request: { type: 'hot_1' } }),
    /** A thread that enforces alternation between hot and cold events. */
    mixHotCold: bThread(
      [
        bSync({
          waitFor: ({ type }) => type.startsWith('hot'),
          block: ({ type }) => type.startsWith('cold'),
        }),
        bSync({
          waitFor: ({ type }) => type.startsWith('cold'),
          block: ({ type }) => type.startsWith('hot'),
        }),
      ],
      true,
    ),
  })

  /** Register feedback handlers. */
  useFeedback({
    /**
     * Handler for the initial 'hot_1' event.
     * This handler demonstrates dynamic program modification:
     * - Records the 'hot' event.
     * - Triggers a 'cold' event immediately.
     * - Adds two new threads ('addMoreHot', 'addMoreCold') to the running program.
     */
    hot_1() {
      actual.push('hot') // Record the initial hot event
      trigger({ type: 'cold' }) // Trigger a cold event
      // Dynamically add new threads after the first hot event
      bThreads.set({
        addMoreHot: bThread([bSync({ request: { type: 'hot' } }), bSync({ request: { type: 'hot' } })]),
        addMoreCold: bThread([bSync({ request: { type: 'cold' } }), bSync({ request: { type: 'cold' } })]),
      })
    },
    /** Handler for 'cold' events. */
    cold() {
      actual.push('cold')
    },
    /** Handler for 'hot' events. */
    hot() {
      actual.push('hot')
    },
  })

  /** Trigger the initial event to start the program. */
  trigger({ type: 'start' })
  expect(actual).toEqual(['hot', 'cold', 'hot', 'cold', 'hot', 'cold'])
})
