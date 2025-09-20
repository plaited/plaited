import { test, expect, beforeAll, afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { getMcpServer } from '../../get-mcp-server.js'
import { registerGetTemplatePaths } from '../register-get-template-paths.js'

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

test('registerGetTemplatePaths registers tool correctly', () => {
  const server = getMcpServer()
  const cwd = '/test/path'

  // Register the tool - should not throw on first registration
  expect(() => registerGetTemplatePaths(server, cwd)).not.toThrow()

  // Attempting to register again should throw (tool already registered)
  expect(() => registerGetTemplatePaths(server, cwd)).toThrow('Tool get-template-paths is already registered')
})

test('get-template-paths tool is available with correct metadata', async () => {
  const tools = await client.listTools()
  const tool = tools.tools.find((t) => t.name === 'get-template-paths')

  expect(tool).toBeDefined()
  expect(tool?.title).toBe('Get Template Paths')
  expect(tool?.description).toBe(
    'Retrieves all TypeScript JSX template files (*.tsx) excluding story files (*.stories.tsx) for Plaited behavioral and functional templates',
  )
})

test('get-template-paths: finds all template files excluding stories', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: {},
  })

  expect(result.isError).toBeUndefined()

  const structuredContent = result.structuredContent as { files: string[] }
  expect(structuredContent).toBeDefined()
  expect(structuredContent).toHaveProperty('files')
  expect(Array.isArray(structuredContent.files)).toBe(true)

  // Should find our test template files
  const files = structuredContent.files
  expect(files.length).toBe(4) // Button.tsx, Card.tsx, helpers.tsx, OnlyTemplate.tsx

  // Check that the paths contain our template files
  const templateFiles = files.map((f) => f.replace(testProjectPath, ''))
  expect(templateFiles).toContain('/Button.tsx')
  expect(templateFiles).toContain('/components/Card.tsx')
  expect(templateFiles).toContain('/utils/helpers.tsx')
  expect(templateFiles).toContain('/templates-only/OnlyTemplate.tsx')

  // Should NOT contain story files
  expect(templateFiles).not.toContain('/Button.stories.tsx')
  expect(templateFiles).not.toContain('/components/Card.stories.tsx')
})

test('get-template-paths: returns correct structured response format', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: {},
  })

  // Test the complete response structure
  expect(result).toHaveProperty('content')
  expect(result).toHaveProperty('structuredContent')
  expect(result.isError).toBeUndefined()

  const structuredContent = result.structuredContent as { files: string[] }
  expect(structuredContent).toHaveProperty('files')
  expect(Array.isArray(structuredContent.files)).toBe(true)

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

test('get-template-paths: handles empty results gracefully', async () => {
  // Note: In a real scenario, we'd test with an empty directory
  // For now, we just verify the response structure is correct even with results
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: {},
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  expect(structuredContent.files).toBeDefined()
  expect(Array.isArray(structuredContent.files)).toBe(true)
})

test('get-template-paths: filters out story files correctly', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: {},
  })

  const structuredContent = result.structuredContent as { files: string[] }
  const files = structuredContent.files

  // All files should end with .tsx
  files.forEach((file) => {
    expect(file).toMatch(/\.tsx$/)
  })

  // None should be story files
  files.forEach((file) => {
    expect(file).not.toMatch(/\.stories\.tsx$/)
  })
})

test('get-template-paths: returns absolute paths', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
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

test('get-template-paths: maintains consistent ordering', async () => {
  // Call the tool multiple times to ensure consistent ordering
  const results = []
  for (let i = 0; i < 3; i++) {
    const result = await client.callTool({
      name: 'get-template-paths',
      arguments: {},
    })
    const structuredContent = result.structuredContent as { files: string[] }
    results.push(structuredContent.files)
  }

  // All results should be identical
  expect(results[0]).toEqual(results[1])
  expect(results[1]).toEqual(results[2])
})

test('get-template-paths: correctly filters files with .stories. in the middle', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: {},
  })

  const structuredContent = result.structuredContent as { files: string[] }
  const files = structuredContent.files

  // Verify the filter works for .stories. anywhere in the filename
  files.forEach((file) => {
    expect(file).not.toContain('.stories.')
  })
})

