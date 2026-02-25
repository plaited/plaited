import { describe, expect, test } from 'bun:test'
import { calculatePassAtK, calculatePassExpK } from '../trials.ts'

// ============================================================================
// calculatePassAtK
// ============================================================================

describe('calculatePassAtK', () => {
  test('returns 1 when all trials pass', () => {
    expect(calculatePassAtK(5, 5)).toBe(1)
    expect(calculatePassAtK(10, 10)).toBe(1)
    expect(calculatePassAtK(1, 1)).toBe(1)
  })

  test('returns 0 when no trials pass', () => {
    expect(calculatePassAtK(0, 5)).toBe(0)
    expect(calculatePassAtK(0, 10)).toBe(0)
    expect(calculatePassAtK(0, 1)).toBe(0)
  })

  test('calculates probability correctly for partial passes', () => {
    // pass@k = 1 - (1 - passRate)^k
    // For 3 passes out of 5: passRate = 0.6
    // pass@5 = 1 - (0.4)^5 = 1 - 0.01024 = 0.98976
    const result = calculatePassAtK(3, 5)
    expect(result).toBeCloseTo(0.98976, 5)
  })

  test('k=1 equals the pass rate', () => {
    // For k=1, pass@1 = 1 - (1 - p)^1 = p
    expect(calculatePassAtK(1, 1)).toBe(1)

    // More interesting: 0 passes, 1 trial
    expect(calculatePassAtK(0, 1)).toBe(0)
  })

  test('higher pass rate yields higher pass@k', () => {
    const lowPassRate = calculatePassAtK(1, 5) // 20% pass rate
    const highPassRate = calculatePassAtK(4, 5) // 80% pass rate

    expect(highPassRate).toBeGreaterThan(lowPassRate)
  })

  test('larger k amplifies probability of at least one pass', () => {
    // With 50% pass rate, larger k means higher chance of at least one pass
    // k=2: 1 - (0.5)^2 = 0.75
    // k=4: 1 - (0.5)^4 = 0.9375

    const k2 = calculatePassAtK(1, 2) // 50% pass rate
    const k4 = calculatePassAtK(2, 4) // Also 50% pass rate

    expect(k4).toBeGreaterThan(k2)
  })

  test('handles edge case where passes equals k', () => {
    expect(calculatePassAtK(3, 3)).toBe(1)
  })

  test('handles passes greater than k (returns 1)', () => {
    // This shouldn't happen in practice, but the function handles it
    expect(calculatePassAtK(10, 5)).toBe(1)
  })

  test('mathematical verification with known values', () => {
    // 1 out of 3 passes: passRate = 1/3
    // pass@3 = 1 - (2/3)^3 = 1 - 8/27 = 19/27 ≈ 0.7037
    const result = calculatePassAtK(1, 3)
    expect(result).toBeCloseTo(19 / 27, 5)

    // 2 out of 4 passes: passRate = 0.5
    // pass@4 = 1 - (0.5)^4 = 1 - 0.0625 = 0.9375
    const result2 = calculatePassAtK(2, 4)
    expect(result2).toBeCloseTo(0.9375, 5)
  })
})

// ============================================================================
// calculatePassExpK
// ============================================================================

