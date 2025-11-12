import { test, expect } from 'bun:test'
import path from 'path'
import { discoverStoryMetadata } from '../discover-story-metadata.js'
import type { StoryMetadata } from '../workshop.types.js'

const FIXTURES_DIR = path.resolve(import.meta.dir, './fixtures/stories')

test('discoverStoryMetadata: should discover and classify stories correctly', async () => {
  const metadata = await discoverStoryMetadata(FIXTURES_DIR)

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
  const mixedStoriesPath = path.resolve(import.meta.dir, './fixtures/stories/mixed-stories.stories.tsx')

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

test('discoverStoryMetadata: should count interaction vs snapshot stories correctly', async () => {
  const metadata = await discoverStoryMetadata(FIXTURES_DIR)

  const interactionCount = metadata.filter((s) => s.type === 'interaction').length
  const snapshotCount = metadata.filter((s) => s.type === 'snapshot').length

  expect(interactionCount).toBe(1)
  expect(snapshotCount).toBe(3)
})

test('discoverStoryMetadata: should filter out non-story exports', async () => {
  const metadata = await discoverStoryMetadata(FIXTURES_DIR)

  // Should not include 'MyComponent', 'helperFunction', or default export
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('MyComponent')
  expect(exportNames).not.toContain('helperFunction')
  expect(exportNames).not.toContain('default')
})

test('discoverStoryMetadata: should handle empty story files', async () => {
  const metadata = await discoverStoryMetadata(FIXTURES_DIR)

  // The empty.stories.tsx file should contribute 0 stories
  const emptyFileStories = metadata.filter((s) => s.filePath.includes('empty.stories.tsx'))
  expect(emptyFileStories.length).toBe(0)
})

test('discoverStoryMetadata: should throw error for non-existent directory', async () => {
  const nonExistentPath = '/non/existent/path'

  try {
    await discoverStoryMetadata(nonExistentPath)
    expect(true).toBe(false) // Should not reach here
  } catch (error) {
    expect(error).toBeDefined()
  }
})

test('discoverStoryMetadata: should return empty array when no story files found', async () => {
  // Use a directory with no .stories.tsx files
  const tempDir = path.resolve(import.meta.dir, './fixtures/entry-routes')
  const metadata = await discoverStoryMetadata(tempDir)

  expect(Array.isArray(metadata)).toBe(true)
  expect(metadata.length).toBe(0)
})

test('discoverStoryMetadata: should detect all property flags correctly', async () => {
  const metadata = await discoverStoryMetadata(FIXTURES_DIR)

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
