import { describe, expect, test } from 'bun:test'
import type { CategoryDistribution, PromptCase } from '../../schemas.ts'
import { analyzeCategories, findUnderrepresented, generateSuggestions } from '../balance.ts'

// ============================================================================
// analyzeCategories
// ============================================================================

describe('analyzeCategories', () => {
  test('counts prompts by category', () => {
    const prompts: PromptCase[] = [
      { id: '1', input: 'test', metadata: { category: 'math' } },
      { id: '2', input: 'test', metadata: { category: 'math' } },
      { id: '3', input: 'test', metadata: { category: 'code' } },
    ]

    const result = analyzeCategories(prompts, 'category')

    expect(result).toHaveLength(2)
    const math = result.find((d) => d.name === 'math')
    const code = result.find((d) => d.name === 'code')

    expect(math?.count).toBe(2)
    expect(code?.count).toBe(1)
  })

  test('calculates percentages correctly', () => {
    const prompts: PromptCase[] = [
      { id: '1', input: 'test', metadata: { category: 'a' } },
      { id: '2', input: 'test', metadata: { category: 'a' } },
      { id: '3', input: 'test', metadata: { category: 'b' } },
      { id: '4', input: 'test', metadata: { category: 'b' } },
    ]

    const result = analyzeCategories(prompts, 'category')

    expect(result[0]?.percentage).toBe(50)
    expect(result[1]?.percentage).toBe(50)
  })

  test('sorts by count descending', () => {
    const prompts: PromptCase[] = [
      { id: '1', input: 'test', metadata: { category: 'small' } },
      { id: '2', input: 'test', metadata: { category: 'large' } },
      { id: '3', input: 'test', metadata: { category: 'large' } },
      { id: '4', input: 'test', metadata: { category: 'large' } },
      { id: '5', input: 'test', metadata: { category: 'medium' } },
      { id: '6', input: 'test', metadata: { category: 'medium' } },
    ]

    const result = analyzeCategories(prompts, 'category')

    expect(result[0]?.name).toBe('large')
    expect(result[1]?.name).toBe('medium')
    expect(result[2]?.name).toBe('small')
  })

  test('handles missing metadata as (uncategorized)', () => {
    const prompts: PromptCase[] = [
      { id: '1', input: 'test', metadata: { category: 'known' } },
      { id: '2', input: 'test' }, // No metadata
      { id: '3', input: 'test', metadata: {} }, // Empty metadata
    ]

    const result = analyzeCategories(prompts, 'category')

    const uncategorized = result.find((d) => d.name === '(uncategorized)')
    expect(uncategorized?.count).toBe(2)
  })

  test('handles different metadata keys', () => {
    const prompts: PromptCase[] = [
      { id: '1', input: 'test', metadata: { difficulty: 'easy', category: 'math' } },
      { id: '2', input: 'test', metadata: { difficulty: 'hard', category: 'math' } },
      { id: '3', input: 'test', metadata: { difficulty: 'easy', category: 'code' } },
    ]

    const byDifficulty = analyzeCategories(prompts, 'difficulty')
    const byCategory = analyzeCategories(prompts, 'category')

    expect(byDifficulty.find((d) => d.name === 'easy')?.count).toBe(2)
    expect(byCategory.find((d) => d.name === 'math')?.count).toBe(2)
  })

  test('converts non-string metadata values to strings', () => {
    const prompts: PromptCase[] = [
      { id: '1', input: 'test', metadata: { level: 1 } },
      { id: '2', input: 'test', metadata: { level: 1 } },
      { id: '3', input: 'test', metadata: { level: 2 } },
    ]

    const result = analyzeCategories(prompts, 'level')

    expect(result.find((d) => d.name === '1')?.count).toBe(2)
    expect(result.find((d) => d.name === '2')?.count).toBe(1)
  })

  test('handles empty prompts array', () => {
    const result = analyzeCategories([], 'category')
    expect(result).toEqual([])
  })

  test('rounds percentages to integers', () => {
    const prompts: PromptCase[] = [
      { id: '1', input: 'test', metadata: { category: 'a' } },
      { id: '2', input: 'test', metadata: { category: 'b' } },
      { id: '3', input: 'test', metadata: { category: 'c' } },
    ]

    const result = analyzeCategories(prompts, 'category')

    // 1/3 = 33.33... should round to 33
    for (const dist of result) {
      expect(Number.isInteger(dist.percentage)).toBe(true)
    }
  })
})

// ============================================================================
// findUnderrepresented
// ============================================================================

