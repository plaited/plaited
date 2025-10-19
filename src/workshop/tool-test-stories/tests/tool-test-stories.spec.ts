import { test, expect, beforeAll, afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { StoryMetadata } from '../../workshop.schemas.js'
import type { TestResult } from '../tool-test-stories.schemas.js'

let client: Client

const getFixturePath = (filename: string) =>
  Bun.resolveSync(`../../get-test-server/tests/fixtures/${filename}`, import.meta.dir)

// Increase timeout for these tests since they involve Playwright
const TEST_TIMEOUT = 30000 // 30 seconds

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

test('test-stories tool is available', async () => {
  const tools = await client.listTools()
  const tool = tools.tools.find((t) => t.name === 'test-stories')

  expect(tool).toBeDefined()
  expect(tool?.title).toBe('Test stories')
  expect(tool?.description).toBe(
    'Runs automated tests on multiple story components using Playwright, evaluating them in the specified color scheme and returning detailed pass/fail results',
  )
})

test(
  'test-stories: runs single passing snapshot story',
  async () => {
    const filePath = getFixturePath('simple-story.stories.tsx')

    const result = await client.callTool({
      name: 'test-stories',
      arguments: {
        storiesMetaData: [
          {
            exportName: 'basicStory',
            filePath,
            type: 'snapshot',
            hasPlay: false,
            hasArgs: true,
            hasTemplate: true,
            hasParameters: false,
          } satisfies StoryMetadata,
        ],
        colorSchemeSupport: false,
        hostName: 'http://localhost:3456',
      },
    })

    expect(result.isError).toBeUndefined()

    const structuredContent = result.structuredContent as { passed: TestResult[]; failed: TestResult[] }
    expect(structuredContent).toBeDefined()
    expect(structuredContent.passed).toBeDefined()
    expect(structuredContent.failed).toBeDefined()

    // Should have one passed test
    expect(structuredContent.passed).toHaveLength(1)
    expect(structuredContent.failed).toHaveLength(0)

    // Verify the passed test structure
    const passedTest = structuredContent.passed[0]
    expect(passedTest).toBeDefined()
    expect(passedTest.meta).toBeDefined()
    expect(passedTest.meta.exportName).toBe('basicStory')
    expect(passedTest.meta.filePath).toContain('simple-story.stories.tsx')
    expect(passedTest.meta.colorScheme).toBe('light')
    expect(passedTest.meta.url).toContain('simple-story--basic-story')
  },
  TEST_TIMEOUT,
)

test(
  'test-stories: runs single interaction story with play function',
  async () => {
    const filePath = getFixturePath('interaction-story.stories.tsx')

    const result = await client.callTool({
      name: 'test-stories',
      arguments: {
        storiesMetaData: [
          {
            exportName: 'clickTest',
            filePath,
            type: 'interaction',
            hasPlay: true,
            hasArgs: false,
            hasTemplate: true,
            hasParameters: false,
          } satisfies StoryMetadata,
        ],
        colorSchemeSupport: false,
        hostName: 'http://localhost:3456',
      },
    })

    expect(result.isError).toBeUndefined()

    const structuredContent = result.structuredContent as { passed: TestResult[]; failed: TestResult[] }

    // Should have one passed test (the play function assertions pass)
    expect(structuredContent.passed).toHaveLength(1)
    expect(structuredContent.failed).toHaveLength(0)

    const passedTest = structuredContent.passed[0]
    expect(passedTest.meta.exportName).toBe('clickTest')
    expect(passedTest.meta.colorScheme).toBe('light')
  },
  TEST_TIMEOUT,
)

test(
  'test-stories: runs multiple stories from same file',
  async () => {
    const filePath = getFixturePath('multi-story.stories.tsx')

    const result = await client.callTool({
      name: 'test-stories',
      arguments: {
        storiesMetaData: [
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
            hasTemplate: true,
            hasParameters: false,
          },
          {
            exportName: 'thirdStory',
            filePath,
            type: 'snapshot',
            hasPlay: false,
            hasArgs: true,
            hasTemplate: true,
            hasParameters: false,
          },
        ] satisfies StoryMetadata[],
        colorSchemeSupport: false,
        hostName: 'http://localhost:3456',
      },
    })

    expect(result.isError).toBeUndefined()

    const structuredContent = result.structuredContent as { passed: TestResult[]; failed: TestResult[] }

    // All three stories should pass
    expect(structuredContent.passed).toHaveLength(3)
    expect(structuredContent.failed).toHaveLength(0)

    // Verify each story is in the results
    const exportNames = structuredContent.passed.map((test) => test.meta.exportName)
    expect(exportNames).toContain('firstStory')
    expect(exportNames).toContain('secondStory')
    expect(exportNames).toContain('thirdStory')
  },
  TEST_TIMEOUT,
)

