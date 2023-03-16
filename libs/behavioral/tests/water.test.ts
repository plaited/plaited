import { assertEquals, assertSnapshot } from '../../test-deps.ts'
import { bProgram, LogMessage } from '../mod.ts'

Deno.test('Add hot water 3 times', () => {
  const actual: string[] = []
  const { addRules, thread, sync, trigger, feedback } = bProgram()
  addRules({
    addHot: thread(
      sync({ request: { event: 'hot' } }),
      sync({ request: { event: 'hot' } }),
      sync({ request: { event: 'hot' } }),
    ),
  })
  feedback({
    hot() {
      actual.push('hot')
    },
  })
  trigger({ event: 'start' })
  assertEquals(actual, ['hot', 'hot', 'hot'])
})

Deno.test('Add hot/cold water 3 times', () => {
  const actual: string[] = []
  const { addRules, thread, sync, trigger, feedback } = bProgram()
  addRules({
    addHot: thread(
      sync({ request: { event: 'hot' } }),
      sync({ request: { event: 'hot' } }),
      sync({ request: { event: 'hot' } }),
    ),
    addCold: thread(
      sync({ request: { event: 'cold' } }),
      sync({ request: { event: 'cold' } }),
      sync({ request: { event: 'cold' } }),
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
  trigger({ event: 'start' })
  assertEquals(actual, [
    'hot',
    'hot',
    'hot',
    'cold',
    'cold',
    'cold',
  ])
})

Deno.test('interleave', () => {
  const actual: string[] = []
  const { addRules, thread, sync, trigger, feedback, loop } = bProgram()
  addRules({
    addHot: thread(
      sync({ request: { event: 'hot' } }),
      sync({ request: { event: 'hot' } }),
      sync({ request: { event: 'hot' } }),
    ),
    addCold: thread(
      sync({ request: { event: 'cold' } }),
      sync({ request: { event: 'cold' } }),
      sync({ request: { event: 'cold' } }),
    ),
    mixHotCold: loop([
      sync({
        waitFor: { event: 'hot' },
        block: { event: 'cold' },
      }),
      sync({
        waitFor: { event: 'cold' },
        block: { event: 'hot' },
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
  trigger({ event: 'start' })
  assertEquals(actual, [
    'hot',
    'cold',
    'hot',
    'cold',
    'hot',
    'cold',
  ])
})

Deno.test('logging', (t) => {
  const logs: LogMessage[] = []
  const { addRules, thread, sync, trigger, loop } = bProgram({
    logger: (msg) => logs.push(msg),
  })
  addRules({
    addHot: thread(
      sync({ request: { event: 'hot' } }),
      sync({ request: { event: 'hot' } }),
      sync({ request: { event: 'hot' } }),
    ),
    addCold: thread(
      sync({ request: { event: 'cold' } }),
      sync({ request: { event: 'cold' } }),
      sync({ request: { event: 'cold' } }),
    ),
    mixHotCold: loop([
      sync({
        waitFor: { event: 'hot' },
        block: { event: 'cold' },
      }),
      sync({
        waitFor: { event: 'cold' },
        block: { event: 'hot' },
      }),
    ]),
  })
  trigger({ event: 'start' })
  assertSnapshot(t, logs)
})
