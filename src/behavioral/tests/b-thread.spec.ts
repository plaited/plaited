import { expect, test } from 'bun:test'
import type { BPEvent } from 'plaited'
import { bSync, bThread } from 'plaited'

test('bThread: executes rules sequentially', () => {
  const results: string[] = []

  const rule1 = bSync({ request: { type: 'event1' } })
  const rule2 = bSync({ request: { type: 'event2' } })
  const rule3 = bSync({ request: { type: 'event3' } })

  const thread = bThread([rule1, rule2, rule3])
  const gen = thread()

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

test('bThread: completes after all rules when repeat is false', () => {
  const rule1 = bSync({ request: { type: 'event1' } })
  const rule2 = bSync({ request: { type: 'event2' } })

  const thread = bThread([rule1, rule2])
  const gen = thread()

  gen.next() // event1
  gen.next() // event2
  const { done } = gen.next()

  expect(done).toBe(true)
})

test('bThread: repeats when repeat is true', () => {
  const rule1 = bSync({ request: { type: 'event1' } })
  const rule2 = bSync({ request: { type: 'event2' } })

  const thread = bThread([rule1, rule2], true)
  const gen = thread()

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

test('bThread: repeats based on function evaluation', () => {
  const rule1 = bSync({ request: { type: 'event1' } })
  const rule2 = bSync({ request: { type: 'event2' } })

  let iterations = 0
  const shouldRepeat = () => {
    iterations++
    return iterations < 3 // Repeat 3 times total
  }

  const thread = bThread([rule1, rule2], shouldRepeat)
  const gen = thread()

  // First iteration
  gen.next() // event1
  gen.next() // event2

  // Second iteration
  gen.next() // event1
  gen.next() // event2

  // Third iteration
  gen.next() // event1
  gen.next() // event2

  // Should be done now
  const { done } = gen.next()
  expect(done).toBe(true)
})

test('bThread: handles empty rules array', () => {
  const thread = bThread([])
  const gen = thread()

  const { done } = gen.next()

  expect(done).toBe(true)
})

test('bThread: handles single rule', () => {
  const rule1 = bSync({ request: { type: 'event1' } })

  const thread = bThread([rule1])
  const gen = thread()

  const { value } = gen.next()
  expect(value).toBeDefined()
  expect(value).toHaveProperty('request')
  expect(typeof value!.request).not.toBe('function')
  expect((value!.request as BPEvent).type).toBe('event1')

  const { done } = gen.next()
  expect(done).toBe(true)
})

test('bThread: supports all idioms in rules', () => {
  const rule1 = bSync({
    request: { type: 'event1' },
    waitFor: 'event2',
    block: 'event3',
    interrupt: 'event4',
  })

  const thread = bThread([rule1])
  const gen = thread()

  const { value } = gen.next()

  expect(value).toBeDefined()
  expect(value).toHaveProperty('request')
  expect(typeof value!.request).not.toBe('function')
  expect((value!.request as BPEvent).type).toBe('event1')
  expect(value).toHaveProperty('waitFor')
  expect(value!.waitFor).toBe('event2')
  expect(value).toHaveProperty('block')
  expect(value!.block).toBe('event3')
  expect(value).toHaveProperty('interrupt')
  expect(value!.interrupt).toBe('event4')
})

test('bThread: supports event template functions for dynamic data', () => {
  let counter = 0

  // Event template function that returns different data each time
  const template = () => ({ type: 'increment', detail: ++counter })

  const rule1 = bSync({ request: template })

  const thread = bThread([rule1], true) // Repeat to show dynamic evaluation
  const gen = thread()

  // First iteration - template should NOT be called yet
  const { value: value1 } = gen.next()
  expect(value1 && 'request' in value1 && value1.request).toBe(template)
  expect(value1 && 'request' in value1 && typeof value1.request).toBe('function')

  // Second iteration (repeat) - should still yield the template function
  const { value: value2 } = gen.next()
  expect(value2 && 'request' in value2 && value2.request).toBe(template)
  expect(value2 && 'request' in value2 && typeof value2.request).toBe('function')

  // The template function itself should be yielded, not its result
  // BP engine will call the template when needed during event selection
})
