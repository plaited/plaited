import { expect, test } from 'bun:test'
import { bSync } from 'plaited'

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
  const sync = bSync({ waitFor: 'event' })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'waitFor' in value && value.waitFor).toBe('event')
})

test('bSync: supports block idiom', () => {
  const sync = bSync({ block: 'event' })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'block' in value && value.block).toBe('event')
})

test('bSync: supports interrupt idiom', () => {
  const sync = bSync({ interrupt: 'event' })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'interrupt' in value && value.interrupt).toBe('event')
})

test('bSync: supports multiple idioms together', () => {
  const sync = bSync({
    request: { type: 'event1' },
    waitFor: 'event2',
    block: 'event3',
  })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'request' in value && value.request).toEqual({ type: 'event1' })
  expect(value && 'waitFor' in value && value.waitFor).toBe('event2')
  expect(value && 'block' in value && value.block).toBe('event3')
})

test('bSync: supports predicate functions for waitFor', () => {
  const predicate = ({ type }: { type: string }) => type === 'target'
  const sync = bSync({ waitFor: predicate })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'waitFor' in value && value.waitFor).toBe(predicate)
})

test('bSync: supports arrays of listeners', () => {
  const sync = bSync({
    waitFor: ['event1', 'event2'],
    block: ['event3', 'event4'],
  })
  const gen = sync()

  const { value } = gen.next()

  expect(value && 'waitFor' in value && value.waitFor).toEqual(['event1', 'event2'])
  expect(value && 'block' in value && value.block).toEqual(['event3', 'event4'])
})

test('bSync: supports event template functions', () => {
  const template = () => ({ type: 'dynamic', detail: Date.now() })
  const sync = bSync({ request: template })
  const gen = sync()

  const { value } = gen.next()

  // Template function is yielded as-is, not called
  expect(value && 'request' in value && value.request).toBe(template)
  expect(value && 'request' in value && typeof value.request).toBe('function')
})

test('bSync: event template function preserves closure state', () => {
  let capturedValue = 42

  // Template function captures state from closure
  const template = () => ({ type: 'process', detail: capturedValue })

  const sync = bSync({ request: template })
  const gen = sync()

  const { value } = gen.next()

  // Verify template function is yielded
  expect(value && 'request' in value && typeof value.request).toBe('function')

  // When BP engine calls the template, it should use current closure value
  if (value && 'request' in value && typeof value.request === 'function') {
    const result = value.request()
    expect(result).toEqual({ type: 'process', detail: 42 })

    // Update closure value
    capturedValue = 99

    // Template should now return updated value
    const result2 = value.request()
    expect(result2).toEqual({ type: 'process', detail: 99 })
  }
})