test(
  'test-stories: runs with color scheme support (doubles test runs)',
  async () => {
    const filePath = getFixturePath('simple-story.stories.tsx')

    const result = await client.callTool({
      name: 'test-stories',
      arguments: {
        storiesMetaData: [
          {
            exportName: 'basicStory',
            filePath,
            type: 'snapshot',
            hasPlay: false,
            hasArgs: true,
            hasTemplate: true,
            hasParameters: false,
          } satisfies StoryMetadata,
        ],
        colorSchemeSupport: true, // This should run in both light and dark modes
        hostName: 'http://localhost:3456',
      },
    })

    expect(result.isError).toBeUndefined()

    const structuredContent = result.structuredContent as { passed: TestResult[]; failed: TestResult[] }

    // Should have TWO passed tests (one for light, one for dark)
    expect(structuredContent.passed).toHaveLength(2)
    expect(structuredContent.failed).toHaveLength(0)

    // Verify we have both color schemes
    const colorSchemes = structuredContent.passed.map((test) => test.meta.colorScheme)
    expect(colorSchemes).toContain('light')
    expect(colorSchemes).toContain('dark')
  },
  TEST_TIMEOUT,
)

test(
  'test-stories: verifies complete structured response format',
  async () => {
    const filePath = getFixturePath('simple-story.stories.tsx')

    const result = await client.callTool({
      name: 'test-stories',
      arguments: {
        storiesMetaData: [
          {
            exportName: 'basicStory',
            filePath,
            type: 'snapshot',
            hasPlay: false,
            hasArgs: true,
            hasTemplate: true,
            hasParameters: false,
          } satisfies StoryMetadata,
        ],
        colorSchemeSupport: false,
        hostName: 'http://localhost:3456',
      },
    })

    // Test the complete response structure
    expect(result).toHaveProperty('content')
    expect(result).toHaveProperty('structuredContent')
    expect(result.isError).toBeUndefined()

    const structuredContent = result.structuredContent as { passed: TestResult[]; failed: TestResult[] }
    expect(structuredContent).toHaveProperty('passed')
    expect(structuredContent).toHaveProperty('failed')
    expect(Array.isArray(structuredContent.passed)).toBe(true)
    expect(Array.isArray(structuredContent.failed)).toBe(true)

    // Content should be array with single text element
    const content = result.content as Array<{ type: string; text: string }>
    expect(Array.isArray(content)).toBe(true)
    expect(content).toHaveLength(1)
    expect(content?.[0]).toHaveProperty('type', 'text')
    expect(content?.[0]).toHaveProperty('text')

    // Content text should be valid JSON matching structured content
    const parsedContent = JSON.parse(content?.[0]?.text || '{}')
    expect(parsedContent).toEqual(structuredContent)
  },
  TEST_TIMEOUT,
)

test(
  'test-stories: validates test result metadata structure',
  async () => {
    const filePath = getFixturePath('simple-story.stories.tsx')

    const result = await client.callTool({
      name: 'test-stories',
      arguments: {
        storiesMetaData: [
          {
            exportName: 'basicStory',
            filePath,
            type: 'snapshot',
            hasPlay: false,
            hasArgs: true,
            hasTemplate: true,
            hasParameters: false,
          } satisfies StoryMetadata,
        ],
        colorSchemeSupport: false,
        hostName: 'http://localhost:3456',
      },
    })

    const structuredContent = result.structuredContent as { passed: TestResult[]; failed: TestResult[] }
    const testResult = structuredContent.passed[0]

    // Verify exact structure of test result
    expect(testResult).toHaveProperty('detail')
    expect(testResult).toHaveProperty('meta')

    // Verify meta properties
    expect(testResult.meta).toHaveProperty('url')
    expect(testResult.meta).toHaveProperty('filePath')
    expect(testResult.meta).toHaveProperty('exportName')
    expect(testResult.meta).toHaveProperty('colorScheme')

    // Verify types
    expect(typeof testResult.meta.url).toBe('string')
    expect(typeof testResult.meta.filePath).toBe('string')
    expect(typeof testResult.meta.exportName).toBe('string')
    expect(['light', 'dark']).toContain(testResult.meta.colorScheme)

    // Verify filePath starts with ./ (relative path)
    expect(testResult.meta.filePath).toMatch(/^\.\//)
  },
  TEST_TIMEOUT,
)
