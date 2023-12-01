import { test, expect } from 'bun:test'
import { bProgram } from '../index.js'

test('firing trigger and adding threads in actions', () => {
  const actual: string[] = []
  const { addThreads, thread, sync, trigger, feedback, loop } = bProgram()
  addThreads({
    addHotOnce: thread(sync({ request: { type: 'hot_1' } })),
    mixHotCold: loop([
      sync({
        waitFor: ({ type }) => type.startsWith('hot'),
        block: ({ type }) => type.startsWith('cold'),
      }),
      sync({
        waitFor: ({ type }) => type.startsWith('cold'),
        block: ({ type }) => type.startsWith('hot'),
      }),
    ]),
  })
  feedback({
    hot_1() {
      actual.push('hot')
      trigger({ type: 'cold' })
      addThreads({
        addMoreHot: thread(sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } })),
        addMoreCold: thread(sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } })),
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
