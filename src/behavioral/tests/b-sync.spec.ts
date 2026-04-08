import { expect, test } from 'bun:test'
import { bSync } from 'plaited/behavioral'
import { onType } from './helpers.ts'

test('bSync: creates generator that yields sync point once', () => {
  const syncPoint = { request: { type: 'test' } }
  const sync = bSync(syncPoint)
  const gen = sync()

  const { value, done: done1 } = gen.next()

  expect(value).toEqual(syncPoint)
  expect(done1).toBe(false)

  const { done: done2 } = gen.next()
  expect(done2).toBe(true)
})

test('bSync: supports request idiom', () => {
  const sync = bSync({ request: { type: 'event' } })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'request' in value && value.request).toEqual({ type: 'event' })
})

test('bSync: supports waitFor idiom', () => {
  const waitFor = onType('event')
  const sync = bSync({ waitFor })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'waitFor' in value && value.waitFor).toEqual(waitFor)
})

test('bSync: supports block idiom', () => {
  const block = onType('event')
  const sync = bSync({ block })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'block' in value && value.block).toEqual(block)
})

test('bSync: supports interrupt idiom', () => {
  const interrupt = onType('event')
  const sync = bSync({ interrupt })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'interrupt' in value && value.interrupt).toEqual(interrupt)
})

test('bSync: supports multiple idioms together', () => {
  const waitFor = onType('event2')
  const block = onType('event3')
  const sync = bSync({
    request: { type: 'event1' },
    waitFor,
    block,
  })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'request' in value && value.request).toEqual({ type: 'event1' })
  expect(value && 'waitFor' in value && value.waitFor).toEqual(waitFor)
  expect(value && 'block' in value && value.block).toEqual(block)
})

test('bSync: supports detail-schema conditions in listeners', () => {
  const listener = onType('target')
  const sync = bSync({ waitFor: listener })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'waitFor' in value && value.waitFor).toEqual(listener)
})

test('bSync: supports arrays of listeners', () => {
  const waitFor = [onType('event1'), onType('event2')]
  const block = [onType('event3'), onType('event4')]
  const sync = bSync({
    waitFor,
    block,
  })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'waitFor' in value && value.waitFor).toEqual(waitFor)
  expect(value && 'block' in value && value.block).toEqual(block)
})
