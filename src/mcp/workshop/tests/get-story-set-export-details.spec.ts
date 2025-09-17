import { test, expect } from 'bun:test'
import { getStorySetExportDetails } from '../get-story-set-export-details.js'

const getFixturePath = (filename: string) => Bun.resolveSync(`./fixtures/${filename}`, import.meta.dir)

test('getStorySetExportDetails: detects interaction vs snapshot stories', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const details = getStorySetExportDetails({ filePath })

  // Find specific stories
  const interactionStory = details.find((d) => d.name === 'interactionStory')
  const snapshotStory = details.find((d) => d.name === 'snapshotStory')
  const basicStory = details.find((d) => d.name === 'basicStory')

  // Check interaction story (has play function)
  expect(interactionStory).toBeDefined()
  expect(interactionStory?.type).toBe('interaction')
  expect(interactionStory?.hasPlay).toBe(true)
  expect(interactionStory?.hasTemplate).toBe(true)

  // Check snapshot story (no play function)
  expect(snapshotStory).toBeDefined()
  expect(snapshotStory?.type).toBe('snapshot')
  expect(snapshotStory?.hasPlay).toBe(false)
  expect(snapshotStory?.hasTemplate).toBe(true)
  expect(snapshotStory?.hasParameters).toBe(true)

  // Check basic story (no play function)
  expect(basicStory).toBeDefined()
  expect(basicStory?.type).toBe('snapshot')
  expect(basicStory?.hasPlay).toBe(false)
  expect(basicStory?.hasArgs).toBe(true)
  expect(basicStory?.hasTemplate).toBe(true)
})

test('getStorySetExportDetails: provides detailed property information', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const details = getStorySetExportDetails({ filePath })

  // All detected stories should have names
  details.forEach((detail) => {
    expect(detail.name).toBeDefined()
    expect(detail.name).not.toBe('')
  })

  // Check that type is properly set
  details.forEach((detail) => {
    expect(['interaction', 'snapshot', 'unknown']).toContain(detail.type)
  })

  // Check boolean properties are set
  details.forEach((detail) => {
    expect(typeof detail.hasPlay).toBe('boolean')
    expect(typeof detail.hasArgs).toBe('boolean')
    expect(typeof detail.hasTemplate).toBe('boolean')
    expect(typeof detail.hasParameters).toBe('boolean')
  })
})

test('getStorySetExportDetails: correctly identifies all StoryObj in mixed exports', () => {
  const filePath = getFixturePath('mixed-story-exports.tsx')
  const details = getStorySetExportDetails({ filePath })

  const firstStory = details.find((d) => d.name === 'firstStory')
  const secondStory = details.find((d) => d.name === 'secondStory')
  const thirdStory = details.find((d) => d.name === 'thirdStory')

  // First story - snapshot (no play)
  expect(firstStory).toBeDefined()
  expect(firstStory?.type).toBe('snapshot')
  expect(firstStory?.hasPlay).toBe(false)

  // Second story - interaction (has play)
  expect(secondStory).toBeDefined()
  expect(secondStory?.type).toBe('interaction')
  expect(secondStory?.hasPlay).toBe(true)

  // Third story - snapshot (no play)
  expect(thirdStory).toBeDefined()
  expect(thirdStory?.type).toBe('snapshot')
  expect(thirdStory?.hasPlay).toBe(false)
  expect(thirdStory?.hasParameters).toBe(true)

  // Should not include non-story exports
  const regularComponent = details.find((d) => d.name === 'regularComponent')
  expect(regularComponent).toBeUndefined()
})

test('getStorySetExportDetails: returns empty array for no stories', () => {
  const filePath = getFixturePath('no-stories.tsx')
  const details = getStorySetExportDetails({ filePath })

  expect(details).toEqual([])
})

test('getStorySetExportDetails: throws error for non-existent file', () => {
  const filePath = '/path/to/non-existent-file.tsx'
  
  // Should throw an error for non-existent files
  expect(() => getStorySetExportDetails({ filePath })).toThrow('Failed to load file:')
})

test('getStorySetExportDetails: handles default exports', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const details = getStorySetExportDetails({ filePath })

  const defaultExport = details.find((d) => d.name === 'default')
  expect(defaultExport).toBeDefined()
  expect(defaultExport?.type).toBe('snapshot')
  expect(defaultExport?.hasTemplate).toBe(true)
})

test('getStorySetExportDetails: can distinguish all stories typed as StoryObj', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const details = getStorySetExportDetails({ filePath })

  // Count interaction vs snapshot stories
  const interactionStories = details.filter((d) => d.type === 'interaction')
  const snapshotStories = details.filter((d) => d.type === 'snapshot')

  console.log('Story breakdown:')
  console.log(
    '- Interaction stories:',
    interactionStories.map((s) => s.name),
  )
  console.log(
    '- Snapshot stories:',
    snapshotStories.map((s) => s.name),
  )

  // We should have 1 interaction story and 4 snapshot stories
  expect(interactionStories).toHaveLength(1)
  expect(snapshotStories).toHaveLength(4)

  // The interaction story should be the one with play function
  expect(interactionStories[0].name).toBe('interactionStory')
})
