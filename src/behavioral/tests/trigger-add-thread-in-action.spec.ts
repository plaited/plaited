import { test, expect } from 'bun:test'
import { bProgram } from '../b-program.js'
import { bThread, bSync } from '../b-thread.js'

test('firing trigger and adding bThreads in handlers', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()
  bThreads.set({
    addHotOnce: bSync({ request: { type: 'hot_1' } }),
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
  useFeedback({
    hot_1() {
      actual.push('hot')
      trigger({ type: 'cold' })
      bThreads.set({
        addMoreHot: bThread([bSync({ request: { type: 'hot' } }), bSync({ request: { type: 'hot' } })]),
        addMoreCold: bThread([bSync({ request: { type: 'cold' } }), bSync({ request: { type: 'cold' } })]),
      })
    },
    cold() {
      actual.push('cold')
    },
    hot() {
      actual.push('hot')
    },
  })
  trigger({ type: 'start' })
  expect(actual).toEqual(['hot', 'cold', 'hot', 'cold', 'hot', 'cold'])
})
