import { test, expect } from 'bun:test'
import { join } from 'node:path'
import { discoverStoryMetadata, getStoryMetadata } from '../collect-stories.js'
import type { StoryMetadata } from '../workshop.types.js'

const FIXTURES_DIR = join(import.meta.dir, 'fixtures')
const STORIES_DIR = join(FIXTURES_DIR, 'stories')

test('discoverStoryMetadata: discovers and classifies stories correctly', async () => {
  const metadata = await discoverStoryMetadata(STORIES_DIR)

  // Should find 4 stories (filtering out default export and non-story exports)
  expect(metadata.length).toBe(4)

  // Each metadata object should have exactly 7 properties
  for (const story of metadata) {
    const keys = Object.keys(story)
    expect(keys.length).toBe(7)
    expect(keys).toEqual(['exportName', 'filePath', 'type', 'hasPlay', 'hasArgs', 'hasTemplate', 'hasParameters'])
  }

  // Sort by exportName for consistent testing
  const sorted = metadata.sort((a, b) => a.exportName.localeCompare(b.exportName))

  // Verify basicStory (snapshot with args and template)
  const mixedStoriesPath = join(STORIES_DIR, 'mixed-stories.stories.tsx')

  expect(sorted[0]).toEqual({
    exportName: 'basicStory',
    filePath: mixedStoriesPath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  } satisfies StoryMetadata)

  // Verify interactionStory (interaction with play)
  expect(sorted[1]).toEqual({
    exportName: 'interactionStory',
    filePath: mixedStoriesPath,
    type: 'interaction',
    hasPlay: true,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  } satisfies StoryMetadata)

  // Verify storyWithAllProps (snapshot with all properties)
  expect(sorted[2]).toEqual({
    exportName: 'storyWithAllProps',
    filePath: mixedStoriesPath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: true,
  } satisfies StoryMetadata)

  // Verify storyWithParams (snapshot with parameters)
  expect(sorted[3]).toEqual({
    exportName: 'storyWithParams',
    filePath: mixedStoriesPath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: true,
  } satisfies StoryMetadata)
})

test('discoverStoryMetadata: counts interaction vs snapshot stories correctly', async () => {
  const metadata = await discoverStoryMetadata(STORIES_DIR)

  const interactionCount = metadata.filter((s) => s.type === 'interaction').length
  const snapshotCount = metadata.filter((s) => s.type === 'snapshot').length

  expect(interactionCount).toBe(1)
  expect(snapshotCount).toBe(3)
})

test('discoverStoryMetadata: filters out non-story exports', async () => {
  const metadata = await discoverStoryMetadata(STORIES_DIR)

  // Should not include 'MyComponent', 'helperFunction', or default export
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('MyComponent')
  expect(exportNames).not.toContain('helperFunction')
  expect(exportNames).not.toContain('default')
})

test('discoverStoryMetadata: handles empty story files', async () => {
  const metadata = await discoverStoryMetadata(STORIES_DIR)

  // The empty.stories.tsx file should contribute 0 stories
  const emptyFileStories = metadata.filter((s) => s.filePath.includes('empty.stories.tsx'))
  expect(emptyFileStories.length).toBe(0)
})

test('discoverStoryMetadata: returns empty array when no story files found', async () => {
  // Use a directory with no .stories.tsx files
  const tempDir = join(FIXTURES_DIR, 'entry-routes')
  const metadata = await discoverStoryMetadata(tempDir)

  expect(Array.isArray(metadata)).toBe(true)
  expect(metadata.length).toBe(0)
})

test('discoverStoryMetadata: detects all property flags correctly', async () => {
  const metadata = await discoverStoryMetadata(STORIES_DIR)

  // Find the story with all properties
  const allPropsStory = metadata.find((s) => s.exportName === 'storyWithAllProps')
  expect(allPropsStory).toBeDefined()
  expect(allPropsStory?.hasArgs).toBe(true)
  expect(allPropsStory?.hasTemplate).toBe(true)
  expect(allPropsStory?.hasParameters).toBe(true)

  // Find the basic story (only args and template)
  const basicStory = metadata.find((s) => s.exportName === 'basicStory')
  expect(basicStory).toBeDefined()
  expect(basicStory?.hasArgs).toBe(true)
  expect(basicStory?.hasTemplate).toBe(true)
  expect(basicStory?.hasParameters).toBe(false)

  // Find the interaction story (only template and play)
  const interactionStory = metadata.find((s) => s.exportName === 'interactionStory')
  expect(interactionStory).toBeDefined()
  expect(interactionStory?.hasPlay).toBe(true)
  expect(interactionStory?.hasTemplate).toBe(true)
  expect(interactionStory?.hasArgs).toBe(false)
  expect(interactionStory?.hasParameters).toBe(false)
})

