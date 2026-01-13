import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { createSemanticCache, type SemanticCache } from '../semantic-cache.ts'

// ============================================================================
// Semantic Cache Tests (requires Ollama)
// ============================================================================

let sharedCache: SemanticCache

beforeAll(async () => {
  const cache = await createSemanticCache({
    similarityThreshold: 0.8,
    maxEntries: 100,
    ttlMs: 60000,
  })
  expect(cache).toBeDefined()
  sharedCache = cache!
}, 120000) // 2 min timeout for model loading

afterEach(() => {
  sharedCache.clear()
})

afterAll(() => {
  sharedCache.close()
})

describe('semantic cache (basic operations)', () => {
  test('stores and retrieves entries', async () => {
    await sharedCache.store('What is the capital of France?', 'Paris is the capital of France.')

    const result = await sharedCache.lookup('What is the capital of France?')

    expect(result.hit).toBe(true)
    expect(result.entry?.response).toBe('Paris is the capital of France.')
  })

  test('returns miss for dissimilar queries', async () => {
    await sharedCache.store('What is the capital of France?', 'Paris')

    const result = await sharedCache.lookup('How do I write a for loop in Python?')

    expect(result.hit).toBe(false)
  })

  test('finds semantically similar queries', async () => {
    await sharedCache.store('What is the capital of France?', 'Paris is the capital of France.')

    // Similar query with different wording
    const result = await sharedCache.lookup("What's France's capital city?")

    expect(result.hit).toBe(true)
    expect(result.entry?.response).toBe('Paris is the capital of France.')
  })

  test('tracks hit count', async () => {
    await sharedCache.store('Test query', 'Test response')

    await sharedCache.lookup('Test query')
    await sharedCache.lookup('Test query')
    const result = await sharedCache.lookup('Test query')

    expect(result.entry?.hitCount).toBe(3)
  })

  test('includes similarity score in result', async () => {
    await sharedCache.store('Hello world', 'Greeting response')

    const result = await sharedCache.lookup('Hello world')

    expect(result.hit).toBe(true)
    expect(result.entry?.similarity).toBeGreaterThan(0.9)
  })

  test('includes lookup time', async () => {
    await sharedCache.store('Query', 'Response')

    const result = await sharedCache.lookup('Query')

    expect(result.lookupMs).toBeGreaterThan(0)
  })
})

// ============================================================================
// Cache Management Tests
// ============================================================================

describe('semantic cache (management)', () => {
  test('enforces max entries limit', async () => {
    // Create a cache with small limit for this test
    const smallCache = await createSemanticCache({
      maxEntries: 5,
      ttlMs: 60000,
    })
    expect(smallCache).toBeDefined()

    // Store 6 entries (max is 5)
    for (let i = 0; i < 6; i++) {
      await smallCache!.store(`Query ${i}`, `Response ${i}`)
    }

    const stats = smallCache!.stats()
    expect(stats.totalEntries).toBeLessThanOrEqual(5)
    smallCache!.close()
  })

  test('clears all entries', async () => {
    await sharedCache.store('Query 1', 'Response 1')
    await sharedCache.store('Query 2', 'Response 2')

    sharedCache.clear()

    const stats = sharedCache.stats()
    expect(stats.totalEntries).toBe(0)
  })

  test('clears expired entries', async () => {
    const shortTtlCache = await createSemanticCache({
      ttlMs: 100, // 100ms TTL for testing
    })
    expect(shortTtlCache).toBeDefined()

    await shortTtlCache?.store('Query', 'Response')

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    const cleared = shortTtlCache!.clearExpired()
    expect(cleared).toBe(1)
    expect(shortTtlCache?.stats().totalEntries).toBe(0)
    shortTtlCache?.close()
  })

  test('respects TTL on lookup', async () => {
    const shortTtlCache = await createSemanticCache({
      ttlMs: 100, // 100ms TTL for testing
    })
    expect(shortTtlCache).toBeDefined()

    await shortTtlCache?.store('Query', 'Response')

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    const result = await shortTtlCache!.lookup('Query')
    expect(result.hit).toBe(false)
    shortTtlCache!.close()
  })
})

