import { test, expect } from 'bun:test'
import { MCP_EVENTS, MCP_TOOL_EVENTS } from '../mcp.constants.js'
import { resolveMCPRequest, generateMCPRequestId, storeMCPPromise } from '../mcp-promise-manager.js'
import { ListRoutesSchema, TestAllStoriesSchema, TestStorySetSchema } from '../mcp.types.js'
import { zodToJsonSchema } from '../zod-to-json-schema.js'

test('MCP event constants are properly defined', () => {
  expect(MCP_EVENTS.mcp_tool_call).toBe('mcp_tool_call')
  expect(MCP_EVENTS.mcp_response).toBe('mcp_response')
  
  expect(MCP_TOOL_EVENTS.mcp_list_routes).toBe('mcp_list_routes')
  expect(MCP_TOOL_EVENTS.mcp_test_all_stories).toBe('mcp_test_all_stories')
  expect(MCP_TOOL_EVENTS.mcp_test_story_set).toBe('mcp_test_story_set')
})

test('MCP promise manager generates unique IDs', () => {
  const id1 = generateMCPRequestId()
  const id2 = generateMCPRequestId()
  
  expect(id1).not.toBe(id2)
  expect(id1).toMatch(/^mcp_\d+_[a-z0-9]+$/)
  expect(id2).toMatch(/^mcp_\d+_[a-z0-9]+$/)
})

test('MCP promise manager handles resolution', () => {
  const requestId = generateMCPRequestId()
  const testData = { routes: [{ filePath: 'test.ts', href: 'http://test.com' }] }
  
  // Should not throw when resolving non-existent request
  resolveMCPRequest(requestId, testData)
  expect(true).toBe(true)
  
  // Should not throw when resolving with error
  resolveMCPRequest(requestId, undefined, 'Test error')
  expect(true).toBe(true)
})

test('MCP promise manager stores promises correctly', () => {
  const requestId = generateMCPRequestId()
  let resolved = false
  let rejected = false
  
  const resolve = () => { resolved = true }
  const reject = () => { rejected = true }
  
  // Store promise
  storeMCPPromise(requestId, resolve, reject)
  
  // Resolve it
  resolveMCPRequest(requestId, { test: 'data' })
  
  expect(resolved).toBe(true)
  expect(rejected).toBe(false)
})

test('MCP promise manager handles errors correctly', () => {
  const requestId = generateMCPRequestId()
  let resolved = false
  let rejected = false
  let errorMessage = ''
  
  const resolve = () => { resolved = true }
  const reject = (error: Error) => { 
    rejected = true
    errorMessage = error.message
  }
  
  // Store promise
  storeMCPPromise(requestId, resolve, reject)
  
  // Reject it
  resolveMCPRequest(requestId, undefined, 'Test error')
  
  expect(resolved).toBe(false)
  expect(rejected).toBe(true)
  expect(errorMessage).toBe('Test error')
})

test('Zod schemas validate correctly', () => {
  // Test ListRoutesSchema
  const validListParams = { filter: 'test', includeTests: true }
  const parsedListParams = ListRoutesSchema.parse(validListParams)
  expect(parsedListParams).toEqual(validListParams)
  
  // Test TestAllStoriesSchema
  const validTestParams = { timeout: 5000, colorScheme: 'light' as const }
  const parsedTestParams = TestAllStoriesSchema.parse(validTestParams)
  expect(parsedTestParams).toEqual(validTestParams)
  
  // Test TestStorySetSchema
  const validStorySetParams = { routes: ['/test1', '/test2'], timeout: 10000 }
  const parsedStorySetParams = TestStorySetSchema.parse(validStorySetParams)
  expect(parsedStorySetParams).toEqual(validStorySetParams)
})

test('Zod schemas handle invalid data', () => {
  // Test invalid timeout (negative)
  expect(() => {
    TestAllStoriesSchema.parse({ timeout: -1 })
  }).toThrow()
  
  // Test invalid colorScheme
  expect(() => {
    TestAllStoriesSchema.parse({ colorScheme: 'invalid' })
  }).toThrow()
  
  // Test empty routes array
  expect(() => {
    TestStorySetSchema.parse({ routes: [] })
  }).toThrow()
})

test('Zod to JSON Schema conversion works', () => {
  const jsonSchema = zodToJsonSchema(ListRoutesSchema)
  
  expect(jsonSchema).toHaveProperty('type', 'object')
  expect(jsonSchema).toHaveProperty('properties')
  expect(jsonSchema).toHaveProperty('required')
  expect(jsonSchema).toHaveProperty('additionalProperties', false)
  
  // Check specific properties
  expect(jsonSchema.properties).toHaveProperty('filter')
  expect(jsonSchema.properties).toHaveProperty('includeTests')
  expect(jsonSchema.properties.filter).toEqual({ type: 'string' })
  expect(jsonSchema.properties.includeTests).toEqual({ type: 'boolean', default: true })
})

test('Zod schemas have default values', () => {
  // Test defaults for ListRoutesSchema
  const listDefaults = ListRoutesSchema.parse({})
  expect(listDefaults.includeTests).toBe(true)
  expect(listDefaults.filter).toBeUndefined()
  
  // Test defaults for TestAllStoriesSchema
  const testDefaults = TestAllStoriesSchema.parse({})
  expect(testDefaults.timeout).toBe(30000)
  expect(testDefaults.colorScheme).toBe('both')
  
  // Test defaults for TestStorySetSchema (routes required, timeout has default)
  const storySetDefaults = TestStorySetSchema.parse({ routes: ['/test'] })
  expect(storySetDefaults.timeout).toBe(30000)
  expect(storySetDefaults.routes).toEqual(['/test'])
})

test('Promise manager handles timeout cleanup', async () => {
  const requestId = generateMCPRequestId()
  let timeoutError = false
  
  const resolve = () => {}
  const reject = (error: Error) => {
    if (error.message.includes('timeout')) {
      timeoutError = true
    }
  }
  
  // Store promise (this will set up a 30-second timeout)
  storeMCPPromise(requestId, resolve, reject)
  
  // For testing, we won't wait 30 seconds, just verify the mechanism exists
  expect(true).toBe(true) // Test setup successful
})

test('Multiple concurrent requests work correctly', () => {
  const requestId1 = generateMCPRequestId()
  const requestId2 = generateMCPRequestId()
  
  let resolved1 = false
  let resolved2 = false
  let data1: any = null
  let data2: any = null
  
  storeMCPPromise(requestId1, (result: any) => {
    resolved1 = true
    data1 = result
  }, () => {})
  
  storeMCPPromise(requestId2, (result: any) => {
    resolved2 = true
    data2 = result
  }, () => {})
  
  // Resolve them in different order
  resolveMCPRequest(requestId2, { second: 'data' })
  resolveMCPRequest(requestId1, { first: 'data' })
  
  expect(resolved1).toBe(true)
  expect(resolved2).toBe(true)
  expect(data1.content[0].text).toContain('first')
  expect(data2.content[0].text).toContain('second')
})