import {
  assertEquals,
  assertSnapshot,
  beforeEach,
  describe,
  it,
} from '../../test-deps.ts'
import {
  block,
  chaosStrategy,
  loop,
  plait,
  randomizedStrategy,
  request,
  strand,
  waitFor,
} from '../mod.ts'

describe('Plait', () => {
  const actualFeedback: string[] = []
  const expectedFeedback = [
    'Add hot',
    'Add cold',
    'Add hot',
    'Add cold',
    'Add hot',
    'Add cold',
  ]
  beforeEach(() => {
    actualFeedback.length = 0
  })

  const addHot = () => actualFeedback.push('Add hot')
  const addCold = () => actualFeedback.push('Add cold')
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
  const actions = {
    cold() {
      addCold()
    },
    hot() {
      addHot()
    },
  }
  it('priority queue', (t) => {
    const streamLog: unknown[] = []
    const { trigger, feedback, stream, add } = plait({ dev: true })
    add(strands)
    feedback(actions)
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
  it('randomized priority queue', (t) => {
    const streamLog: unknown[] = []
    const { trigger, feedback, stream, add } = plait({
      strategy: randomizedStrategy,
      dev: true,
    })
    add(strands)
    feedback(actions)
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
  it('chaos selection', (t) => {
    const streamLog: unknown[] = []
    const { trigger, feedback, stream, add } = plait({
      strategy: chaosStrategy,
      dev: true,
    })
    add(strands)
    feedback(actions)
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
})
