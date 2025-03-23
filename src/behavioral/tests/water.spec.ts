import { test, expect } from 'bun:test'
import { bProgram, bSync, bThread, type SnapshotMessage } from 'plaited/behavioral'

test('Add hot water 3 times', () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()
  bThreads.set({
    addHot: bThread([
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
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
    addHot: bThread([
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
    ]),
    addCold: bThread([
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
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
    addHot: bThread([
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
    ]),
    addCold: bThread([
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
    ]),
    mixHotCold: bThread([bSync({ waitFor: 'hot', block: 'cold' }), bSync({ waitFor: 'cold', block: 'hot' })], true),
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
    addHot: bThread([
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
      bSync({ request: { type: 'hot' } }),
    ]),
    addCold: bThread([
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
      bSync({ request: { type: 'cold' } }),
    ]),
    mixHotCold: bThread([bSync({ waitFor: 'hot', block: 'cold' }), bSync({ waitFor: 'cold', block: 'hot' })], true),
  })
  trigger({ type: 'start' })
  expect(snapshots).toMatchSnapshot()
})
