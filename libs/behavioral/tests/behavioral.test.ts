import { assertEquals, assertSnapshot } from '../../test-deps.ts'
import { loop, program, sync, thread } from '../mod.ts'

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
Deno.test('program: priority queue', (t) => {
  const actualFeedback: string[] = []
  const logs: unknown[] = []
  const { trigger, feedback, log, addRules } = program({
    dev: true,
  })
  addRules(rules)
  feedback(getActions(actualFeedback))
  log((msg) => {
    logs.push(msg)
  })
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
Deno.test('program: randomized priority queue', (t) => {
  const actualFeedback: string[] = []
  const logs: unknown[] = []
  const { trigger, feedback, log, addRules } = program({
    strategy: 'randomized',
    dev: true,
  })
  addRules(rules)
  feedback(getActions(actualFeedback))
  log((msg) => {
    logs.push(msg)
  })
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
Deno.test('program: chaos selection', (t) => {
  const actualFeedback: string[] = []
  const logs: unknown[] = []
  const { trigger, feedback, log, addRules } = program({
    strategy: 'chaos',
    dev: true,
  })
  addRules(rules)
  feedback(getActions(actualFeedback))
  log((msg) => {
    logs.push(msg)
  })
  trigger({
    event: 'start',
    detail: { value: 'start' },
  })
  assertEquals(actualFeedback, expectedFeedback, `chaos selection feedback`)
  assertSnapshot(t, logs, `chaos selection log`)
})
