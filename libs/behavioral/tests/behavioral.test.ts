import { assertEquals, assertSnapshot } from '../../test-deps.ts'
import {
  block,
  bProgram,
  chaosStrategy,
  loop,
  randomizedStrategy,
  request,
  strand,
  waitFor,
} from '../mod.ts'

const expectedFeedback = [
  'Add hot',
  'Add cold',
  'Add hot',
  'Add cold',
  'Add hot',
  'Add cold',
]

const strands = {
  addHot: strand(
    waitFor<string>({
      type: 'start',
      assert({ data }) {
        return data === 'start'
      },
    }),
    request({ type: 'hot' }),
    request({ type: 'hot' }),
    request({ type: 'hot' }),
  ),
  addCold: strand(
    waitFor({ type: 'start' }),
    request({ type: 'cold' }),
    request({ type: 'cold' }),
    request({ type: 'cold' }),
  ),
  mixHotCold: loop(
    strand(
      Object.assign(
        waitFor({ type: 'hot' }),
        block({ type: 'cold' }),
      ),
      Object.assign(
        waitFor({ type: 'cold' }),
        block({ type: 'hot' }),
      ),
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
  add(strands)
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
  add(strands)
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
  add(strands)
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
