import { test, expect } from 'bun:test'
import { getStorySetMetadata } from '../get-story-set-metadata.js'

const getFixturePath = (filename: string) => Bun.resolveSync(`./fixtures/${filename}`, import.meta.dir)

test('getStorySetMetadata: detects interaction vs snapshot stories', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const metadata = getStorySetMetadata(filePath)

  expect(metadata).toBeDefined()
  expect(Array.isArray(metadata)).toBe(true)

  // Test exact structured content for each story
  const interactionStory = metadata.find((d) => d.exportName === 'interactionStory')
  expect(interactionStory).toEqual({
    exportName: 'interactionStory',
    filePath,
    type: 'interaction',
    hasPlay: true,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  })

  const snapshotStory = metadata.find((d) => d.exportName === 'snapshotStory')
  expect(snapshotStory).toEqual({
    exportName: 'snapshotStory',
    filePath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: true,
  })

  const basicStory = metadata.find((d) => d.exportName === 'basicStory')
  expect(basicStory).toEqual({
    exportName: 'basicStory',
    filePath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  })

  const typedStory = metadata.find((d) => d.exportName === 'typedStory')
  expect(typedStory).toEqual({
    exportName: 'typedStory',
    filePath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  })

  // Verify default export is NOT included
  const defaultStory = metadata.find((d) => d.exportName === 'default')
  expect(defaultStory).toBeUndefined()

  // Verify the complete metadata array has exact content
  expect(metadata).toEqual([
    {
      exportName: 'basicStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      exportName: 'interactionStory',
      filePath,
      type: 'interaction',
      hasPlay: true,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      exportName: 'snapshotStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: true,
    },
    {
      exportName: 'typedStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: false,
    },
  ])
})

test('getStorySetMetadata: correctly identifies all StoryObj in mixed exports', () => {
  const filePath = getFixturePath('mixed-story-exports.tsx')
  const metadata = getStorySetMetadata(filePath)

  // Test exact structured content for mixed exports
  expect(metadata).toHaveLength(3)

  const firstStory = metadata.find((d) => d.exportName === 'firstStory')
  expect(firstStory).toEqual({
    exportName: 'firstStory',
    filePath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  })

  const secondStory = metadata.find((d) => d.exportName === 'secondStory')
  expect(secondStory).toEqual({
    exportName: 'secondStory',
    filePath,
    type: 'interaction',
    hasPlay: true,
    hasArgs: false,
    hasTemplate: false,
    hasParameters: false,
  })

  const thirdStory = metadata.find((d) => d.exportName === 'thirdStory')
  expect(thirdStory).toEqual({
    exportName: 'thirdStory',
    filePath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: true,
  })

  // Verify complete metadata array exact content
  expect(metadata).toEqual([
    {
      exportName: 'firstStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      exportName: 'secondStory',
      filePath,
      type: 'interaction',
      hasPlay: true,
      hasArgs: false,
      hasTemplate: false,
      hasParameters: false,
    },
    {
      exportName: 'thirdStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: true,
    },
  ])

  // Verify non-story exports are filtered out
  const regularComponent = metadata.find((d) => d.exportName === 'regularComponent')
  expect(regularComponent).toBeUndefined()

  const notAStory = metadata.find((d) => d.exportName === 'notAStory')
  expect(notAStory).toBeUndefined()

  const utilityFunction = metadata.find((d) => d.exportName === 'utilityFunction')
  expect(utilityFunction).toBeUndefined()

  const implicitStory = metadata.find((d) => d.exportName === 'implicitStory')
  expect(implicitStory).toBeUndefined()
})

test('getStorySetMetadata: returns empty array for no stories', () => {
  const filePath = getFixturePath('no-stories.tsx')
  const metadata = getStorySetMetadata(filePath)

  // Test exact empty array
  expect(metadata).toEqual([])
  expect(metadata).toHaveLength(0)
})

test('getStorySetMetadata: handles error for non-existent file', () => {
  const filePath = '/path/to/non-existent-file.tsx'

  // getStorySetMetadata throws on error
  expect(() => getStorySetMetadata(filePath)).toThrow()
})

test('getStorySetMetadata: validates exact metadata properties', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const metadata = getStorySetMetadata(filePath)

  // Validate exact structure of all metadata entries
  metadata.forEach((story) => {
    // Every story must have these exact properties
    expect(Object.keys(story).sort()).toEqual([
      'exportName',
      'filePath',
      'hasArgs',
      'hasParameters',
      'hasPlay',
      'hasTemplate',
      'type',
    ])

    // Type validation
    expect(typeof story.exportName).toBe('string')
    expect(['interaction', 'snapshot', 'unknown']).toContain(story.type)
    expect(typeof story.hasPlay).toBe('boolean')
    expect(typeof story.hasArgs).toBe('boolean')
    expect(typeof story.hasTemplate).toBe('boolean')
    expect(typeof story.hasParameters).toBe('boolean')
  })

  // Verify exact metadata for all stories
  expect(metadata[0]).toEqual({
    exportName: 'basicStory',
    filePath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  })

  expect(metadata[1]).toEqual({
    exportName: 'interactionStory',
    filePath,
    type: 'interaction',
    hasPlay: true,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  })

  expect(metadata[2]).toEqual({
    exportName: 'snapshotStory',
    filePath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: true,
  })

  expect(metadata[3]).toEqual({
    exportName: 'typedStory',
    filePath,
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  })

  // Verify default export is NOT included
  expect(metadata).toHaveLength(4)
  expect(metadata.find((d) => d.exportName === 'default')).toBeUndefined()
})

test('getStorySetMetadata: exact story count and type breakdown', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const metadata = getStorySetMetadata(filePath)

  // Exact counts
  expect(metadata).toHaveLength(4)

  const interactionStories = metadata.filter((d) => d.type === 'interaction')
  const snapshotStories = metadata.filter((d) => d.type === 'snapshot')
  const unknownStories = metadata.filter((d) => d.type === 'unknown')

  expect(interactionStories).toHaveLength(1)
  expect(snapshotStories).toHaveLength(3)
  expect(unknownStories).toHaveLength(0)

  // Verify default export is NOT included
  expect(metadata.find((d) => d.exportName === 'default')).toBeUndefined()

  // Exact story objects for each type
  expect(interactionStories).toEqual([
    {
      exportName: 'interactionStory',
      filePath,
      type: 'interaction',
      hasPlay: true,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
  ])

  expect(snapshotStories).toEqual([
    {
      exportName: 'basicStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      exportName: 'snapshotStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: true,
    },
    {
      exportName: 'typedStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: false,
    },
  ])
})

test('getStorySetMetadata: verifies complete structured response format', () => {
  const filePath = getFixturePath('mixed-story-exports.tsx')
  const metadata = getStorySetMetadata(filePath)

  // Test the metadata structure
  expect(metadata).toBeDefined()
  expect(Array.isArray(metadata)).toBe(true)

  // Verify exact metadata
  expect(metadata).toEqual([
    {
      exportName: 'firstStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      exportName: 'secondStory',
      filePath,
      type: 'interaction',
      hasPlay: true,
      hasArgs: false,
      hasTemplate: false,
      hasParameters: false,
    },
    {
      exportName: 'thirdStory',
      filePath,
      type: 'snapshot',
      hasPlay: false,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: true,
    },
  ])
})
