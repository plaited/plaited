import { assertEquals, assertSnapshot } from '../../../dev-deps.js'
import { bProgram, DevCallback } from '../../mod.js'

Deno.test('Add hot water 3 times', () => {
  const actual: string[] = []
  const { addThreads, thread, sync, trigger, feedback } = bProgram()
  addThreads({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } })
    ),
  })
  feedback({
    hot() {
      actual.push('hot')
    },
  })
  trigger({ type: 'start' })
  assertEquals(actual, [ 'hot', 'hot', 'hot' ])
})

Deno.test('Add hot/cold water 3 times', () => {
  const actual: string[] = []
  const { addThreads, thread, sync, trigger, feedback } = bProgram()
  addThreads({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } })
    ),
    addCold: thread(
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } })
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
  const { addThreads, thread, sync, trigger, feedback, loop } = bProgram()
  addThreads({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } })
    ),
    addCold: thread(
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } })
    ),
    mixHotCold: loop([
      sync({
        waitFor: { type: 'hot' },
        block: { type: 'cold' },
      }),
      sync({
        waitFor: { type: 'cold' },
        block: { type: 'hot' },
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
  assertEquals(actual, [
    'hot',
    'cold',
    'hot',
    'cold',
    'hot',
    'cold',
  ])
})

Deno.test('logging', t => {
  const logs: Parameters<DevCallback>[0][] = []
  const { addThreads, thread, sync, trigger, loop } = bProgram({
    dev: msg => logs.push(msg),
  })
  addThreads({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } }),
      sync({ request: { type: 'hot' } })
    ),
    addCold: thread(
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } }),
      sync({ request: { type: 'cold' } })
    ),
    mixHotCold: loop([
      sync({
        waitFor: { type: 'hot' },
        block: { type: 'cold' },
      }),
      sync({
        waitFor: { type: 'cold' },
        block: { type: 'hot' },
      }),
    ]),
  })
  trigger({ type: 'start' })
  assertSnapshot(t, logs)
})
