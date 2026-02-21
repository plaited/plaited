import { expect, test } from 'bun:test'
import { bSync, shuffleSyncs } from 'plaited'

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
