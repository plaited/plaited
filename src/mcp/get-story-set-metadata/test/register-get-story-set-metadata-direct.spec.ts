import { test, expect, beforeAll, afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { getMcpServer } from '../../get-mcp-server.js'
import { registerGetStorySetMetadata } from '../register-get-story-set-metadata.js'
import type { StoryMetadata } from '../get-story-set-metadata.schemas.js'

let client: Client

beforeAll(async () => {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: [Bun.resolveSync('./fixtures/test-mcp-server.ts', import.meta.dir)],
  })

  client = new Client({
    name: 'test-client',
    version: '0.0.0',
  })

  await client.connect(transport)
})

afterAll(async () => {
  await client.close()
})

const getFixturePath = (filename: string) => Bun.resolveSync(`./fixtures/${filename}`, import.meta.dir)

test('registerGetStorySetMetadata registers tool correctly', () => {
  const server = getMcpServer()

  // Register the tool - should not throw on first registration
  expect(() => registerGetStorySetMetadata(server)).not.toThrow()

  // Attempting to register again should throw (tool already registered)
  expect(() => registerGetStorySetMetadata(server)).toThrow('Tool get-story-set-metadata is already registered')
})

test('get-story-set-metadata tool is available', async () => {
  const tools = await client.listTools()
  const tool = tools.tools.find((t) => t.name === 'get-story-set-metadata')

  expect(tool).toBeDefined()
  expect(tool?.title).toBe('Get story set metadata')
  expect(tool?.description).toBe('Performs an AST parse of a .stories.tsx file to grab metadata for exported stories')
})

test('get-story-set-metadata: detects interaction vs snapshot stories', async () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const result = await client.callTool({
    name: 'get-story-set-metadata',
    arguments: { filePath },
  })

  const structuredContent = result.structuredContent as { metadata: StoryMetadata[] }
  expect(structuredContent).toBeDefined()
  expect(structuredContent.metadata).toBeDefined()

  const { metadata } = structuredContent

  // Test exact structured content for each story
  const interactionStory = metadata.find((d) => d.name === 'interactionStory')
  expect(interactionStory).toEqual({
    name: 'interactionStory',
    type: 'interaction',
    hasPlay: true,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  })

  const snapshotStory = metadata.find((d) => d.name === 'snapshotStory')
  expect(snapshotStory).toEqual({
    name: 'snapshotStory',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: true,
  })

  const basicStory = metadata.find((d) => d.name === 'basicStory')
  expect(basicStory).toEqual({
    name: 'basicStory',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  })

  const typedStory = metadata.find((d) => d.name === 'typedStory')
  expect(typedStory).toEqual({
    name: 'typedStory',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  })

  const defaultStory = metadata.find((d) => d.name === 'default')
  expect(defaultStory).toEqual({
    name: 'default',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  })

  // Verify the complete metadata array has exact content
  expect(metadata).toEqual([
    {
      name: 'basicStory',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      name: 'interactionStory',
      type: 'interaction',
      hasPlay: true,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      name: 'snapshotStory',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: true,
    },
    {
      name: 'typedStory',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      name: 'default',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
  ])

  // Verify content matches structured content
  const content = result.content as Array<{ type: string; text: string }>
  expect(content).toBeDefined()
  expect(content?.[0]?.type).toBe('text')
  const parsedContent = JSON.parse(content?.[0]?.text || '[]')
  expect(parsedContent).toEqual(metadata)
})

test('get-story-set-metadata: correctly identifies all StoryObj in mixed exports', async () => {
  const filePath = getFixturePath('mixed-story-exports.tsx')
  const result = await client.callTool({
    name: 'get-story-set-metadata',
    arguments: { filePath },
  })

  const structuredContent = result.structuredContent as { metadata: StoryMetadata[] }
  const { metadata } = structuredContent

  // Test exact structured content for mixed exports
  expect(metadata).toHaveLength(3)

  const firstStory = metadata.find((d) => d.name === 'firstStory')
  expect(firstStory).toEqual({
    name: 'firstStory',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  })

  const secondStory = metadata.find((d) => d.name === 'secondStory')
  expect(secondStory).toEqual({
    name: 'secondStory',
    type: 'interaction',
    hasPlay: true,
    hasArgs: false,
    hasTemplate: false,
    hasParameters: false,
  })

  const thirdStory = metadata.find((d) => d.name === 'thirdStory')
  expect(thirdStory).toEqual({
    name: 'thirdStory',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: true,
  })

  // Verify complete metadata array exact content
  expect(metadata).toEqual([
    {
      name: 'firstStory',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      name: 'secondStory',
      type: 'interaction',
      hasPlay: true,
      hasArgs: false,
      hasTemplate: false,
      hasParameters: false,
    },
    {
      name: 'thirdStory',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: true,
    },
  ])

  // Verify non-story exports are filtered out
  const regularComponent = metadata.find((d) => d.name === 'regularComponent')
  expect(regularComponent).toBeUndefined()

  const notAStory = metadata.find((d) => d.name === 'notAStory')
  expect(notAStory).toBeUndefined()

  const utilityFunction = metadata.find((d) => d.name === 'utilityFunction')
  expect(utilityFunction).toBeUndefined()

  const implicitStory = metadata.find((d) => d.name === 'implicitStory')
  expect(implicitStory).toBeUndefined()
})

test('get-story-set-metadata: returns empty array for no stories', async () => {
  const filePath = getFixturePath('no-stories.tsx')
  const result = await client.callTool({
    name: 'get-story-set-metadata',
    arguments: { filePath },
  })

  const structuredContent = result.structuredContent as { metadata: StoryMetadata[] }
  const { metadata } = structuredContent

  // Test exact empty array
  expect(metadata).toEqual([])
  expect(metadata).toHaveLength(0)

  // Verify content is also empty array
  const content = result.content as Array<{ type: string; text: string }>
  const parsedContent = JSON.parse(content?.[0]?.text || '[]')
  expect(parsedContent).toEqual([])
})

