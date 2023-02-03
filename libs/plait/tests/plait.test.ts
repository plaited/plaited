import { assertSnapshot } from '../../test-deps.ts'
import {
  baseDynamics,
  block,
  chaosStrategy,
  loop,
  Plait,
  randomizedStrategy,
  request,
  strand,
  waitFor,
} from '../mod.ts'

const actualFeedback: string[] = []

const addHot = () => actualFeedback.push('Add hot')
const addCold = () => actualFeedback.push('Add cold')
const strands = {
  addHot: strand(
    waitFor({
      eventName: 'start',
      callback: () => true,
    }),
    request({ eventName: 'hot' }),
    request({ eventName: 'hot' }),
    request({ eventName: 'hot' }),
  ),
  addCold: strand(
    waitFor({ eventName: 'start' }),
    request({ eventName: 'cold' }),
    request({ eventName: 'cold' }),
    request({ eventName: 'cold' }),
  ),
  mixHotCold: loop(
    strand(
      Object.assign(
        waitFor({ eventName: 'hot' }),
        block({ eventName: 'cold' }),
      ),
      Object.assign(
        waitFor({ eventName: 'cold' }),
        block({ eventName: 'hot' }),
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
Deno.test('plait(): priority queue', (t) => {
  const streamLog: unknown[] = []
  const { trigger, feedback, stream } = new Plait(strands, { dev: true })
  feedback(actions)
  stream.subscribe((msg) => {
    streamLog.push(msg)
  })
  trigger({
    eventName: 'start',
    payload: ['start'],
    baseDynamic: baseDynamics.objectObject,
  })
  assertSnapshot(t, actualFeedback, `priority selection feedback`)
  assertSnapshot(t, streamLog, `priority selection feedback`)
})
Deno.test('plait(): randomized priority queue', (t) => {
  const streamLog: unknown[] = []
  actualFeedback.length = 0
  const { trigger, feedback, stream } = new Plait(strands, {
    strategy: randomizedStrategy,
    dev: true,
  })
  feedback(actions)
  stream.subscribe((msg) => {
    streamLog.push(msg)
  })
  trigger({
    eventName: 'start',
    payload: ['start'],
    baseDynamic: baseDynamics.objectObject,
  })
  assertSnapshot(t, actualFeedback, `randomized priority selection feedback`)
  assertSnapshot(t, streamLog, `randomized priority selection log`)
})
Deno.test('plait(): chaos selection', (t) => {
  const streamLog: unknown[] = []
  actualFeedback.length = 0
  const { trigger, feedback, stream } = new Plait(strands, {
    strategy: chaosStrategy,
    dev: true,
  })
  feedback(actions)
  stream.subscribe((msg) => {
    streamLog.push(msg)
  })
  trigger({
    eventName: 'start',
    payload: ['start'],
    baseDynamic: baseDynamics.objectObject,
  })
  assertSnapshot(t, actualFeedback, `chaos selection feedback`)
  assertSnapshot(t, streamLog, `chaos selection log`)
})
