import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createSemanticCache, type SemanticCache } from '../semantic-cache.ts'

// ============================================================================
// FTS-only Tests (fast, no embedding model)
// ============================================================================

describe('semantic cache (basic operations)', () => {
  let cache: SemanticCache

  beforeEach(async () => {
    // Use embeddings for all semantic cache tests
    cache = await createSemanticCache({
      similarityThreshold: 0.8,
      maxEntries: 10,
      ttlMs: 60000,
    })
  }, 120000) // 2 min timeout for model loading

  afterEach(() => {
    cache?.close()
  })

  test('stores and retrieves entries', async () => {
    await cache.store('What is the capital of France?', 'Paris is the capital of France.')

    const result = await cache.lookup('What is the capital of France?')

    expect(result.hit).toBe(true)
    expect(result.entry?.response).toBe('Paris is the capital of France.')
  })

  test('returns miss for dissimilar queries', async () => {
    await cache.store('What is the capital of France?', 'Paris')

    const result = await cache.lookup('How do I write a for loop in Python?')

    expect(result.hit).toBe(false)
  })

  test('finds semantically similar queries', async () => {
    await cache.store('What is the capital of France?', 'Paris is the capital of France.')

    // Similar query with different wording
    const result = await cache.lookup("What's France's capital city?")

    expect(result.hit).toBe(true)
    expect(result.entry?.response).toBe('Paris is the capital of France.')
  })

  test('tracks hit count', async () => {
    await cache.store('Test query', 'Test response')

    await cache.lookup('Test query')
    await cache.lookup('Test query')
    const result = await cache.lookup('Test query')

    expect(result.entry?.hitCount).toBe(3)
  })

  test('includes similarity score in result', async () => {
    await cache.store('Hello world', 'Greeting response')

    const result = await cache.lookup('Hello world')

    expect(result.hit).toBe(true)
    expect(result.entry?.similarity).toBeGreaterThan(0.9)
  })

  test('includes lookup time', async () => {
    await cache.store('Query', 'Response')

    const result = await cache.lookup('Query')

    expect(result.lookupMs).toBeGreaterThan(0)
  })
})

// ============================================================================
// Cache Management Tests
// ============================================================================

describe('semantic cache (management)', () => {
  let cache: SemanticCache

  beforeEach(async () => {
    cache = await createSemanticCache({
      maxEntries: 5,
      ttlMs: 100, // 100ms TTL for testing
    })
  }, 120000)

  afterEach(() => {
    cache?.close()
  })

  test('enforces max entries limit', async () => {
    // Store 6 entries (max is 5)
    for (let i = 0; i < 6; i++) {
      await cache.store(`Query ${i}`, `Response ${i}`)
    }

    const stats = cache.stats()
    expect(stats.totalEntries).toBeLessThanOrEqual(5)
  })

  test('clears all entries', async () => {
    await cache.store('Query 1', 'Response 1')
    await cache.store('Query 2', 'Response 2')

    cache.clear()

    const stats = cache.stats()
    expect(stats.totalEntries).toBe(0)
  })

  test('clears expired entries', async () => {
    await cache.store('Query', 'Response')

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    const cleared = cache.clearExpired()
    expect(cleared).toBe(1)
    expect(cache.stats().totalEntries).toBe(0)
  })

  test('respects TTL on lookup', async () => {
    await cache.store('Query', 'Response')

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    const result = await cache.lookup('Query')
    expect(result.hit).toBe(false)
  })
})

// ============================================================================
// Statistics Tests
// ============================================================================

describe('semantic cache (statistics)', () => {
  let cache: SemanticCache

  beforeEach(async () => {
    cache = await createSemanticCache()
  }, 120000)

  afterEach(() => {
    cache?.close()
  })

  test('tracks total entries', async () => {
    await cache.store('Q1', 'R1')
    await cache.store('Q2', 'R2')

    expect(cache.stats().totalEntries).toBe(2)
  })

  test('tracks hits and misses', async () => {
    await cache.store('Query', 'Response')

    await cache.lookup('Query') // hit
    await cache.lookup('Query') // hit
    await cache.lookup('Unknown query about something else entirely') // miss

    const stats = cache.stats()
    expect(stats.totalHits).toBe(2)
    expect(stats.totalMisses).toBe(1)
  })

  test('calculates hit rate', async () => {
    await cache.store('Query', 'Response')

    await cache.lookup('Query') // hit
    await cache.lookup('Query') // hit
    await cache.lookup('Different query about unrelated topic') // miss
    await cache.lookup('Another unrelated query') // miss

    const stats = cache.stats()
    expect(stats.hitRate).toBe(0.5)
  })

  test('calculates average similarity', async () => {
    await cache.store('Hello world', 'Response')

    await cache.lookup('Hello world')
    await cache.lookup('Hello world')

    const stats = cache.stats()
    expect(stats.avgSimilarity).toBeGreaterThan(0.9)
  })
})

// ============================================================================
// getOrCompute Tests
// ============================================================================

describe('semantic cache (getOrCompute)', () => {
  let cache: SemanticCache

  beforeEach(async () => {
    cache = await createSemanticCache()
  }, 120000)

  afterEach(() => {
    cache?.close()
  })

  test('computes and caches on miss', async () => {
    let computeCalled = false

    const result = await cache.getOrCompute('New query', async () => {
      computeCalled = true
      return 'Computed response'
    })

    expect(computeCalled).toBe(true)
    expect(result.response).toBe('Computed response')
    expect(result.cached).toBe(false)

    // Should be cached now
    const stats = cache.stats()
    expect(stats.totalEntries).toBe(1)
  })

  test('returns cached response on hit', async () => {
    await cache.store('Existing query', 'Cached response')
    let computeCalled = false

    const result = await cache.getOrCompute('Existing query', async () => {
      computeCalled = true
      return 'Should not be called'
    })

    expect(computeCalled).toBe(false)
    expect(result.response).toBe('Cached response')
    expect(result.cached).toBe(true)
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('semantic cache (edge cases)', () => {
  test('handles empty cache', async () => {
    const cache = await createSemanticCache()

    const result = await cache.lookup('Any query')

    expect(result.hit).toBe(false)
    expect(cache.stats().totalEntries).toBe(0)

    cache.close()
  }, 120000)

  test('handles special characters in query', async () => {
    const cache = await createSemanticCache()

    await cache.store('Query with "quotes" and <brackets>', 'Response')

    const result = await cache.lookup('Query with "quotes" and <brackets>')

    expect(result.hit).toBe(true)

    cache.close()
  }, 120000)

  test('handles unicode in query', async () => {
    const cache = await createSemanticCache()

    await cache.store('日本語のクエリ', '日本語の応答')

    const result = await cache.lookup('日本語のクエリ')

    expect(result.hit).toBe(true)
    expect(result.entry?.response).toBe('日本語の応答')

    cache.close()
  }, 120000)

  test('handles very long responses', async () => {
    const cache = await createSemanticCache()

    const longResponse = 'x'.repeat(100000)
    await cache.store('Long response query', longResponse)

    const result = await cache.lookup('Long response query')

    expect(result.hit).toBe(true)
    expect(result.entry?.response.length).toBe(100000)

    cache.close()
  }, 120000)
})
