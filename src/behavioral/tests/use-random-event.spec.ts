import { expect, test } from 'bun:test'
import type { BPEvent } from 'plaited'
import { useRandomEvent } from 'plaited'

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
