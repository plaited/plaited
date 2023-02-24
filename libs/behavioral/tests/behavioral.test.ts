import { assertEquals, assertSnapshot } from '../../test-deps.ts'
import {
  bProgram,
  bThread,
  chaosStrategy,
  loop,
  randomizedStrategy,
  sets,
} from '../mod.ts'

const expectedFeedback = [
  'Add hot',
  'Add cold',
  'Add hot',
  'Add cold',
  'Add hot',
  'Add cold',
]

const threads = {
  addHot: bThread(
    sets<string>({
      waitFor: [{
        type: 'start',
        assert({ data }) {
          return data === 'start'
        },
      }],
    }),
    sets({
      request: { type: 'hot' },
    }),
    sets({
      request: { type: 'hot' },
    }),
    sets({
      request: { type: 'hot' },
    }),
  ),
  addCold: bThread(
    sets({ waitFor: { type: 'start' } }),
    sets({
      request: [{ type: 'cold' }],
    }),
    sets({
      request: [{ type: 'cold' }],
    }),
    sets({
      request: [{ type: 'cold' }],
    }),
  ),
  mixHotCold: loop(
    bThread(
      sets({
        waitFor: { type: 'hot' },
        block: { type: 'cold' },
      }),
      sets({
        waitFor: [{ type: 'cold' }],
        block: [{ type: 'hot' }],
      }),
    ),
  ),
}
const actions = (arr: string[]) => ({
  cold() {
    arr.push('Add cold')
  },
  hot() {
    arr.push('Add hot')
  },
})
Deno.test('bProgram: priority queue', (t) => {
  const actualFeedback: string[] = []
  const streamLog: unknown[] = []
  const { trigger, feedback, stream, add } = bProgram({ dev: true })
  add(threads)
  feedback(actions(actualFeedback))
  stream.subscribe((msg) => {
    streamLog.push(msg)
  })
  trigger({
    type: 'start',
    data: 'start',
  })
  console.log(actualFeedback)
  assertEquals(
    actualFeedback,
    expectedFeedback,
    `priority selection feedback`,
  )
  assertSnapshot(t, streamLog, `priority selection feedback`)
})
Deno.test('bProgram: randomized priority queue', (t) => {
  const actualFeedback: string[] = []
  const streamLog: unknown[] = []
  const { trigger, feedback, stream, add } = bProgram({
    strategy: randomizedStrategy,
    dev: true,
  })
  add(threads)
  feedback(actions(actualFeedback))
  stream.subscribe((msg) => {
    streamLog.push(msg)
  })
  trigger({
    type: 'start',
    data: 'start',
  })
  assertEquals(
    actualFeedback,
    expectedFeedback,
    `randomized priority selection feedback`,
  )
  assertSnapshot(t, streamLog, `randomized priority selection log`)
})
Deno.test('bProgram: chaos selection', (t) => {
  const actualFeedback: string[] = []
  const streamLog: unknown[] = []
  const { trigger, feedback, stream, add } = bProgram({
    strategy: chaosStrategy,
    dev: true,
  })
  add(threads)
  feedback(actions(actualFeedback))
  stream.subscribe((msg) => {
    streamLog.push(msg)
  })
  trigger({
    type: 'start',
    data: 'start',
  })
  assertEquals(actualFeedback, expectedFeedback, `chaos selection feedback`)
  assertSnapshot(t, streamLog, `chaos selection log`)
})
