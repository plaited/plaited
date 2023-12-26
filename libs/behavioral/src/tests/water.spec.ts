import { test, expect } from 'bun:test'
import { bProgram } from '../index.js'
import { defaultLogger } from '../utils.js'
import { DefaultLogCallbackParams } from '../types.js'

test('Add hot water 3 times', () => {
  const actual: string[] = []
  const { addThreads, thread, sync, trigger, feedback } = bProgram()
  addThreads({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
    ),
  })
  feedback({
    hot() {
      actual.push('hot')
    },
  })
  trigger({ type: 'start' })
  expect(actual).toEqual(['hot', 'hot', 'hot'])
})

test('Add hot/cold water 3 times', () => {
  const actual: string[] = []
  const { addThreads, thread, sync, trigger, feedback } = bProgram()
  addThreads({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
    ),
    addCold: thread(
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
    ),
  })
  feedback({
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

test('interleave', () => {
  const actual: string[] = []
  const { addThreads, thread, sync, trigger, feedback, loop } = bProgram()
  addThreads({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
    ),
    addCold: thread(
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
    ),
    mixHotCold: loop([
      sync({
        waitFor: 'hot',
        block: 'cold',
      }),
      sync({
        waitFor: 'cold',
        block: 'hot',
      }),
    ]),
  })
  feedback({
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

test('logging', () => {
  const logs: DefaultLogCallbackParams[] = []
  defaultLogger.callback = (log) => logs.push(log)
  const { addThreads, thread, sync, trigger, loop } = bProgram(defaultLogger)
  addThreads({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
    ),
    addCold: thread(
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
    ),
    mixHotCold: loop([
      sync({
        waitFor: 'hot',
        block: 'cold',
      }),
      sync({
        waitFor: 'cold',
        block: 'hot',
      }),
    ]),
  })
  trigger({ type: 'start' })
  expect(logs).toMatchSnapshot()
})
