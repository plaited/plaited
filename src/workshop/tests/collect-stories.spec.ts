import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { discoverStoryMetadata, getStoryMetadata } from '../collect-stories.ts'
import type { StoryMetadata } from '../workshop.types.ts'

const FIXTURES_DIR = join(import.meta.dir, 'fixtures')
const STORIES_DIR = join(FIXTURES_DIR, 'stories')
const FILTERING_STORIES_DIR = join(STORIES_DIR, 'filtering')

test('discoverStoryMetadata: discovers and classifies stories correctly', async () => {
  const metadataMaps = await discoverStoryMetadata(STORIES_DIR, '**/filtering/**')
  // Flatten array of Maps to single array
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  // Should find 5 stories (filtering out default export and non-story exports)
  expect(metadata.length).toBe(5)

  // Each metadata object should have exactly 11 properties (added route and entryPath)
  for (const story of metadata) {
    const keys = Object.keys(story)
    expect(keys.length).toBe(11)
    expect(keys).toEqual([
      'route',
      'exportName',
      'filePath',
      'entryPath',
      'type',
      'hasPlay',
      'hasArgs',
      'hasTemplate',
      'hasParameters',
      'timeout',
      'flag',
    ])
  }

  // Sort by exportName for consistent testing
  const sorted = metadata.sort((a, b) => a.exportName.localeCompare(b.exportName))

  // Verify basicStory (snapshot with args and template)
  const mixedStoriesPath = join(STORIES_DIR, 'mixed-stories.stories.tsx')

  expect(sorted[0]).toMatchObject({
    exportName: 'basicStory',
    filePath: mixedStoriesPath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
    timeout: 5000,
    flag: undefined,
  })

  // Verify interactionStory (interaction with play)
  expect(sorted[2]).toMatchObject({
    exportName: 'interactionStory',
    filePath: mixedStoriesPath,
    type: 'interaction',
    hasPlay: true,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
    timeout: 5000,
    flag: undefined,
  })

  // Verify storyWithAllProps (snapshot with all properties)
  expect(sorted[3]).toMatchObject({
    exportName: 'storyWithAllProps',
    filePath: mixedStoriesPath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: true,
    timeout: 5000,
    flag: undefined,
  })
  // Verify storyWithParams (snapshot with parameters)
  expect(sorted[4]).toMatchObject({
    exportName: 'storyWithParams',
    filePath: mixedStoriesPath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: true,
    timeout: 10000,
    flag: undefined,
  })
})

test('discoverStoryMetadata: counts interaction vs snapshot stories correctly', async () => {
  const metadataMaps = await discoverStoryMetadata(STORIES_DIR, '**/filtering/**')
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  const interactionCount = metadata.filter((s) => s.type === 'interaction').length
  const snapshotCount = metadata.filter((s) => s.type === 'snapshot').length

  expect(interactionCount).toBe(2)
  expect(snapshotCount).toBe(3)
})

test('discoverStoryMetadata: filters out non-story exports', async () => {
  const metadataMaps = await discoverStoryMetadata(STORIES_DIR, '**/filtering/**')
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  // Should not include 'MyComponent', 'helperFunction', or default export
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('MyComponent')
  expect(exportNames).not.toContain('helperFunction')
  expect(exportNames).not.toContain('default')
})

test('discoverStoryMetadata: handles empty story files', async () => {
  const metadataMaps = await discoverStoryMetadata(STORIES_DIR, '**/filtering/**')
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  // The empty.stories.tsx file should contribute 0 stories
  const emptyFileStories = metadata.filter((s) => s.filePath.includes('empty.stories.tsx'))
  expect(emptyFileStories.length).toBe(0)
})

test('discoverStoryMetadata: returns empty array when no story files found', async () => {
  // Use a directory with no .stories.tsx files
  const tempDir = join(FIXTURES_DIR, 'entry-routes')
  const metadataMaps = await discoverStoryMetadata(tempDir)

  expect(Array.isArray(metadataMaps)).toBe(true)
  expect(metadataMaps.length).toBe(0)
})

