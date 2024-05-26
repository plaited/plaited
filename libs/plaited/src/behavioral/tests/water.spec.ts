import { test, expect } from 'bun:test'
import { thread, sync, loop } from '../rules.js'
import { bProgram } from '../b-program.js'
import { defaultLogger } from '../default-logger.js'
import { DefaultLogCallbackParams } from '../../types.js'

test('Add hot water 3 times', () => {
  const actual: string[] = []
  const { addThreads, trigger, feedback } = bProgram()
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
  const { addThreads, trigger, feedback } = bProgram()
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
  const { addThreads, trigger, feedback } = bProgram()
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
    mixHotCold: loop(
      sync({
        waitFor: 'hot',
        block: 'cold',
      }),
      sync({
        waitFor: 'cold',
        block: 'hot',
      }),
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
  expect(actual).toEqual(['hot', 'cold', 'hot', 'cold', 'hot', 'cold'])
})

test('logging', () => {
  const logs: DefaultLogCallbackParams[] = []
  defaultLogger.callback = (log) => logs.push(log)
  const { addThreads, trigger } = bProgram(defaultLogger)
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
    mixHotCold: loop(
      sync({
        waitFor: 'hot',
        block: 'cold',
      }),
      sync({
        waitFor: 'cold',
        block: 'hot',
      }),
    ),
  })
  trigger({ type: 'start' })
  expect(logs).toMatchSnapshot()
})
