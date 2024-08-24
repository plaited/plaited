import { test, expect } from 'bun:test'
import sinon from 'sinon'
import { usePublisher } from '../use-publisher.js'
import { BPEvent } from '../../behavioral/types.js'
import { noop } from '@plaited/utils'

test('usePublisher: sub before pub then disconnect', () => {
  const context = {
    trigger: (evt: BPEvent) => spy(evt),
    addDisconnectedCallback: noop,
  }
  const pub = usePublisher<{ value: number }>()
  const spy = sinon.spy()
  const disconnect = pub.sub('a', context)
  pub({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  disconnect()
  pub({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
})

test('usePublisher: pub before sub then disconnect', () => {
  const spy = sinon.spy()
  const context = {
    trigger: (evt: BPEvent) => spy(evt),
    addDisconnectedCallback: noop,
  }
  const pub = usePublisher<{ value: number }>()
  pub({ value: 4 })
  const disconnect = pub.sub('b', context)
  pub({ value: 4 })
  disconnect()
  expect(spy.calledTwice).toBeFalse()
})

test('usePublisher: sub then disconnect before pub', () => {
  const spy = sinon.spy()
  const context = {
    trigger: (evt: BPEvent) => spy(evt),
    addDisconnectedCallback: noop,
  }
  const pub = usePublisher<{ value: number }>()
  const disconnect = pub.sub('b', context)
  disconnect()
  pub({ value: 4 })
  expect(spy.called).toBeFalse()
})
