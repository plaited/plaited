import { test, expect } from 'bun:test'
import sinon from 'sinon'
import { usePublisher } from '../use-publisher.js'
import { BPEvent } from '../../behavioral/types.js'
import { PlaitedElement } from '../types.js'
import { noop } from '@plaited/utils'

test('usePublisher: sub before pub then disconnect', () => {
  const host = {
    trigger: (evt: BPEvent) => spy(evt),
    addDisconnectedCallback: noop,
  } as PlaitedElement
  const pub = usePublisher<{ value: number }>()
  const spy = sinon.spy()
  const disconnect = pub.sub(host, 'a')
  pub({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  disconnect()
  pub({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
})

test('usePublisher: pub before sub then disconnect', () => {
  const spy = sinon.spy()
  const host = {
    trigger: (evt: BPEvent) => spy(evt),
    addDisconnectedCallback: noop,
  } as PlaitedElement
  const pub = usePublisher<{ value: number }>()
  pub({ value: 4 })
  const disconnect = pub.sub(host, 'b')
  pub({ value: 4 })
  disconnect()
  expect(spy.calledTwice).toBeFalse()
})

test('usePublisher: sub then disconnect before pub', () => {
  const spy = sinon.spy()
  const host = {
    trigger: (evt: BPEvent) => spy(evt),
    addDisconnectedCallback: noop,
  } as PlaitedElement
  const pub = usePublisher<{ value: number }>()
  const disconnect = pub.sub(host, 'b')
  disconnect()
  pub({ value: 4 })
  expect(spy.called).toBeFalse()
})
