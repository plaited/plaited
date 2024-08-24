import { test, expect } from 'bun:test'
import { bProgram } from '../b-program.js'
import { point, sync } from '../sync.js'
import type { SnapshotMessage } from '../types.js'

test('Add hot water 3 times', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()
  bThreads.set({
    addHot: sync([
      point({ request: { type: 'hot' } }),
      point({ request: { type: 'hot' } }),
      point({ request: { type: 'hot' } }),
    ]),
  })
  useFeedback({
    hot() {
      actual.push('hot')
    },
  })
  trigger({ type: 'start' })
  expect(actual).toEqual(['hot', 'hot', 'hot'])
})

test('Add hot/cold water 3 times', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()
  bThreads.set({
    addHot: sync([
      point({ request: { type: 'hot' } }),
      point({ request: { type: 'hot' } }),
      point({ request: { type: 'hot' } }),
    ]),
    addCold: sync([
      point({ request: { type: 'cold' } }),
      point({ request: { type: 'cold' } }),
      point({ request: { type: 'cold' } }),
    ]),
  })
  useFeedback({
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
  const { bThreads, trigger, useFeedback } = bProgram()
  bThreads.set({
    addHot: sync([
      point({ request: { type: 'hot' } }),
      point({ request: { type: 'hot' } }),
      point({ request: { type: 'hot' } }),
    ]),
    addCold: sync([
      point({ request: { type: 'cold' } }),
      point({ request: { type: 'cold' } }),
      point({ request: { type: 'cold' } }),
    ]),
    mixHotCold: sync([point({ waitFor: 'hot', block: 'cold' }), point({ waitFor: 'cold', block: 'hot' })], true),
  })
  useFeedback({
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
  const snapshots: SnapshotMessage[] = []
  const { bThreads, trigger, useSnapshot } = bProgram()
  useSnapshot((snapshot: SnapshotMessage) => {
    snapshots.push(snapshot)
  })
  bThreads.set({
    addHot: sync([
      point({ request: { type: 'hot' } }),
      point({ request: { type: 'hot' } }),
      point({ request: { type: 'hot' } }),
    ]),
    addCold: sync([
      point({ request: { type: 'cold' } }),
      point({ request: { type: 'cold' } }),
      point({ request: { type: 'cold' } }),
    ]),
    mixHotCold: sync([point({ waitFor: 'hot', block: 'cold' }), point({ waitFor: 'cold', block: 'hot' })], true),
  })
  trigger({ type: 'start' })
  expect(snapshots).toMatchSnapshot()
})