describe('calculatePassExpK', () => {
  test('returns 1 when all trials pass', () => {
    expect(calculatePassExpK(5, 5)).toBe(1)
    expect(calculatePassExpK(10, 10)).toBe(1)
    expect(calculatePassExpK(1, 1)).toBe(1)
  })

  test('returns 0 when no trials pass', () => {
    expect(calculatePassExpK(0, 5)).toBe(0)
    expect(calculatePassExpK(0, 10)).toBe(0)
    expect(calculatePassExpK(0, 1)).toBe(0)
  })

  test('calculates probability correctly', () => {
    // pass^k = passRate^k
    // For 3 passes out of 5: passRate = 0.6
    // pass^5 = (0.6)^5 = 0.07776
    const result = calculatePassExpK(3, 5)
    expect(result).toBeCloseTo(0.07776, 5)
  })

  test('k=1 equals the pass rate', () => {
    // For k=1, pass^1 = p^1 = p
    expect(calculatePassExpK(1, 1)).toBe(1)
  })

  test('higher pass rate yields higher pass^k', () => {
    const lowPassRate = calculatePassExpK(1, 5) // 20% pass rate
    const highPassRate = calculatePassExpK(4, 5) // 80% pass rate

    expect(highPassRate).toBeGreaterThan(lowPassRate)
  })

  test('larger k reduces probability of all passing (for non-100% rates)', () => {
    // With 80% pass rate:
    // k=2: (0.8)^2 = 0.64
    // k=5: (0.8)^5 = 0.32768

    // Mathematical verification using known formulas
    const k2_fair = 0.8 ** 2 // = 0.64
    const k5_fair = 0.8 ** 5 // = 0.32768

    expect(k5_fair).toBeLessThan(k2_fair)

    // Also verify our function produces consistent results
    // 4 out of 5 gives 80% pass rate
    const result = calculatePassExpK(4, 5)
    expect(result).toBeCloseTo(k5_fair, 5)
  })

  test('handles edge case where passes equals k', () => {
    expect(calculatePassExpK(3, 3)).toBe(1)
  })

  test('mathematical verification with known values', () => {
    // 1 out of 3 passes: passRate = 1/3
    // pass^3 = (1/3)^3 = 1/27 ≈ 0.037
    const result = calculatePassExpK(1, 3)
    expect(result).toBeCloseTo(1 / 27, 5)

    // 2 out of 4 passes: passRate = 0.5
    // pass^4 = (0.5)^4 = 0.0625
    const result2 = calculatePassExpK(2, 4)
    expect(result2).toBeCloseTo(0.0625, 5)

    // 3 out of 4 passes: passRate = 0.75
    // pass^4 = (0.75)^4 = 0.31640625
    const result3 = calculatePassExpK(3, 4)
    expect(result3).toBeCloseTo(0.31640625, 5)
  })

  test('pass^k is always less than or equal to pass@k', () => {
    // For any pass rate < 100%, pass^k <= pass@k
    // This is because "all pass" is a subset of "at least one passes"

    const testCases = [
      { passes: 1, k: 5 },
      { passes: 2, k: 5 },
      { passes: 3, k: 5 },
      { passes: 4, k: 5 },
      { passes: 1, k: 3 },
      { passes: 2, k: 4 },
    ]

    for (const { passes, k } of testCases) {
      const passExpK = calculatePassExpK(passes, k)
      const passAtK = calculatePassAtK(passes, k)
      expect(passExpK).toBeLessThanOrEqual(passAtK)
    }
  })
})

// ============================================================================
// Combined behavior tests
// ============================================================================

describe('pass@k and pass^k relationship', () => {
  test('100% pass rate: both metrics equal 1', () => {
    expect(calculatePassAtK(5, 5)).toBe(1)
    expect(calculatePassExpK(5, 5)).toBe(1)
  })

  test('0% pass rate: both metrics equal 0', () => {
    expect(calculatePassAtK(0, 5)).toBe(0)
    expect(calculatePassExpK(0, 5)).toBe(0)
  })

  test('gap between metrics varies with pass rate', () => {
    // At 50% pass rate, the gap is maximized
    // At extreme pass rates (0% or 100%), the gap is 0

    // 50% pass rate with k=4
    const midAtK = calculatePassAtK(2, 4) // 0.9375
    const midExpK = calculatePassExpK(2, 4) // 0.0625
    const midGap = midAtK - midExpK // 0.875

    // 80% pass rate with k=5
    const highAtK = calculatePassAtK(4, 5)
    const highExpK = calculatePassExpK(4, 5)
    const highGap = highAtK - highExpK

    // Both gaps should be positive (pass@k > pass^k for partial pass rates)
    expect(midGap).toBeGreaterThan(0)
    expect(highGap).toBeGreaterThan(0)

    // Mid-range pass rate has larger gap than high pass rate
    expect(midGap).toBeGreaterThan(highGap)
  })
})
