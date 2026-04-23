import { expect, test } from 'bun:test'
import type { BPEvent } from '../behavioral.schemas.ts'
import { thread as bThread, sync } from '../behavioral.utils.ts'
import { onType } from './helpers.ts'

test('bThread: executes rules sequentially', () => {
  const results: string[] = []

  const rule1 = sync({ request: { type: 'event1' } })
  const rule2 = sync({ request: { type: 'event2' } })
  const rule3 = sync({ request: { type: 'event3' } })

  const behaviorThread = bThread([rule1, rule2, rule3], true)
  const gen = behaviorThread()

  const { value: value1 } = gen.next()
  if (value1 && 'request' in value1 && value1.request && typeof value1.request !== 'function') {
    results.push(value1.request.type)
  }

  const { value: value2 } = gen.next()
  if (value2 && 'request' in value2 && value2.request && typeof value2.request !== 'function') {
    results.push(value2.request.type)
  }

  const { value: value3 } = gen.next()
  if (value3 && 'request' in value3 && value3.request && typeof value3.request !== 'function') {
    results.push(value3.request.type)
  }

  expect(results).toEqual(['event1', 'event2', 'event3'])
})

test('bThread: completes after all rules when once is true', () => {
  const rule1 = sync({ request: { type: 'event1' } })
  const rule2 = sync({ request: { type: 'event2' } })

  const behaviorThread = bThread([rule1, rule2], true)
  const gen = behaviorThread()

  gen.next() // event1
  gen.next() // event2
  const { done } = gen.next()

  expect(done).toBe(true)
})

test('bThread: repeats when once is omitted', () => {
  const rule1 = sync({ request: { type: 'event1' } })
  const rule2 = sync({ request: { type: 'event2' } })

  const behaviorThread = bThread([rule1, rule2])
  const gen = behaviorThread()

  // First iteration
  const { value: value1 } = gen.next()
  expect(value1).toBeDefined()
  expect(value1).toHaveProperty('request')
  expect(typeof value1!.request).not.toBe('function')
  expect((value1!.request as BPEvent).type).toBe('event1')

  const { value: value2 } = gen.next()
  expect(value2).toBeDefined()
  expect(value2).toHaveProperty('request')
  expect(typeof value2!.request).not.toBe('function')
  expect((value2!.request as BPEvent).type).toBe('event2')

  // Second iteration (repeat)
  const { value: value3 } = gen.next()
  expect(value3).toBeDefined()
  expect(value3).toHaveProperty('request')
  expect(typeof value3!.request).not.toBe('function')
  expect((value3!.request as BPEvent).type).toBe('event1')

  const { value: value4 } = gen.next()
  expect(value4).toBeDefined()
  expect(value4).toHaveProperty('request')
  expect(typeof value4!.request).not.toBe('function')
  expect((value4!.request as BPEvent).type).toBe('event2')

  // Third iteration (still going)
  const { value: value5, done } = gen.next()
  expect(value5).toBeDefined()
  expect(value5).toHaveProperty('request')
  expect(typeof value5!.request).not.toBe('function')
  expect((value5!.request as BPEvent).type).toBe('event1')
  expect(done).toBe(false)
})

test('bThread: handles empty rules array', () => {
  const behaviorThread = bThread([], true)
  const gen = behaviorThread()

  const { done } = gen.next()

  expect(done).toBe(true)
})

test('bThread: handles single rule', () => {
  const rule1 = sync({ request: { type: 'event1' } })

  const behaviorThread = bThread([rule1], true)
  const gen = behaviorThread()

  const { value } = gen.next()
  expect(value).toBeDefined()
  expect(value).toHaveProperty('request')
  expect(typeof value!.request).not.toBe('function')
  expect((value!.request as BPEvent).type).toBe('event1')

  const { done } = gen.next()
  expect(done).toBe(true)
})

test('bThread: supports all idioms in rules', () => {
  const waitFor = onType('event2')
  const block = onType('event3')
  const interrupt = onType('event4')
  const rule1 = sync({
    request: { type: 'event1' },
    waitFor,
    block,
    interrupt,
  })

  const behaviorThread = bThread([rule1], true)
  const gen = behaviorThread()

  const { value } = gen.next()

  expect(value).toBeDefined()
  expect(value).toHaveProperty('request')
  expect(typeof value!.request).not.toBe('function')
  expect((value!.request as BPEvent).type).toBe('event1')
  expect(value).toHaveProperty('waitFor')
  expect(value!.waitFor).toEqual(waitFor)
  expect(value).toHaveProperty('block')
  expect(value!.block).toEqual(block)
  expect(value).toHaveProperty('interrupt')
  expect(value!.interrupt).toEqual(interrupt)
})
