import { test, expect, beforeAll, afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { getMcpServer } from '../../get-mcp-server.js'
import { registerGetStorySetPaths } from '../register-get-story-set-paths.js'

let client: Client

const testProjectPath = '/Users/eirby/Workspace/plaited/src/mcp/get-file-paths/test/fixtures/test-project'

beforeAll(async () => {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: [Bun.resolveSync('./fixtures/test-mcp-server.ts', import.meta.dir)],
    env: {
      ...process.env,
      TEST_CWD: testProjectPath,
    },
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

test('registerGetStorySetPaths registers tool correctly', () => {
  const server = getMcpServer()
  const cwd = '/test/path'

  // Register the tool - should not throw on first registration
  expect(() => registerGetStorySetPaths(server, cwd)).not.toThrow()

  // Attempting to register again should throw (tool already registered)
  expect(() => registerGetStorySetPaths(server, cwd)).toThrow('Tool get-story-set-paths is already registered')
})

test('get-story-set-paths tool is available with correct metadata', async () => {
  const tools = await client.listTools()
  const tool = tools.tools.find((t) => t.name === 'get-story-set-paths')

  expect(tool).toBeDefined()
  expect(tool?.title).toBe('Get Story Set Paths')
  expect(tool?.description).toBe(
    'Retrieves all Plaited story set files (*.stories.tsx) from the codebase for component testing and documentation',
  )
})

test('get-story-set-paths: finds all story files in test project', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: {},
  })

  expect(result.isError).toBeUndefined()

  const structuredContent = result.structuredContent as { files: string[] }
  expect(structuredContent).toBeDefined()
  expect(structuredContent).toHaveProperty('files')
  expect(Array.isArray(structuredContent.files)).toBe(true)

  // Should find our test story files
  const files = structuredContent.files
  expect(files.length).toBe(2)

  // Check that the paths contain our test story files
  const storyFiles = files.map((f) => f.replace(testProjectPath, ''))
  expect(storyFiles).toContain('/Button.stories.tsx')
  expect(storyFiles).toContain('/components/Card.stories.tsx')
})

test('get-story-set-paths: returns correct structured response format', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: {},
  })

  // Test the complete response structure
  expect(result).toHaveProperty('content')
  expect(result).toHaveProperty('structuredContent')
  expect(result.isError).toBeUndefined()

  const structuredContent = result.structuredContent as { files: string[] }
  expect(structuredContent).toHaveProperty('files')
  expect(Array.isArray(structuredContent.files)).toBe(true)

  // Verify exact content in structuredContent
  const expectedFiles = [`${testProjectPath}/Button.stories.tsx`, `${testProjectPath}/components/Card.stories.tsx`]
  expect(structuredContent.files).toHaveLength(2)
  expect(structuredContent.files.sort()).toEqual(expectedFiles.sort())

  // Content should be array with single text element
  const content = result.content as Array<{ type: string; text: string }>
  expect(Array.isArray(content)).toBe(true)
  expect(content).toHaveLength(1)
  expect(content?.[0]).toHaveProperty('type', 'text')
  expect(content?.[0]).toHaveProperty('text')

  // Content text should be JSON stringified files
  const parsedContent = JSON.parse(content?.[0]?.text || '[]')
  expect(parsedContent).toEqual(structuredContent.files)
})

test('get-story-set-paths: filters only *.stories.tsx files', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: {},
  })

  const structuredContent = result.structuredContent as { files: string[] }
  const files = structuredContent.files

  // All files should end with .stories.tsx
  files.forEach((file) => {
    expect(file).toMatch(/\.stories\.tsx$/)
  })

  // Should NOT include regular .tsx files
  const fileNames = files.map((f) => f.replace(testProjectPath, ''))
  expect(fileNames).not.toContain('/Button.tsx')
  expect(fileNames).not.toContain('/components/Card.tsx')
  expect(fileNames).not.toContain('/utils/helpers.tsx')
})

test('get-story-set-paths: returns absolute paths', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: {},
  })

  const structuredContent = result.structuredContent as { files: string[] }
  const files = structuredContent.files

  // All paths should be absolute (start with /)
  files.forEach((file) => {
    expect(file).toMatch(/^\//)
    expect(file).toContain(testProjectPath)
  })
})

test('get-story-set-paths: maintains consistent ordering', async () => {
  // Call the tool multiple times to ensure consistent ordering
  const results = []
  for (let i = 0; i < 3; i++) {
    const result = await client.callTool({
      name: 'get-story-set-paths',
      arguments: {},
    })
    const structuredContent = result.structuredContent as { files: string[] }
    results.push(structuredContent.files)
  }

  // All results should be identical
  expect(results[0]).toEqual(results[1])
  expect(results[1]).toEqual(results[2])
})

test('get-story-set-paths: filters by subdirectory when dir is provided', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: { dir: 'components' },
  })

  // Debug: log the result if there's an error
  if (result.isError) {
    console.log('Error result:', result.content)
  }

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  
  // Should only find story files in components directory
  expect(structuredContent.files).toHaveLength(1)
  expect(structuredContent.files[0]).toContain('/components/Card.stories.tsx')
  
  // Should NOT include story files from root
  const fileNames = structuredContent.files.map((f) => f.replace(testProjectPath, ''))
  expect(fileNames).not.toContain('/Button.stories.tsx')
})

test('get-story-set-paths: handles current directory reference', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: { dir: '.' },
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  
  // Should behave same as no dir parameter
  expect(structuredContent.files).toHaveLength(2)
})

test('get-story-set-paths: handles empty string as dir', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: { dir: '' },
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  
  // Should behave same as no dir parameter
  expect(structuredContent.files).toHaveLength(2)
})

test('get-story-set-paths: throws error for parent directory traversal', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: { dir: '../' },
  })

  expect(result.isError).toBe(true)
  const content = result.content as Array<{ type: string; text: string }>
  expect(content[0].text).toContain('Directory "../" must be within the project root')
})

test('get-story-set-paths: throws error for absolute path outside project', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: { dir: '/tmp/malicious' },
  })

  expect(result.isError).toBe(true)
  const content = result.content as Array<{ type: string; text: string }>
  expect(content[0].text).toContain('Directory "/tmp/malicious" must be within the project root')
})

test('get-story-set-paths: throws error for path traversal attempts', async () => {
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: { dir: '../../outside' },
  })

  expect(result.isError).toBe(true)
  const content = result.content as Array<{ type: string; text: string }>
  expect(content[0].text).toContain('Directory "../../outside" must be within the project root')
})

test('get-story-set-paths: handles nested subdirectories', async () => {
  // This test would work if we had nested dirs with story files
  // For now, test that it doesn't error on valid nested path
  const result = await client.callTool({
    name: 'get-story-set-paths',
    arguments: { dir: 'components' },
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  expect(Array.isArray(structuredContent.files)).toBe(true)
})
