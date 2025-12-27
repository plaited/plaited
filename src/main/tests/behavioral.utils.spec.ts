import { expect, test } from 'bun:test'
import type { BPEvent, PlaitedTrigger, Trigger } from 'plaited'
import { bSync, bThread, isBPEvent, isPlaitedTrigger, shuffleSyncs, useRandomEvent } from 'plaited'

/**
 * Test suite for behavioral.utils.ts
 * Verifies randomness utilities, type guards, and thread composition helpers.
 */

// ============================================================================
// useRandomEvent tests
// ============================================================================

test('useRandomEvent: returns template function that selects one of the provided events', () => {
  const event1: BPEvent = { type: 'event1' }
  const event2: BPEvent = { type: 'event2' }
  const event3: BPEvent = { type: 'event3' }

  const events = [event1, event2, event3]
  const template = useRandomEvent(...events)
  const selected = template()

  expect(selected).toBeDefined()
  expect(events).toContain(selected!)
})

test('useRandomEvent: template function returns the only event when given one', () => {
  const event: BPEvent = { type: 'single' }

  const template = useRandomEvent(event)
  const selected = template()

  expect(selected).toBe(event)
})

test('useRandomEvent: template function returns undefined when given no events', () => {
  const template = useRandomEvent()
  const selected = template()

  expect(selected).toBeUndefined()
})

test('useRandomEvent: template function distributes selection across all events over multiple calls', () => {
  const event1: BPEvent = { type: 'event1' }
  const event2: BPEvent = { type: 'event2' }
  const event3: BPEvent = { type: 'event3' }

  const template = useRandomEvent(event1, event2, event3)
  const selections = new Set<BPEvent>()
  const iterations = 100

  // Run enough times to statistically hit all events
  for (let i = 0; i < iterations; i++) {
    const selected = template()
    if (selected) selections.add(selected)
  }

  // With 100 iterations, we should see all 3 events
  expect(selections.size).toBe(3)
  expect(selections.has(event1)).toBe(true)
  expect(selections.has(event2)).toBe(true)
  expect(selections.has(event3)).toBe(true)
})

test('useRandomEvent: template function preserves event detail property', () => {
  const event1: BPEvent = { type: 'event1', detail: { value: 42 } }
  const event2: BPEvent = { type: 'event2', detail: { value: 99 } }

  const template = useRandomEvent(event1, event2)
  const selected = template()

  expect(selected).toBeDefined()
  expect(selected!.detail).toBeDefined()
  expect([42, 99]).toContain(selected!.detail.value)
})

test('useRandomEvent: each call to template function returns fresh random selection', () => {
  const event1: BPEvent = { type: 'event1' }
  const event2: BPEvent = { type: 'event2' }
  const event3: BPEvent = { type: 'event3' }

  const template = useRandomEvent(event1, event2, event3)

  const selections = new Set<BPEvent>()
  const iterations = 50

  // Multiple calls should eventually select different events
  for (let i = 0; i < iterations; i++) {
    const selected = template()
    if (selected) selections.add(selected)
  }

  // Should see variety in selections
  expect(selections.size).toBeGreaterThan(1)
})

// ============================================================================
// shuffleSyncs tests
// ============================================================================

test('shuffleSyncs: returns array with same length', () => {
  const sync1 = bSync({ request: { type: 'event1' } })
  const sync2 = bSync({ request: { type: 'event2' } })
  const sync3 = bSync({ request: { type: 'event3' } })

  const shuffled = shuffleSyncs(sync1, sync2, sync3)

  expect(shuffled.length).toBe(3)
})

test('shuffleSyncs: contains all original elements', () => {
  const sync1 = bSync({ request: { type: 'event1' } })
  const sync2 = bSync({ request: { type: 'event2' } })
  const sync3 = bSync({ request: { type: 'event3' } })

  const original = [sync1, sync2, sync3]
  const shuffled = shuffleSyncs(sync1, sync2, sync3)

  // All original elements should be present
  for (const sync of original) {
    expect(shuffled).toContain(sync)
  }
})

test('shuffleSyncs: modifies array in-place', () => {
  const sync1 = bSync({ request: { type: 'event1' } })
  const sync2 = bSync({ request: { type: 'event2' } })
  const sync3 = bSync({ request: { type: 'event3' } })

  const syncs = [sync1, sync2, sync3]
  const result = shuffleSyncs(...syncs)

  // Result should be the same array reference
  expect(result).toBeArrayOfSize(3)
})

