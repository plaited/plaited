import {assert} from '@esm-bundle/chai'

import {
  baseDynamics,
  chaosStrategy,
  randomizedStrategy,
  loop,
  strand,
  waitFor,
  request,
  block,
  Track,
} from '..'

import {
  expectedFeedback,
  expectedChaosStreamLog,
  expectedPriorityStreamLog,
  expectedRandomizedStreamLog,
} from './__expected__/behavioral'

const actualFeedback: string[] = []

const addHot = () => actualFeedback.push('Add hot')
const addCold = () => actualFeedback.push('Add cold')
const strands = {
  addHot: strand(
    waitFor({
      eventName: 'start',
      callback: () => true,
    }),
    request({eventName: 'hot'}),
    request({eventName: 'hot'}),
    request({eventName: 'hot'}),
  ),
  addCold: strand(
    waitFor({eventName: 'start'}),
    request({eventName: 'cold'}),
    request({eventName: 'cold'}),
    request({eventName: 'cold'}),
  ),
  mixHotCold: loop(
    strand(
      Object.assign(
        waitFor({eventName: 'hot'}),
        block({eventName: 'cold'}),
      ),
      Object.assign(
        waitFor({eventName: 'cold'}),
        block({eventName: 'hot'}),
      ),
    ),
  ),
}
const actions = {
  cold(){
    addCold()
  },
  hot(){
    addHot()
  },
}

describe('behvioral', () => {
  it('plait(): priority queue', () => {
    const streamLog: unknown[] = []
    const {trigger, feedback, stream} = new Track(strands, {dev: true})
    feedback(actions)
    stream.subscribe(msg => {
      streamLog.push(msg)
    })
    trigger({
      eventName: 'start',
      payload: ['start'],
      baseDynamic: baseDynamics.objectObject,
    })
    assert.deepEqual(
      actualFeedback,
      expectedFeedback,
    )
    assert.deepEqual(
      expectedPriorityStreamLog,
      streamLog,
    )
  })
  it('plait(): randomized priority queue', () => {
    const streamLog: unknown[] = []
    actualFeedback.length = 0
    const {trigger, feedback, stream} = new Track(strands, {strategy: randomizedStrategy, dev: true})
    feedback(actions)
    stream.subscribe(msg => {
      streamLog.push(msg)
    })
    trigger({
      eventName: 'start',
      payload: ['start'],
      baseDynamic: baseDynamics.objectObject,
    })
    assert.deepEqual(
      actualFeedback,
      expectedFeedback,
    )
    assert.deepEqual(
      expectedRandomizedStreamLog,
      streamLog,
    )
  })
  it('plait(): chaos selection', () => {
    const streamLog: unknown[]  = []
    actualFeedback.length = 0
    const {trigger, feedback, stream} = new Track(strands, {strategy: chaosStrategy, dev: true})
    feedback(actions)
    stream.subscribe(msg => {
      streamLog.push(msg)
    })
    trigger({
      eventName: 'start',
      payload: ['start'],
      baseDynamic: baseDynamics.objectObject,
    })
    assert.deepEqual(
      actualFeedback,
      expectedFeedback,
    )
    assert.deepEqual(
      expectedChaosStreamLog,
      streamLog,
    )
  })
})
