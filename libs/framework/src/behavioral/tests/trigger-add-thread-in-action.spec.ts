import { test, expect } from 'bun:test'
import { bProgram } from '../b-program.js'
import { sync, point } from '../sync.js'

test('firing trigger and adding bThreads in actions', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()
  bThreads.set({
    addHotOnce: point({ request: { type: 'hot_1' } }),
    mixHotCold: sync(
      [
        point({
          waitFor: ({ type }) => type.startsWith('hot'),
          block: ({ type }) => type.startsWith('cold'),
        }),
        point({
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
        addMoreHot: sync([point({ request: { type: 'hot' } }), point({ request: { type: 'hot' } })]),
        addMoreCold: sync([point({ request: { type: 'cold' } }), point({ request: { type: 'cold' } })]),
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