describe('findUnderrepresented', () => {
  test('identifies categories below threshold', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'large', count: 50, percentage: 50 },
      { name: 'medium', count: 30, percentage: 30 },
      { name: 'small', count: 20, percentage: 20 },
    ]

    // Even distribution would be 33.3% each
    // With 50% threshold, anything below 16.65% is underrepresented
    const result = findUnderrepresented(distributions, 50)

    // At 50% threshold, 20% is above 16.65%, so nothing should be underrepresented
    expect(result).toEqual([])
  })

  test('returns underrepresented categories at stricter threshold', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'large', count: 80, percentage: 80 },
      { name: 'small', count: 20, percentage: 20 },
    ]

    // Even distribution would be 50% each
    // With 50% threshold, anything below 25% is underrepresented
    const result = findUnderrepresented(distributions, 50)

    expect(result).toContain('small')
    expect(result).not.toContain('large')
  })

  test('handles even distribution (no underrepresentation)', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'a', count: 25, percentage: 25 },
      { name: 'b', count: 25, percentage: 25 },
      { name: 'c', count: 25, percentage: 25 },
      { name: 'd', count: 25, percentage: 25 },
    ]

    const result = findUnderrepresented(distributions, 50)
    expect(result).toEqual([])
  })

  test('handles single category (never underrepresented)', () => {
    const distributions: CategoryDistribution[] = [{ name: 'only', count: 100, percentage: 100 }]

    const result = findUnderrepresented(distributions, 50)
    expect(result).toEqual([])
  })

  test('threshold affects sensitivity', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'large', count: 70, percentage: 70 },
      { name: 'small', count: 30, percentage: 30 },
    ]

    // Even = 50%, at 50% threshold: below 25% is underrepresented
    const strict = findUnderrepresented(distributions, 50)
    expect(strict).toEqual([])

    // At 80% threshold: below 40% is underrepresented
    const lenient = findUnderrepresented(distributions, 80)
    expect(lenient).toContain('small')
  })

  test('handles empty distributions', () => {
    const result = findUnderrepresented([], 50)
    expect(result).toEqual([])
  })
})

// ============================================================================
// generateSuggestions
// ============================================================================

describe('generateSuggestions', () => {
  test('suggests adding cases for underrepresented categories', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'math', count: 80, percentage: 80 },
      { name: 'code', count: 20, percentage: 20 },
    ]
    const underrepresented = ['code']

    const suggestions = generateSuggestions(distributions, underrepresented, 100)

    expect(suggestions.some((s) => s.includes('code'))).toBe(true)
    expect(suggestions.some((s) => s.toLowerCase().includes('add'))).toBe(true)
  })

  test('warns about dominant category (>50%)', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'dominant', count: 60, percentage: 60 },
      { name: 'other', count: 40, percentage: 40 },
    ]

    const suggestions = generateSuggestions(distributions, [], 100)

    expect(suggestions.some((s) => s.includes('dominant') && s.includes('60%'))).toBe(true)
    expect(suggestions.some((s) => s.toLowerCase().includes('diversify'))).toBe(true)
  })

  test('warns about tiny categories (<3 cases)', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'large', count: 97, percentage: 97 },
      { name: 'tiny', count: 2, percentage: 2 },
      { name: 'also_tiny', count: 1, percentage: 1 },
    ]

    const suggestions = generateSuggestions(distributions, [], 100)

    expect(suggestions.some((s) => s.includes('tiny') || s.includes('also_tiny'))).toBe(true)
    expect(suggestions.some((s) => s.includes('< 3 cases'))).toBe(true)
  })

  test('suggests expanding small test sets (<20 cases)', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'a', count: 5, percentage: 50 },
      { name: 'b', count: 5, percentage: 50 },
    ]

    const suggestions = generateSuggestions(distributions, [], 10)

    expect(suggestions.some((s) => s.includes('10 cases') && s.toLowerCase().includes('expand'))).toBe(true)
  })

  test('returns "well-balanced" when no issues found', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'a', count: 25, percentage: 25 },
      { name: 'b', count: 25, percentage: 25 },
      { name: 'c', count: 25, percentage: 25 },
      { name: 'd', count: 25, percentage: 25 },
    ]

    const suggestions = generateSuggestions(distributions, [], 100)

    expect(suggestions.some((s) => s.toLowerCase().includes('well-balanced'))).toBe(true)
  })

  test('combines multiple suggestions', () => {
    const distributions: CategoryDistribution[] = [
      { name: 'huge', count: 8, percentage: 80 },
      { name: 'tiny', count: 2, percentage: 20 },
    ]
    const underrepresented = ['tiny']

    const suggestions = generateSuggestions(distributions, underrepresented, 10)

    // Should have multiple suggestions: underrepresented, dominant, tiny count, small test set
    expect(suggestions.length).toBeGreaterThanOrEqual(2)
  })

  test('handles empty distributions', () => {
    const suggestions = generateSuggestions([], [], 0)

    // Should suggest expanding (0 cases)
    expect(suggestions.some((s) => s.includes('0 cases'))).toBe(true)
  })
})
