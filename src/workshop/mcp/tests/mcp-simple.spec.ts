import { test, expect } from 'bun:test'
import { MCP_EVENTS, MCP_TOOL_EVENTS } from '../mcp.constants.js'
import { generateMCPRequestId, resolveMCPRequest } from '../mcp-promise-manager.js'
import { ListRoutesSchema, TestAllStoriesSchema, TestStorySetSchema } from '../mcp.types.js'

test('MCP constants are exported correctly', () => {
  expect(MCP_EVENTS).toHaveProperty('MCP_TOOL_CALL')
  expect(MCP_EVENTS).toHaveProperty('MCP_RESPONSE')
  expect(MCP_TOOL_EVENTS).toHaveProperty('MCP_LIST_ROUTES')
  expect(MCP_TOOL_EVENTS).toHaveProperty('MCP_TEST_ALL_STORIES')
  expect(MCP_TOOL_EVENTS).toHaveProperty('MCP_TEST_STORY_SET')
})

test('Request ID generation works', () => {
  const id = generateMCPRequestId()
  expect(typeof id).toBe('string')
  expect(id.length).toBeGreaterThan(10)
  expect(id).toMatch(/^mcp_/)
})

test('Promise resolution works', () => {
  const requestId = generateMCPRequestId()
  
  // Should not throw for non-existent requests
  expect(() => {
    resolveMCPRequest(requestId, { test: 'data' })
  }).not.toThrow()
  
  expect(() => {
    resolveMCPRequest(requestId, undefined, 'error message')
  }).not.toThrow()
})

test('Zod schemas parse valid data', () => {
  expect(() => {
    ListRoutesSchema.parse({ filter: 'test' })
  }).not.toThrow()
  
  expect(() => {
    TestAllStoriesSchema.parse({ timeout: 5000 })
  }).not.toThrow()
  
  expect(() => {
    TestStorySetSchema.parse({ routes: ['/test'] })
  }).not.toThrow()
})

test('Zod schemas reject invalid data', () => {
  expect(() => {
    TestAllStoriesSchema.parse({ timeout: -1 })
  }).toThrow()
  
  expect(() => {
    TestStorySetSchema.parse({ routes: [] })
  }).toThrow()
  
  expect(() => {
    TestAllStoriesSchema.parse({ colorScheme: 'invalid' })
  }).toThrow()
})

test('Schema defaults work correctly', () => {
  const listResult = ListRoutesSchema.parse({})
  expect(listResult.includeTests).toBe(true)
  
  const testResult = TestAllStoriesSchema.parse({})
  expect(testResult.timeout).toBe(30000)
  expect(testResult.colorScheme).toBe('both')
  
  const storySetResult = TestStorySetSchema.parse({ routes: ['/test'] })
  expect(storySetResult.timeout).toBe(30000)
})

test('Complex parameter validation', () => {
  // Test comprehensive parameter objects
  const complexList = ListRoutesSchema.parse({
    filter: 'component',
    includeTests: false
  })
  expect(complexList.filter).toBe('component')
  expect(complexList.includeTests).toBe(false)
  
  const complexTest = TestAllStoriesSchema.parse({
    timeout: 15000,
    colorScheme: 'dark'
  })
  expect(complexTest.timeout).toBe(15000)
  expect(complexTest.colorScheme).toBe('dark')
  
  const complexStorySet = TestStorySetSchema.parse({
    routes: ['/story1', '/story2', '/story3'],
    timeout: 45000
  })
  expect(complexStorySet.routes).toHaveLength(3)
  expect(complexStorySet.timeout).toBe(45000)
})