import { describe, expect, test } from 'bun:test'
import type { StoryResult } from '../agent.types.ts'
import type { StoryInfo } from '../generate-trajectories.ts'
import { createPatternRegistry } from '../pattern-registry.ts'

describe('createPatternRegistry', () => {
  const passingResult: StoryResult = {
    passed: true,
    totalAssertions: 5,
    passedAssertions: 5,
    a11yPassed: true,
    errors: [],
  }

  const failingResult: StoryResult = {
    passed: false,
    totalAssertions: 5,
    passedAssertions: 3,
    a11yPassed: true,
    errors: ['Assertion failed'],
  }

  const a11yFailResult: StoryResult = {
    passed: true,
    totalAssertions: 5,
    passedAssertions: 5,
    a11yPassed: false,
    errors: [],
  }

  test('creates empty registry', () => {
    const registry = createPatternRegistry()
    expect(registry.all()).toHaveLength(0)
  })

  test('indexes passing story as pattern', () => {
    const registry = createPatternRegistry()
    const story: StoryInfo = {
      exportName: 'PrimaryButton',
      filePath: 'src/templates/button.stories.tsx',
    }

    const pattern = registry.index(story, passingResult)

    expect(pattern).toBeDefined()
    expect(pattern!.id).toBe('src/templates/button.stories.tsx:PrimaryButton')
    expect(pattern!.intent).toBe('Create a primary button')
    expect(pattern!.templatePath).toBe('src/templates/button.tsx')
    expect(pattern!.templateExport).toBe('PrimaryButton')
  })

  test('rejects story with failing assertions', () => {
    const registry = createPatternRegistry()
    const story: StoryInfo = {
      exportName: 'BrokenButton',
      filePath: 'button.stories.tsx',
    }

    const pattern = registry.index(story, failingResult)
    expect(pattern).toBeUndefined()
  })

  test('rejects story with failing a11y when required', () => {
    const registry = createPatternRegistry({ requireA11y: true })
    const story: StoryInfo = {
      exportName: 'InaccessibleButton',
      filePath: 'button.stories.tsx',
    }

    const pattern = registry.index(story, a11yFailResult)
    expect(pattern).toBeUndefined()
  })

  test('allows a11y failure when not required', () => {
    const registry = createPatternRegistry({ requireA11y: false })
    const story: StoryInfo = {
      exportName: 'Button',
      filePath: 'button.stories.tsx',
    }

    const pattern = registry.index(story, a11yFailResult)
    expect(pattern).toBeDefined()
  })

  test('uses custom assertion ratio threshold', () => {
    const registry = createPatternRegistry({ minAssertionRatio: 0.6 })
    const story: StoryInfo = {
      exportName: 'PartialButton',
      filePath: 'button.stories.tsx',
    }

    // 3/5 = 0.6, should pass
    const pattern = registry.index(story, failingResult)
    expect(pattern).toBeDefined()
  })
})

describe('pattern search', () => {
  const passingResult: StoryResult = {
    passed: true,
    totalAssertions: 1,
    passedAssertions: 1,
    a11yPassed: true,
    errors: [],
  }

  test('finds patterns by intent keywords', () => {
    const registry = createPatternRegistry()

    registry.index({ exportName: 'PrimaryButton', filePath: 'button.stories.tsx' }, passingResult)
    registry.index({ exportName: 'SecondaryButton', filePath: 'button.stories.tsx' }, passingResult)
    registry.index({ exportName: 'DataTable', filePath: 'table.stories.tsx' }, passingResult)

    const matches = registry.search('button')

    expect(matches).toHaveLength(2)
    expect(matches[0]!.pattern.storyExport).toContain('Button')
  })

  test('ranks by relevance score', () => {
    const registry = createPatternRegistry()

    // "Create a primary button" has both "primary" and "button"
    registry.index({ exportName: 'PrimaryButton', filePath: 'button.stories.tsx' }, passingResult)
    // "Create a icon button" only has "button", not "primary"
    registry.index({ exportName: 'IconButton', filePath: 'icon-button.stories.tsx' }, passingResult)

    const matches = registry.search('primary button')

    // PrimaryButton should rank higher because it matches both words
    expect(matches).toHaveLength(2)
    expect(matches[0]!.pattern.storyExport).toBe('PrimaryButton')
    expect(matches[0]!.score).toBeGreaterThan(matches[1]!.score)
  })

  test('respects minimum score threshold', () => {
    const registry = createPatternRegistry()

    registry.index({ exportName: 'PrimaryButton', filePath: 'button.stories.tsx' }, passingResult)

    const matches = registry.search('completely unrelated query', { minScore: 0.5 })
    expect(matches).toHaveLength(0)
  })

  test('respects limit option', () => {
    const registry = createPatternRegistry()

    // Use PascalCase names that produce "Create a primary button" style intents
    registry.index({ exportName: 'PrimaryButton', filePath: 'a.stories.tsx' }, passingResult)
    registry.index({ exportName: 'SecondaryButton', filePath: 'b.stories.tsx' }, passingResult)
    registry.index({ exportName: 'TertiaryButton', filePath: 'c.stories.tsx' }, passingResult)

    const matches = registry.search('button', { limit: 2 })
    expect(matches).toHaveLength(2)
  })
})

