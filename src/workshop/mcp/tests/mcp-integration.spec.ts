import { test, expect, beforeAll, afterAll } from 'bun:test'
import { defineWorkshop, PUBLIC_EVENTS } from '../../define-workshop.js'
import { MCP_EVENTS, MCP_TOOL_EVENTS } from '../mcp.constants.js'
import { generateMCPRequestId } from '../mcp-promise-manager.js'

// Shared workshop instance to avoid creating multiple servers
let workshopTrigger: any
const originalProcessExit = process.exit

beforeAll(async () => {
  // Override process.exit to prevent it from actually exiting during tests
  process.exit = (() => {}) as any
  
  workshopTrigger = await defineWorkshop({ cwd: process.cwd() + '/src' })
})

afterAll(async () => {
  // Restore original process.exit
  process.exit = originalProcessExit
  
  // Send SIGINT to trigger cleanup
  process.emit('SIGINT', 'SIGINT')
  
  // Give a short time for cleanup, then exit
  await new Promise(resolve => setTimeout(resolve, 100))
})

test('defineWorkshop initializes with MCP integration', async () => {
  expect(workshopTrigger).toBeDefined()
  expect(typeof workshopTrigger).toBe('function')
})

test('MCP tool call routes to correct events', async () => {
  const requestId = generateMCPRequestId()
  const params = { filter: 'test' }
  
  // This should not throw and should handle the routing
  const result = workshopTrigger({
    type: MCP_EVENTS.mcp_tool_call,
    detail: { toolName: 'list_routes', params, requestId }
  })
  
  expect(result).toBeUndefined() // Handlers return void
})

test('MCP list routes coordination works', async () => {
  const requestId = generateMCPRequestId()
  
  // First trigger LIST_ROUTES to populate data
  workshopTrigger({ type: PUBLIC_EVENTS.list_routes })
  
  // Then trigger MCP list routes request
  const result = workshopTrigger({
    type: MCP_TOOL_EVENTS.mcp_list_routes,
    detail: { params: {}, requestId }
  })
  
  expect(result).toBeUndefined()
})

test('MCP tool handlers validate parameters', async () => {
  const requestId = generateMCPRequestId()
  
  // Test valid parameters
  expect(() => {
    workshopTrigger({
      type: MCP_TOOL_EVENTS.mcp_list_routes,
      detail: { params: { filter: 'test', includeTests: true }, requestId }
    })
  }).not.toThrow()
  
  // Test valid test parameters
  expect(() => {
    workshopTrigger({
      type: MCP_TOOL_EVENTS.mcp_test_all_stories,
      detail: { params: { timeout: 5000, colorScheme: 'light' }, requestId }
    })
  }).not.toThrow()
  
  // Test valid story set parameters
  expect(() => {
    workshopTrigger({
      type: MCP_TOOL_EVENTS.mcp_test_story_set,
      detail: { params: { routes: ['/test'], timeout: 10000 }, requestId }
    })
  }).not.toThrow()
})

test('Original workshop functionality is preserved', async () => {
  // Original events should still work
  expect(() => {
    workshopTrigger({ type: PUBLIC_EVENTS.list_routes })
    workshopTrigger({ type: PUBLIC_EVENTS.test_all_stories })
  }).not.toThrow()
})

test('MCP response handler processes responses', async () => {
  const responses = [
    { requestId: 'test_123', data: { routes: [] } },
    { requestId: 'test_456', error: 'Test error' }
  ]
  
  // This should not throw
  const result = workshopTrigger({
    type: MCP_EVENTS.mcp_response,
    detail: responses
  })
  
  expect(result).toBeUndefined()
})

test('B-thread coordination events work', async () => {
  const requestId = generateMCPRequestId()
  
  // These events should be handled by b-threads
  expect(() => {
    workshopTrigger({
      type: MCP_TOOL_EVENTS.mcp_list_routes,
      detail: { params: {}, requestId }
    })
    
    workshopTrigger({
      type: MCP_TOOL_EVENTS.mcp_test_all_stories,
      detail: { params: {}, requestId }
    })
    
    workshopTrigger({
      type: MCP_TOOL_EVENTS.mcp_test_story_set,
      detail: { params: { routes: ['/test'] }, requestId }
    })
  }).not.toThrow()
})