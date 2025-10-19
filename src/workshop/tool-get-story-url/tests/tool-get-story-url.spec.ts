import { test, expect, beforeAll, afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { getMcpServer } from '../../mcp.js'
import { toolGetStoryUrl } from '../tool-get-story-url.js'

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

test('toolGetStoryUrl registers tool correctly', () => {
  const server = getMcpServer()
  const domain = 'http://localhost:3000/'

  // Register the tool - should not throw on first registration
  expect(() => toolGetStoryUrl(server, domain)).not.toThrow()

  // Attempting to register again should throw (tool already registered)
  expect(() => toolGetStoryUrl(server, domain)).toThrow('Tool get-story-url is already registered')
})

test('get-story-url tool is available', async () => {
  const tools = await client.listTools()
  const tool = tools.tools.find((t) => t.name === 'get-story-url')

  expect(tool).toBeDefined()
  expect(tool?.title).toBe('Get story path')
  expect(tool?.description).toBe('get the url for the story exportName from the story set file passed to tool input')
})

test('get-story-url: generates URL for simple path', async () => {
  const result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'button.stories.tsx',
      exportName: 'primaryButton',
    },
  })

  const structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toBeDefined()
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./button--primary-button',
  })

  // Verify content matches structured content
  const content = result.content as Array<{ type: string; text: string }>
  expect(content).toBeDefined()
  expect(content).toHaveLength(1)
  expect(content?.[0]?.type).toBe('text')
  expect(content?.[0]?.text).toBe('http://localhost:3000/./button--primary-button')
})

test('get-story-url: generates URLs for nested paths', async () => {
  // Test 1-level nesting
  let result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'components/button.stories.tsx',
      exportName: 'defaultButton',
    },
  })

  let structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/components/button--default-button',
  })

  // Test 2-level nesting
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'components/forms/input.stories.tsx',
      exportName: 'textInput',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/components/forms/input--text-input',
  })

  // Test another 2-level nesting
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'ui/modals/dialog.stories.tsx',
      exportName: 'confirmDialog',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/ui/modals/dialog--confirm-dialog',
  })
})

test('get-story-url: generates URLs for deeply nested paths', async () => {
  // Test 3-level nesting
  let result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'src/components/atoms/button.stories.tsx',
      exportName: 'iconButton',
    },
  })

  let structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/src/components/atoms/button--icon-button',
  })

  // Test another 3-level nesting
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'src/features/user/profile.stories.tsx',
      exportName: 'userAvatar',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/src/features/user/profile--user-avatar',
  })

  // Test 4-level nesting
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'src/components/molecules/forms/field.stories.tsx',
      exportName: 'validationError',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/src/components/molecules/forms/field--validation-error',
  })
})

test('get-story-url: correctly converts names to kebab-case', async () => {
  // Test PascalCase
  let result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'MyComponent.stories.tsx',
      exportName: 'MyStoryName',
    },
  })

  let structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./my-component--my-story-name',
  })

  // Test camelCase
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'userProfile.stories.tsx',
      exportName: 'defaultProfile',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./user-profile--default-profile',
  })

  // Test complex naming
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'VeryLongComponentName.stories.tsx',
      exportName: 'SomeComplexUIComponent',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./very-long-component-name--some-complex-u-i-component',
  })

  // Test with numbers
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'Button2.stories.tsx',
      exportName: 'button123Test',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./button2--button123-test',
  })
})

test('get-story-url: handles story names from fixture examples', async () => {
  // Test basicStory
  let result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'story-exports.stories.tsx',
      exportName: 'basicStory',
    },
  })

  let structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./story-exports--basic-story',
  })

  // Test interactionStory
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'story-exports.stories.tsx',
      exportName: 'interactionStory',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./story-exports--interaction-story',
  })

  // Test snapshotStory
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'story-exports.stories.tsx',
      exportName: 'snapshotStory',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./story-exports--snapshot-story',
  })

  // Test typedStory
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'story-exports.stories.tsx',
      exportName: 'typedStory',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/./story-exports--typed-story',
  })
})

test('get-story-url: handles different file extensions', async () => {
  // Test with .stories.ts
  let result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'components/button.stories.ts',
      exportName: 'primary',
    },
  })

  let structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/components/button--primary',
  })

  // File extensions should be stripped
  result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'components/form.stories.tsx',
      exportName: 'default',
    },
  })

  structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/components/form--default',
  })
})

test('get-story-url: verifies complete structured response format', async () => {
  const result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: 'src/components/Button.stories.tsx',
      exportName: 'PrimaryButton',
    },
  })

  // Test the complete response structure
  expect(result).toHaveProperty('content')
  expect(result).toHaveProperty('structuredContent')
  expect(result.isError).toBeUndefined()

  const structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toHaveProperty('url')
  expect(typeof structuredContent.url).toBe('string')

  // Verify exact structured content
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000/src/components/button--primary-button',
  })

  // Content should be array with single text element
  const content = result.content as Array<{ type: string; text: string }>
  expect(Array.isArray(content)).toBe(true)
  expect(content).toHaveLength(1)
  expect(content?.[0]).toHaveProperty('type', 'text')
  expect(content?.[0]).toHaveProperty('text')

  // Content text should match the URL
  expect(content?.[0]?.text).toBe(structuredContent.url)
})

test('get-story-url: handles multiple stories from same file', async () => {
  const stories = [
    { exportName: 'primary', expectedSuffix: 'primary' },
    { exportName: 'secondary', expectedSuffix: 'secondary' },
    { exportName: 'disabled', expectedSuffix: 'disabled' },
    { exportName: 'withIcon', expectedSuffix: 'with-icon' },
    { exportName: 'loading', expectedSuffix: 'loading' },
  ]

  for (const story of stories) {
    const result = await client.callTool({
      name: 'get-story-url',
      arguments: {
        filePath: 'components/button.stories.tsx',
        exportName: story.exportName,
      },
    })

    const structuredContent = result.structuredContent as { url: string }
    expect(structuredContent).toEqual({
      url: `http://localhost:3000/components/button--${story.expectedSuffix}`,
    })
  }
})

test('get-story-url: handles absolute paths correctly', async () => {
  // Test that absolute paths are handled correctly
  const result = await client.callTool({
    name: 'get-story-url',
    arguments: {
      filePath: '/src/components/atoms/button.stories.tsx',
      exportName: 'primary',
    },
  })

  const structuredContent = result.structuredContent as { url: string }
  expect(structuredContent).toEqual({
    url: 'http://localhost:3000//src/components/atoms/button--primary',
  })

  // Verify content
  const content = result.content as Array<{ type: string; text: string }>
  expect(content?.[0]?.text).toBe(structuredContent.url)
})