test('discoverStoryMetadata: detects all property flags correctly', async () => {
  const metadataMaps = await discoverStoryMetadata(STORIES_DIR, '**/filtering/**')
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

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
  const metadataMap = await getStoryMetadata(STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // Should find 5 stories in the file
  expect(metadata.length).toBe(5)

  // All should have same filePath
  expect(metadata.every((s) => s.filePath === filePath)).toBe(true)

  // Export names should be present
  const exportNames = metadata.map((s) => s.exportName).sort()
  expect(exportNames).toEqual([
    'basicStory',
    'failingStory',
    'interactionStory',
    'storyWithAllProps',
    'storyWithParams',
  ])
})

test('getStoryMetadata: filters out default exports', async () => {
  const filePath = join(STORIES_DIR, 'mixed-stories.stories.tsx')
  const metadataMap = await getStoryMetadata(STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // Should not include default export
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('default')
})

test('getStoryMetadata: filters out non-story exports', async () => {
  const filePath = join(STORIES_DIR, 'mixed-stories.stories.tsx')
  const metadataMap = await getStoryMetadata(STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // Should not include helper functions or components
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('MyComponent')
  expect(exportNames).not.toContain('helperFunction')
})

test('getStoryMetadata: handles file with no story exports', async () => {
  const filePath = join(STORIES_DIR, 'empty.stories.tsx')
  const metadataMap = await getStoryMetadata(STORIES_DIR, filePath)

  expect(metadataMap instanceof Map).toBe(true)
  expect(metadataMap.size).toBe(0)
})

test('discoverStoryMetadata: discovers stories in nested directories', async () => {
  const metadataMaps = await discoverStoryMetadata(FIXTURES_DIR, '**/filtering/**')
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  // Should find stories from nested directories
  const nestedStories = metadata.filter((s) => s.filePath.includes('/nested/'))
  expect(nestedStories.length).toBeGreaterThan(0)

  // Check specific nested stories
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).toContain('nestedSnapshot')
  expect(exportNames).toContain('nestedInteraction')
})

test('discoverStoryMetadata: returns array of Maps', async () => {
  const metadataMaps = await discoverStoryMetadata(STORIES_DIR, '**/filtering/**')

  expect(Array.isArray(metadataMaps)).toBe(true)
  expect(metadataMaps.length).toBeGreaterThan(0)

  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  // Check structure of each metadata object
  metadata.forEach((item: StoryMetadata) => {
    expect(item).toHaveProperty('route')
    expect(item).toHaveProperty('exportName')
    expect(item).toHaveProperty('filePath')
    expect(item).toHaveProperty('entryPath')
    expect(item).toHaveProperty('type')
    expect(item).toHaveProperty('hasPlay')
    expect(item).toHaveProperty('hasArgs')
    expect(item).toHaveProperty('hasTemplate')
    expect(item).toHaveProperty('hasParameters')
    expect(item).toHaveProperty('flag')
    expect(typeof item.route).toBe('string')
    expect(typeof item.exportName).toBe('string')
    expect(typeof item.filePath).toBe('string')
    expect(typeof item.entryPath).toBe('string')
    expect(['interaction', 'snapshot']).toContain(item.type)
    expect(typeof item.hasPlay).toBe('boolean')
    expect(typeof item.hasArgs).toBe('boolean')
    expect(typeof item.hasTemplate).toBe('boolean')
    expect(typeof item.hasParameters).toBe('boolean')
    expect(['string', 'undefined']).toContain(typeof item.flag)
    expect(typeof item.flag).toBe('undefined')
  })
})

test('discoverStoryMetadata: all filePaths are absolute paths', async () => {
  const metadataMaps = await discoverStoryMetadata(STORIES_DIR, '**/filtering/**')
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  metadata.forEach((item) => {
    expect(item.filePath.startsWith('/')).toBe(true)
    expect(item.filePath).toContain(STORIES_DIR)
  })
})

test('discoverStoryMetadata: type matches hasPlay flag', async () => {
  const metadataMaps = await discoverStoryMetadata(STORIES_DIR, '**/filtering/**')
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  metadata.forEach((item) => {
    if (item.type === 'interaction') {
      expect(item.hasPlay).toBe(true)
    } else if (item.type === 'snapshot') {
      expect(item.hasPlay).toBe(false)
    }
  })
})

test('getStoryMetadata: filters stories with .only() flag', async () => {
  const filePath = join(FILTERING_STORIES_DIR, 'only-stories.stories.tsx')
  const metadataMap = await getStoryMetadata(FILTERING_STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // Should only return the story with .only() flag
  expect(metadata.length).toBe(1)
  expect(metadata[0]?.exportName).toBe('onlyStory')
  expect(metadata[0]?.flag).toBe('only')
})

test('getStoryMetadata: filters out stories with .skip() flag', async () => {
  const filePath = join(FILTERING_STORIES_DIR, 'skip-stories.stories.tsx')
  const metadataMap = await getStoryMetadata(FILTERING_STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // Should return only the active story (2 skipped, 1 active = 1 result)
  expect(metadata.length).toBe(1)
  expect(metadata[0]?.exportName).toBe('activeStory')
  expect(metadata[0]?.flag).toBe(undefined)
})

test('getStoryMetadata: returns all .only() stories when multiple exist', async () => {
  const filePath = join(FILTERING_STORIES_DIR, 'multiple-only-stories.stories.tsx')
  const metadataMap = await getStoryMetadata(FILTERING_STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // Should return both .only() stories (skipping regular and .skip() stories)
  expect(metadata.length).toBe(2)

  const exportNames = metadata.map((s) => s.exportName).sort()
  expect(exportNames).toEqual(['firstOnlyStory', 'secondOnlyStory'])

  metadata.forEach((story) => {
    expect(story.flag).toBe('only')
  })
})

test('getStoryMetadata: .only() takes precedence over .skip()', async () => {
  const filePath = join(FILTERING_STORIES_DIR, 'multiple-only-stories.stories.tsx')
  const metadataMap = await getStoryMetadata(FILTERING_STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // File has .only() stories and a .skip() story
  // .only() should take precedence, .skip() should be filtered out
  expect(metadata.length).toBe(2)
  expect(metadata.every((s) => s.flag === 'only')).toBe(true)

  // The skipped story should not be in results
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('skippedStory')
})

test('discoverStoryMetadata: discovers .only() stories from mixed files', async () => {
  const metadataMaps = await discoverStoryMetadata(FILTERING_STORIES_DIR)
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  // Check that .only() stories are present in discovery
  const onlyStories = metadata.filter((s) => s.flag === 'only')
  expect(onlyStories.length).toBeGreaterThan(0)

  const exportNames = onlyStories.map((s) => s.exportName)
  expect(exportNames).toContain('onlyStory')
})

test('discoverStoryMetadata: applies filtering per-file (not globally)', async () => {
  const metadataMaps = await discoverStoryMetadata(FILTERING_STORIES_DIR)
  const metadata = metadataMaps.flatMap((map) => [...map.values()])

  // Per-file filtering means each file applies .only()/.skip() independently
  // Result: Mix of stories with different flags from different files

  // Should have .only() stories from files that have .only()
  const onlyStories = metadata.filter((s) => s.flag === 'only')
  expect(onlyStories.length).toBeGreaterThan(0)

  // Should have regular stories (no flag) from files without .only() but with .skip()
  const regularStories = metadata.filter((s) => !s.flag)
  expect(regularStories.length).toBeGreaterThan(0)

  // Should NOT have any .skip() stories (filtered out per-file)
  const skippedStories = metadata.filter((s) => s.flag === 'skip')
  expect(skippedStories.length).toBe(0)
})

test('filterStoryMetadata: returns only stories when .only() flag exists', async () => {
  const filePath = join(FILTERING_STORIES_DIR, 'only-stories.stories.tsx')
  const metadataMap = await getStoryMetadata(FILTERING_STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // Metadata should already be filtered
  expect(metadata.length).toBe(1)
  expect(metadata[0]?.flag).toBe('only')
})

test('filterStoryMetadata: filters out .skip() stories when no .only() exists', async () => {
  const filePath = join(FILTERING_STORIES_DIR, 'skip-stories.stories.tsx')
  const metadataMap = await getStoryMetadata(FILTERING_STORIES_DIR, filePath)
  const metadata = [...metadataMap.values()]

  // Should only have the active story
  expect(metadata.length).toBe(1)
  expect(metadata[0]?.flag).toBe(undefined)

  // Skipped stories should not be present
  const exportNames = metadata.map((s) => s.exportName)
  expect(exportNames).not.toContain('skippedStory')
  expect(exportNames).not.toContain('anotherSkippedStory')
})