test('get-template-paths: bug fix verification - returns filtered files not all files', async () => {
  // This test specifically verifies the bug fix where filteredFiles should be returned
  // in structuredContent, not the original unfiltered files array
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: {},
  })

  const structuredContent = result.structuredContent as { files: string[] }
  
  // Verify that no story files are in the result
  // This confirms we're getting filteredFiles, not the original files array
  const hasStoryFiles = structuredContent.files.some(file => file.includes('.stories.'))
  expect(hasStoryFiles).toBe(false)
  
  // Verify we only have the expected non-story .tsx files
  expect(structuredContent.files.length).toBe(4)
})

test('get-template-paths: filters by subdirectory when dir is provided', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: 'components' },
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  
  // Should only find template files in components directory
  expect(structuredContent.files).toHaveLength(1)
  expect(structuredContent.files[0]).toContain('/components/Card.tsx')
  
  // Should NOT include template files from root or utils
  const fileNames = structuredContent.files.map((f) => f.replace(testProjectPath, ''))
  expect(fileNames).not.toContain('/Button.tsx')
  expect(fileNames).not.toContain('/utils/helpers.tsx')
})

test('get-template-paths: filters by utils directory', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: 'utils' },
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  
  // Should only find template files in utils directory
  expect(structuredContent.files).toHaveLength(1)
  expect(structuredContent.files[0]).toContain('/utils/helpers.tsx')
})

test('get-template-paths: handles current directory reference', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: '.' },
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  
  // Should behave same as no dir parameter
  expect(structuredContent.files).toHaveLength(4)
})

test('get-template-paths: handles empty string as dir', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: '' },
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  
  // Should behave same as no dir parameter
  expect(structuredContent.files).toHaveLength(4)
})

test('get-template-paths: throws error for parent directory traversal', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: '../' },
  })

  expect(result.isError).toBe(true)
  const content = result.content as Array<{ type: string; text: string }>
  expect(content[0].text).toContain('Directory "../" must be within the project root')
})

test('get-template-paths: throws error for absolute path outside project', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: '/tmp/malicious' },
  })

  expect(result.isError).toBe(true)
  const content = result.content as Array<{ type: string; text: string }>
  expect(content[0].text).toContain('Directory "/tmp/malicious" must be within the project root')
})

test('get-template-paths: throws error for path traversal attempts', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: '../../outside' },
  })

  expect(result.isError).toBe(true)
  const content = result.content as Array<{ type: string; text: string }>
  expect(content[0].text).toContain('Directory "../../outside" must be within the project root')
})

test('get-template-paths: excludes story files even in subdirectories', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: 'components' },
  })

  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  
  // Should not include Card.stories.tsx even though it's in components dir
  const hasStoryFiles = structuredContent.files.some(file => file.includes('.stories.'))
  expect(hasStoryFiles).toBe(false)
  
  // Should only have Card.tsx
  expect(structuredContent.files).toHaveLength(1)
  expect(structuredContent.files[0]).toContain('Card.tsx')
  expect(structuredContent.files[0]).not.toContain('.stories.')
})

test('get-template-paths: returns error for empty directory', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: 'empty' },
  })
  
  expect(result.isError).toBe(true)
  const content = result.content as Array<{ type: string; text: string }>
  expect(content[0].text).toBe("Error: No template files (*.tsx) found in directory 'empty' (excluding *.stories.tsx)")
})

test('get-template-paths: returns error for directory with only stories', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: 'stories-only' },
  })
  
  expect(result.isError).toBe(true)
  const content = result.content as Array<{ type: string; text: string }>
  expect(content[0].text).toBe("Error: No template files (*.tsx) found in directory 'stories-only' (excluding *.stories.tsx)")
})

test('get-template-paths: finds template files in templates-only directory', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: 'templates-only' },
  })
  
  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  expect(structuredContent.files).toHaveLength(1)
  expect(structuredContent.files[0]).toContain('OnlyTemplate.tsx')
})

test('get-template-paths: returns correct templates for utils directory', async () => {
  const result = await client.callTool({
    name: 'get-template-paths',
    arguments: { dir: 'utils' },
  })
  
  expect(result.isError).toBeUndefined()
  const structuredContent = result.structuredContent as { files: string[] }
  expect(structuredContent.files).toHaveLength(1)
  expect(structuredContent.files[0]).toContain('helpers.tsx')
})