describe('pattern tags', () => {
  const passingResult: StoryResult = {
    passed: true,
    totalAssertions: 1,
    passedAssertions: 1,
    a11yPassed: true,
    errors: [],
  }

  test('extracts tags from file path', () => {
    const registry = createPatternRegistry()

    const pattern = registry.index(
      { exportName: 'PrimaryButton', filePath: 'src/templates/button.stories.tsx' },
      passingResult,
    )

    expect(pattern!.tags).toContain('templates')
    expect(pattern!.tags).toContain('button')
  })

  test('filters by tag', () => {
    const registry = createPatternRegistry()

    registry.index({ exportName: 'Button', filePath: 'src/templates/button.stories.tsx' }, passingResult)
    registry.index({ exportName: 'Input', filePath: 'src/forms/input.stories.tsx' }, passingResult)

    const templates = registry.getByTag('templates')
    expect(templates).toHaveLength(1)
    expect(templates[0]!.storyExport).toBe('Button')
  })

  test('gets tag counts', () => {
    const registry = createPatternRegistry()

    registry.index({ exportName: 'Button1', filePath: 'templates/button.stories.tsx' }, passingResult)
    registry.index({ exportName: 'Button2', filePath: 'templates/icon-button.stories.tsx' }, passingResult)
    registry.index({ exportName: 'Input', filePath: 'forms/input.stories.tsx' }, passingResult)

    const tags = registry.tags()
    expect(tags.get('templates')).toBe(2)
    expect(tags.get('forms')).toBe(1)
  })
})

describe('pattern management', () => {
  const passingResult: StoryResult = {
    passed: true,
    totalAssertions: 1,
    passedAssertions: 1,
    a11yPassed: true,
    errors: [],
  }

  test('removes pattern by ID', () => {
    const registry = createPatternRegistry()

    registry.index({ exportName: 'Button', filePath: 'button.stories.tsx' }, passingResult)

    const removed = registry.remove('button.stories.tsx:Button')
    expect(removed).toBe(true)
    expect(registry.all()).toHaveLength(0)
  })

  test('returns false when removing nonexistent pattern', () => {
    const registry = createPatternRegistry()
    const removed = registry.remove('nonexistent')
    expect(removed).toBe(false)
  })

  test('clears all patterns', () => {
    const registry = createPatternRegistry()

    registry.index({ exportName: 'Button1', filePath: 'a.stories.tsx' }, passingResult)
    registry.index({ exportName: 'Button2', filePath: 'b.stories.tsx' }, passingResult)

    registry.clear()
    expect(registry.all()).toHaveLength(0)
  })

  test('restores patterns from data', () => {
    const registry = createPatternRegistry()

    registry.index({ exportName: 'Button', filePath: 'button.stories.tsx' }, passingResult)

    const data = registry.all()
    registry.clear()

    registry.restore(data)
    expect(registry.all()).toHaveLength(1)
    expect(registry.search('button')).toHaveLength(1)
  })

  test('gets statistics', () => {
    const registry = createPatternRegistry({ minAssertionRatio: 0.5 })

    registry.index(
      { exportName: 'Button1', filePath: 'a.stories.tsx' },
      { passed: true, totalAssertions: 2, passedAssertions: 2, a11yPassed: true, errors: [] },
    )
    registry.index(
      { exportName: 'Button2', filePath: 'b.stories.tsx' },
      { passed: true, totalAssertions: 2, passedAssertions: 1, a11yPassed: true, errors: [] },
    )

    const stats = registry.stats()
    expect(stats.totalPatterns).toBe(2)
    expect(stats.avgAssertionRatio).toBe(0.75) // (1 + 0.5) / 2
    expect(stats.a11yPassRate).toBe(1)
  })
})
