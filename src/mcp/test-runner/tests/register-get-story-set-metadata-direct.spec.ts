import { test, expect } from 'bun:test'
import { getMcpServer } from '../../get-mcp-server.js'
import { registerGetStorySetMetadata, getStorySetExportDetails } from '../register-get-story-set-metadata.js'
import type { StoryMetadata } from '../test-runner.schemas.js'

const getFixturePath = (filename: string) => 
  Bun.resolveSync(`./fixtures/${filename}`, import.meta.dir)

test('registerGetStorySetMetadata registers tool correctly', () => {
  const server = getMcpServer()
  
  // Register the tool - should not throw on first registration
  expect(() => registerGetStorySetMetadata(server)).not.toThrow()
  
  // Attempting to register again should throw (tool already registered)
  expect(() => registerGetStorySetMetadata(server)).toThrow('Tool get-story-set-metadata is already registered')
})

test('getStorySetExportDetails: detects interaction vs snapshot stories', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const metadata = getStorySetExportDetails(filePath)
  
  // Find specific stories
  const interactionStory = metadata.find((d: StoryMetadata) => d.name === 'interactionStory')
  const snapshotStory = metadata.find((d: StoryMetadata) => d.name === 'snapshotStory')
  const basicStory = metadata.find((d: StoryMetadata) => d.name === 'basicStory')
  
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
  
  // Check basic story
  expect(basicStory).toBeDefined()
  expect(basicStory?.type).toBe('snapshot')
  expect(basicStory?.hasPlay).toBe(false)
  expect(basicStory?.hasArgs).toBe(true)
  expect(basicStory?.hasTemplate).toBe(true)
})

test('getStorySetExportDetails: correctly identifies all StoryObj in mixed exports', () => {
  const filePath = getFixturePath('mixed-story-exports.tsx')
  const metadata = getStorySetExportDetails(filePath)
  
  const firstStory = metadata.find((d: StoryMetadata) => d.name === 'firstStory')
  const secondStory = metadata.find((d: StoryMetadata) => d.name === 'secondStory')
  const thirdStory = metadata.find((d: StoryMetadata) => d.name === 'thirdStory')
  
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
  const regularComponent = metadata.find((d: StoryMetadata) => d.name === 'regularComponent')
  expect(regularComponent).toBeUndefined()
})

test('getStorySetExportDetails: returns empty array for no stories', () => {
  const filePath = getFixturePath('no-stories.tsx')
  const metadata = getStorySetExportDetails(filePath)
  
  expect(metadata).toEqual([])
})

test('getStorySetExportDetails: throws error for non-existent file', () => {
  const filePath = '/path/to/non-existent-file.tsx'
  
  expect(() => getStorySetExportDetails(filePath)).toThrow('Failed to load file:')
})

test('getStorySetExportDetails: handles default exports', () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const metadata = getStorySetExportDetails(filePath)
  
  const defaultExport = metadata.find((d: StoryMetadata) => d.name === 'default')
  expect(defaultExport).toBeDefined()
  expect(defaultExport?.type).toBe('snapshot')
  expect(defaultExport?.hasTemplate).toBe(true)
})