test('getStoryMetadata: extracts stories from single file', async () => {
  const filePath = join(STORIES_DIR, 'mixed-stories.stories.tsx')
  const metadata = await getStoryMetadata(filePath)

  // Should find 4 stories in the file
  expect(metadata.length).toBe(4)

  // All should have same filePath
  expect(metadata.every((s) => s.filePath === filePath)).toBe(true)

  // Export names should be present
  const exportNames = metadata.map((s) => s.exportName).sort()
  expect(exportNames).toEqual(['basicStory', 'interactionStory', 'storyWithAllProps', 'storyWithParams'])
})

test('getStoryMetadata: filters out default exports', async () => {
  const filePath = join(STORIES_DIR, 'mixed-stories.stories.tsx')
  const metadata = await getStoryMetadata(filePath)

  // Should not include default export
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('default')
})

test('getStoryMetadata: filters out non-story exports', async () => {
  const filePath = join(STORIES_DIR, 'mixed-stories.stories.tsx')
  const metadata = await getStoryMetadata(filePath)

  // Should not include helper functions or components
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('MyComponent')
  expect(exportNames).not.toContain('helperFunction')
})

test('getStoryMetadata: handles file with no story exports', async () => {
  const filePath = join(STORIES_DIR, 'empty.stories.tsx')
  const metadata = await getStoryMetadata(filePath)

  expect(Array.isArray(metadata)).toBe(true)
  expect(metadata.length).toBe(0)
})

test('discoverStoryMetadata: discovers stories in nested directories', async () => {
  const metadata = await discoverStoryMetadata(FIXTURES_DIR)

  // Should find stories from nested directories
  const nestedStories = metadata.filter((s) => s.filePath.includes('/nested/'))
  expect(nestedStories.length).toBeGreaterThan(0)

  // Check specific nested stories
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).toContain('nestedSnapshot')
  expect(exportNames).toContain('nestedInteraction')
})

test('discoverStoryMetadata: returns array of StoryMetadata objects', async () => {
  const metadata = await discoverStoryMetadata(STORIES_DIR)

  expect(Array.isArray(metadata)).toBe(true)
  expect(metadata.length).toBeGreaterThan(0)

  // Check structure of each metadata object
  metadata.forEach((item: StoryMetadata) => {
    expect(item).toHaveProperty('exportName')
    expect(item).toHaveProperty('filePath')
    expect(item).toHaveProperty('type')
    expect(item).toHaveProperty('hasPlay')
    expect(item).toHaveProperty('hasArgs')
    expect(item).toHaveProperty('hasTemplate')
    expect(item).toHaveProperty('hasParameters')
    expect(typeof item.exportName).toBe('string')
    expect(typeof item.filePath).toBe('string')
    expect(['interaction', 'snapshot']).toContain(item.type)
    expect(typeof item.hasPlay).toBe('boolean')
    expect(typeof item.hasArgs).toBe('boolean')
    expect(typeof item.hasTemplate).toBe('boolean')
    expect(typeof item.hasParameters).toBe('boolean')
  })
})

test('discoverStoryMetadata: all filePaths are absolute paths', async () => {
  const metadata = await discoverStoryMetadata(STORIES_DIR)

  metadata.forEach((item) => {
    expect(item.filePath.startsWith('/')).toBe(true)
    expect(item.filePath).toContain(STORIES_DIR)
  })
})

test('discoverStoryMetadata: type matches hasPlay flag', async () => {
  const metadata = await discoverStoryMetadata(STORIES_DIR)

  metadata.forEach((item) => {
    if (item.type === 'interaction') {
      expect(item.hasPlay).toBe(true)
    } else if (item.type === 'snapshot') {
      expect(item.hasPlay).toBe(false)
    }
  })
})