// ============================================================================
// Statistics Tests
// ============================================================================

describe('semantic cache (statistics)', () => {
  test('tracks total entries', async () => {
    await sharedCache.store('Q1', 'R1')
    await sharedCache.store('Q2', 'R2')

    expect(sharedCache.stats().totalEntries).toBe(2)
  })

  test('tracks hits and misses', async () => {
    await sharedCache.store('How to bake chocolate chip cookies', 'Response')

    await sharedCache.lookup('How to bake chocolate chip cookies') // hit
    await sharedCache.lookup('Chocolate chip cookie recipe') // hit (semantically similar)
    await sharedCache.lookup('Quantum mechanics wave function collapse') // miss (unrelated)

    const stats = sharedCache.stats()
    expect(stats.totalHits).toBe(2)
    expect(stats.totalMisses).toBe(1)
  })

  test('calculates hit rate', async () => {
    await sharedCache.store('Best Italian restaurants in New York', 'Response')

    await sharedCache.lookup('Italian dining NYC') // hit (semantically similar)
    await sharedCache.lookup('New York Italian food') // hit (semantically similar)
    await sharedCache.lookup('Python asyncio tutorial for beginners') // miss (unrelated)
    await sharedCache.lookup('How to fix a leaking faucet') // miss (unrelated)

    const stats = sharedCache.stats()
    expect(stats.hitRate).toBe(0.5)
  })

  test('calculates average similarity', async () => {
    await sharedCache.store('Hello world', 'Response')

    await sharedCache.lookup('Hello world')
    await sharedCache.lookup('Hello world')

    const stats = sharedCache.stats()
    expect(stats.avgSimilarity).toBeGreaterThan(0.9)
  })
})

// ============================================================================
// getOrCompute Tests
// ============================================================================

describe('semantic cache (getOrCompute)', () => {
  test('computes and caches on miss', async () => {
    let computeCalled = false

    const result = await sharedCache.getOrCompute('New query', async () => {
      computeCalled = true
      return 'Computed response'
    })

    expect(computeCalled).toBe(true)
    expect(result.response).toBe('Computed response')
    expect(result.cached).toBe(false)

    // Should be cached now
    const stats = sharedCache.stats()
    expect(stats.totalEntries).toBe(1)
  })

  test('returns cached response on hit', async () => {
    await sharedCache.store('Existing query', 'Cached response')
    let computeCalled = false

    const result = await sharedCache.getOrCompute('Existing query', async () => {
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
  test('returns undefined when model unavailable', async () => {
    const cache = await createSemanticCache({
      embedder: {
        modelUri: 'hf:nonexistent/model-that-does-not-exist:Q8_0',
      },
    })

    expect(cache).toBeUndefined()
  }, 120000)

  test('handles empty cache', async () => {
    const freshCache = await createSemanticCache()
    expect(freshCache).toBeDefined()

    const result = await freshCache!.lookup('Any query')

    expect(result.hit).toBe(false)
    expect(freshCache!.stats().totalEntries).toBe(0)

    freshCache!.close()
  })

  test('handles special characters in query', async () => {
    await sharedCache.store('Query with "quotes" and <brackets>', 'Response')

    const result = await sharedCache.lookup('Query with "quotes" and <brackets>')

    expect(result.hit).toBe(true)
  })

  test('handles unicode in query', async () => {
    await sharedCache.store('日本語のクエリ', '日本語の応答')

    const result = await sharedCache.lookup('日本語のクエリ')

    expect(result.hit).toBe(true)
    expect(result.entry?.response).toBe('日本語の応答')
  })

  test('handles very long responses', async () => {
    const longResponse = 'x'.repeat(100000)
    await sharedCache.store('Long response query', longResponse)

    const result = await sharedCache.lookup('Long response query')

    expect(result.hit).toBe(true)
    expect(result.entry?.response.length).toBe(100000)
  })
})
