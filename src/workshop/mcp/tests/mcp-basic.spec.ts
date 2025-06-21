import { test, expect } from 'bun:test'
import { MCP_EVENTS, MCP_TOOL_EVENTS } from '../mcp.constants.js'
import { generateMCPRequestId } from '../mcp-promise-manager.js'

// Simple test that doesn't initialize full workshop
test('MCP constants are properly exported', () => {
  expect(MCP_EVENTS.mcp_tool_call).toBe('mcp_tool_call')
  expect(MCP_EVENTS.mcp_response).toBe('mcp_response')
  expect(MCP_TOOL_EVENTS.mcp_list_routes).toBe('mcp_list_routes')
  expect(MCP_TOOL_EVENTS.mcp_test_all_stories).toBe('mcp_test_all_stories')
  expect(MCP_TOOL_EVENTS.mcp_test_story_set).toBe('mcp_test_story_set')
})

test('Request ID generation is functional', () => {
  const id1 = generateMCPRequestId()
  const id2 = generateMCPRequestId()
  
  expect(id1).not.toBe(id2)
  expect(id1).toMatch(/^mcp_\d+_[a-z0-9]+$/)
  expect(id2).toMatch(/^mcp_\d+_[a-z0-9]+$/)
})

// Test that our workshop imports work without crashing
test('Workshop module can be imported', async () => {
  const { defineWorkshop, PUBLIC_EVENTS } = await import('../../define-workshop.js')
  
  expect(defineWorkshop).toBeDefined()
  expect(typeof defineWorkshop).toBe('function')
  expect(PUBLIC_EVENTS).toBeDefined()
  expect(PUBLIC_EVENTS.list_routes).toBe('list_routes')
  expect(PUBLIC_EVENTS.test_all_stories).toBe('test_all_stories')
})

// Test MCP types import
test('MCP types can be imported', async () => {
  const { ListRoutesSchema, TestAllStoriesSchema, TestStorySetSchema } = await import('../mcp.types.js')
  
  expect(ListRoutesSchema).toBeDefined()
  expect(TestAllStoriesSchema).toBeDefined()
  expect(TestStorySetSchema).toBeDefined()
  
  // Test they can parse valid data
  expect(() => ListRoutesSchema.parse({})).not.toThrow()
  expect(() => TestAllStoriesSchema.parse({})).not.toThrow()
  expect(() => TestStorySetSchema.parse({ routes: ['/test'] })).not.toThrow()
})

// Test MCP server can be imported 
test('MCP server module can be imported', async () => {
  const { createMCPWorkshopServer } = await import('../mcp-server.js')
  
  expect(createMCPWorkshopServer).toBeDefined()
  expect(typeof createMCPWorkshopServer).toBe('function')
})

test('Promise manager utilities work', async () => {
  const { resolveMCPRequest, storeMCPPromise, generateMCPRequestId } = await import('../mcp-promise-manager.js')
  
  expect(resolveMCPRequest).toBeDefined()
  expect(storeMCPPromise).toBeDefined()
  expect(generateMCPRequestId).toBeDefined()
  
  const id = generateMCPRequestId()
  expect(typeof id).toBe('string')
  expect(id.length).toBeGreaterThan(10)
})