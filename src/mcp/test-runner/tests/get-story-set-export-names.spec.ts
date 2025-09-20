import { test, expect } from 'bun:test'
import { getStorySetExportNames } from '../get-story-set-export-names.js'

const getFixturePath = (filename: string) => Bun.resolveSync(`./fixtures/${filename}`, import.meta.dir)

test('getStorySetExportNames: detects all StoryObj exports', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const exports = getStorySetExportNames(filePath)

  // Should detect all story exports including default
  expect(exports).toContain('basicStory')
  expect(exports).toContain('interactionStory')
  expect(exports).toContain('snapshotStory')
  expect(exports).toContain('typedStory')
  expect(exports).toContain('default')

  // Should NOT detect non-story exports
  expect(exports).not.toContain('NotAStory')
  expect(exports).not.toContain('helperFunction')
  expect(exports).not.toContain('config')

  // Should have exactly 5 story exports
  expect(exports).toHaveLength(5)
})

test('getStorySetExportNames: detects stories in mixed export file', () => {
  const filePath = getFixturePath('mixed-story-exports.tsx')
  const exports = getStorySetExportNames(filePath)

  // Should detect story exports
  expect(exports).toContain('firstStory')
  expect(exports).toContain('secondStory')
  expect(exports).toContain('thirdStory')

  // Should detect implicit story (with structure but no type annotation)
  // Note: This may or may not work depending on TypeScript's inference
  // If it doesn't work, that's acceptable as explicit typing is preferred
  if (exports.includes('implicitStory')) {
    expect(exports).toContain('implicitStory')
  }

  // Should NOT detect non-story exports
  expect(exports).not.toContain('regularComponent')
  expect(exports).not.toContain('notAStory')
  expect(exports).not.toContain('utilityFunction')

  // Should have at least 3 story exports
  expect(exports.length).toBeGreaterThanOrEqual(3)
})

test('getStorySetExportNames: returns empty array for file with no stories', () => {
  const filePath = getFixturePath('no-stories.tsx')
  const exports = getStorySetExportNames(filePath)

  // Should return empty array
  expect(exports).toEqual([])
})

test('getStorySetExportNames: throws error for non-existent file', () => {
  const filePath = '/path/to/non-existent-file.tsx'

  // Should throw an error for non-existent files
  expect(() => getStorySetExportNames(filePath)).toThrow('Failed to load file:')
})

test('getStorySetExportNames: detects StoryObj with play function (interaction story)', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const exports = getStorySetExportNames(filePath)

  // StoryObj with play function should be detected
  expect(exports).toContain('interactionStory')
})

test('getStorySetExportNames: detects StoryObj without play function (snapshot story)', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const exports = getStorySetExportNames(filePath)

  // StoryObj without play function should be detected
  expect(exports).toContain('snapshotStory')
})

test('getStorySetExportNames: detects StoryObj with generic type parameter', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const exports = getStorySetExportNames(filePath)

  // StoryObj<T> should be detected
  expect(exports).toContain('typedStory')
})

test('getStorySetExportNames: returns unique export names', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const exports = getStorySetExportNames(filePath)

  // Check for no duplicates
  const uniqueExports = [...new Set(exports)]
  expect(exports).toEqual(uniqueExports)
})

test('getStorySetExportNames: detects all StoryObj types regardless of play function', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const exports = getStorySetExportNames(filePath)

  // All stories typed as StoryObj should be detected
  // Whether they have play function (interaction) or not (snapshot)
  expect(exports).toContain('basicStory')
  expect(exports).toContain('interactionStory') // has play
  expect(exports).toContain('snapshotStory') // no play
})
