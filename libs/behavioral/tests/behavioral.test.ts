import { assertEquals, assertSnapshot } from '../../test-deps.ts'
import { bProgram } from '../mod.ts'
import { loop, sync, thread } from '../rules.ts'

const expectedFeedback = [
  'Add hot',
  'Add cold',
  'Add hot',
  'Add cold',
  'Add hot',
  'Add cold',
]

const rules = {
  addHot: thread(
    sync<{ value: string }>({
      waitFor: [
        {
          cb({ detail }) {
            return detail?.value === 'start'
          },
        },
        { event: 'say_cold' },
      ],
    }),
    sync({
      request: { event: 'hot' },
    }),
    sync({
      request: { event: 'hot' },
    }),
    sync({
      request: { event: 'hot' },
    }),
  ),
  addCold: thread(
    sync({ waitFor: { event: 'start' } }),
    sync({
      request: [{ event: 'cold' }],
    }),
    sync({
      request: [{ event: 'cold' }],
    }),
    sync({
      request: [{ event: 'cold' }],
    }),
  ),
  mixHotCold: loop([
    sync({
      waitFor: { event: 'hot' },
      block: { event: 'cold' },
    }),
    sync({
      waitFor: [{ event: 'cold' }],
      block: [{ event: 'hot' }],
    }),
  ]),
}
const getActions = (arr: string[]) => ({
  cold() {
    arr.push('Add cold')
  },
  hot() {
    arr.push('Add hot')
  },
})
Deno.test('bProgram: priority queue', (t) => {
  const actualFeedback: string[] = []
  const logs: unknown[] = []
  const { trigger, feedback, addRules } = bProgram({
    logger: (msg) => {
      logs.push(msg)
    },
  })
  addRules(rules)
  feedback(getActions(actualFeedback))
  trigger({
    event: 'start',
    detail: { value: 'start' },
  })
  assertEquals(
    actualFeedback,
    expectedFeedback,
    `priority selection feedback`,
  )
  assertSnapshot(t, logs, `priority selection feedback`)
})
Deno.test('bProgram: randomized priority queue', (t) => {
  const actualFeedback: string[] = []
  const logs: unknown[] = []
  const { trigger, feedback, addRules } = bProgram({
    strategy: 'randomized',
    logger: (msg) => {
      logs.push(msg)
    },
  })
  addRules(rules)
  feedback(getActions(actualFeedback))
  trigger({
    event: 'start',
    detail: { value: 'start' },
  })
  assertEquals(
    actualFeedback,
    expectedFeedback,
    `randomized priority selection feedback`,
  )
  assertSnapshot(t, logs, `randomized priority selection log`)
})
Deno.test('bProgram: chaos selection', (t) => {
  const actualFeedback: string[] = []
  const logs: unknown[] = []
  const { trigger, feedback, addRules } = bProgram({
    strategy: 'chaos',
    logger: (msg) => {
      logs.push(msg)
    },
  })
  addRules(rules)
  feedback(getActions(actualFeedback))
  trigger({
    event: 'start',
    detail: { value: 'start' },
  })
  assertEquals(actualFeedback, expectedFeedback, `chaos selection feedback`)
  assertSnapshot(t, logs, `chaos selection log`)
})