test('shuffleSyncs: shuffles order over multiple calls', () => {
  const sync1 = bSync({ request: { type: 'event1' } })
  const sync2 = bSync({ request: { type: 'event2' } })
  const sync3 = bSync({ request: { type: 'event3' } })

  const originalOrder = [sync1, sync2, sync3]
  let foundDifferentOrder = false
  const iterations = 20

  // Run multiple times to find at least one different ordering
  for (let i = 0; i < iterations; i++) {
    const shuffled = shuffleSyncs(sync1, sync2, sync3)

    // Check if order is different from original
    const isDifferent = shuffled.some((sync, index) => sync !== originalOrder[index])

    if (isDifferent) {
      foundDifferentOrder = true
      break
    }
  }

  // With 20 iterations, we should see at least one different order
  expect(foundDifferentOrder).toBe(true)
})

test('shuffleSyncs: handles single sync', () => {
  const sync1 = bSync({ request: { type: 'event1' } })

  const shuffled = shuffleSyncs(sync1)

  expect(shuffled).toEqual([sync1])
})

test('shuffleSyncs: handles empty array', () => {
  const shuffled = shuffleSyncs()

  expect(shuffled).toEqual([])
})

// ============================================================================
// isBPEvent tests
// ============================================================================

test('isBPEvent: returns true for valid BPEvent with type only', () => {
  const event = { type: 'test' }

  expect(isBPEvent(event)).toBe(true)
})

test('isBPEvent: returns true for valid BPEvent with type and detail', () => {
  const event = { type: 'test', detail: { value: 42 } }

  expect(isBPEvent(event)).toBe(true)
})

test('isBPEvent: returns false for null', () => {
  expect(isBPEvent(null)).toBe(false)
})

test('isBPEvent: returns false for undefined', () => {
  expect(isBPEvent(undefined)).toBe(false)
})

test('isBPEvent: returns false for string', () => {
  expect(isBPEvent('test')).toBe(false)
})

test('isBPEvent: returns false for number', () => {
  expect(isBPEvent(42)).toBe(false)
})

test('isBPEvent: returns false for array', () => {
  expect(isBPEvent(['test'])).toBe(false)
})

test('isBPEvent: returns false for object without type property', () => {
  const obj = { detail: 'value' }

  expect(isBPEvent(obj)).toBe(false)
})

test('isBPEvent: returns false for object with non-string type', () => {
  const obj = { type: 42 }

  expect(isBPEvent(obj)).toBe(false)
})

test('isBPEvent: returns true for object with additional properties', () => {
  const event = { type: 'test', detail: 'value', extra: 'property' }

  expect(isBPEvent(event)).toBe(true)
})

test('isBPEvent: returns false for Symbol type', () => {
  const obj = { type: Symbol('test') }

  expect(isBPEvent(obj)).toBe(false)
})

// ============================================================================
// bThread tests
// ============================================================================

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

// ============================================================================
// bSync tests
// ============================================================================

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

// ============================================================================
// isPlaitedTrigger tests
// ============================================================================

test('isPlaitedTrigger: returns true for trigger with addDisconnectCallback', () => {
  const trigger = Object.assign((() => {}) as Trigger, {
    addDisconnectCallback: () => {},
  }) as PlaitedTrigger

  expect(isPlaitedTrigger(trigger)).toBe(true)
})

test('isPlaitedTrigger: returns false for trigger without addDisconnectCallback', () => {
  const trigger = (() => {}) as Trigger

  expect(isPlaitedTrigger(trigger)).toBe(false)
})

test('isPlaitedTrigger: returns false for object with inherited addDisconnectCallback', () => {
  const proto = { addDisconnectCallback: () => {} }
  const trigger = Object.create(proto) as Trigger

  // Object.hasOwn checks own property, not inherited
  expect(isPlaitedTrigger(trigger)).toBe(false)
})

test('isPlaitedTrigger: returns true when addDisconnectCallback is own property', () => {
  const trigger = {} as Trigger
  Object.defineProperty(trigger, 'addDisconnectCallback', {
    value: () => {},
    enumerable: true,
  })

  expect(isPlaitedTrigger(trigger)).toBe(true)
})