test('get-story-set-metadata: handles error for non-existent file', async () => {
  const filePath = '/path/to/non-existent-file.tsx'
  const result = await client.callTool({
    name: 'get-story-set-metadata',
    arguments: { filePath },
  })

  // Error responses should have isError flag
  expect(result.isError).toBe(true)

  // Should not have structured content on error
  expect(result.structuredContent).toBeUndefined()

  // Error message in content
  const content = result.content as Array<{ type: string; text: string }>
  expect(content).toBeDefined()
  expect(content?.[0]?.type).toBe('text')
  expect(content?.[0]?.text).toContain('Error:')
  expect(content?.[0]?.text).toContain('Failed to load file:')
})

test('get-story-set-metadata: validates exact metadata properties', async () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const result = await client.callTool({
    name: 'get-story-set-metadata',
    arguments: { filePath },
  })

  const structuredContent = result.structuredContent as { metadata: StoryMetadata[] }
  const { metadata } = structuredContent

  // Validate exact structure of all metadata entries
  metadata.forEach((story) => {
    // Every story must have these exact properties
    expect(Object.keys(story).sort()).toEqual(['hasArgs', 'hasParameters', 'hasPlay', 'hasTemplate', 'name', 'type'])

    // Type validation
    expect(typeof story.name).toBe('string')
    expect(['interaction', 'snapshot', 'unknown']).toContain(story.type)
    expect(typeof story.hasPlay).toBe('boolean')
    expect(typeof story.hasArgs).toBe('boolean')
    expect(typeof story.hasTemplate).toBe('boolean')
    expect(typeof story.hasParameters).toBe('boolean')
  })

  // Verify exact metadata for all stories
  expect(metadata[0]).toEqual({
    name: 'basicStory',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  })

  expect(metadata[1]).toEqual({
    name: 'interactionStory',
    type: 'interaction',
    hasPlay: true,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  })

  expect(metadata[2]).toEqual({
    name: 'snapshotStory',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: true,
  })

  expect(metadata[3]).toEqual({
    name: 'typedStory',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: true,
    hasTemplate: true,
    hasParameters: false,
  })

  expect(metadata[4]).toEqual({
    name: 'default',
    type: 'snapshot',
    hasPlay: false,
    hasArgs: false,
    hasTemplate: true,
    hasParameters: false,
  })
})

test('get-story-set-metadata: exact story count and type breakdown', async () => {
  const filePath = getFixturePath('story-exports.stories.tsx')
  const result = await client.callTool({
    name: 'get-story-set-metadata',
    arguments: { filePath },
  })

  const structuredContent = result.structuredContent as { metadata: StoryMetadata[] }
  const { metadata } = structuredContent

  // Exact counts
  expect(metadata).toHaveLength(5)

  const interactionStories = metadata.filter((d) => d.type === 'interaction')
  const snapshotStories = metadata.filter((d) => d.type === 'snapshot')
  const unknownStories = metadata.filter((d) => d.type === 'unknown')

  expect(interactionStories).toHaveLength(1)
  expect(snapshotStories).toHaveLength(4)
  expect(unknownStories).toHaveLength(0)

  // Exact story objects for each type
  expect(interactionStories).toEqual([
    {
      name: 'interactionStory',
      type: 'interaction',
      hasPlay: true,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
  ])

  expect(snapshotStories).toEqual([
    {
      name: 'basicStory',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      name: 'snapshotStory',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: true,
    },
    {
      name: 'typedStory',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: true,
      hasTemplate: true,
      hasParameters: false,
    },
    {
      name: 'default',
      type: 'snapshot',
      hasPlay: false,
      hasArgs: false,
      hasTemplate: true,
      hasParameters: false,
    },
  ])
})

test('get-story-set-metadata: verifies complete structured response format', async () => {
  const filePath = getFixturePath('mixed-story-exports.tsx')
  const result = await client.callTool({
    name: 'get-story-set-metadata',
    arguments: { filePath },
  })

  // Test the complete response structure
  expect(result).toHaveProperty('content')
  expect(result).toHaveProperty('structuredContent')
  expect(result.isError).toBeUndefined()

  const structuredContent = result.structuredContent as { metadata: StoryMetadata[] }
  expect(structuredContent).toHaveProperty('metadata')
  expect(Array.isArray(structuredContent.metadata)).toBe(true)

  // Verify exact structured content
  expect(structuredContent).toEqual({
    metadata: [
      {
        name: 'firstStory',
        type: 'snapshot',
        hasPlay: false,
        hasArgs: false,
        hasTemplate: true,
        hasParameters: false,
      },
      {
        name: 'secondStory',
        type: 'interaction',
        hasPlay: true,
        hasArgs: false,
        hasTemplate: false,
        hasParameters: false,
      },
      {
        name: 'thirdStory',
        type: 'snapshot',
        hasPlay: false,
        hasArgs: false,
        hasTemplate: true,
        hasParameters: true,
      },
    ],
  })

  // Content should be array with single text element
  const content = result.content as Array<{ type: string; text: string }>
  expect(Array.isArray(content)).toBe(true)
  expect(content).toHaveLength(1)
  expect(content?.[0]).toHaveProperty('type', 'text')
  expect(content?.[0]).toHaveProperty('text')

  // Content text should be valid JSON matching structured content
  const parsedContent = JSON.parse(content?.[0]?.text || '[]')
  expect(parsedContent).toEqual(structuredContent.metadata)
})
