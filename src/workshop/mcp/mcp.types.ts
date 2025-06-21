import { z } from 'zod'
import { MCP_EVENTS, MCP_TOOL_EVENTS } from './mcp.constants.js'

// Zod schemas for tool parameters
export const ListRoutesSchema = z.object({
  filter: z.string().optional(),
  includeTests: z.boolean().default(true)
})

export const TestAllStoriesSchema = z.object({
  timeout: z.number().min(1000).default(30000),
  colorScheme: z.enum(['light', 'dark', 'both']).default('both')
})

export const TestStorySetSchema = z.object({
  routes: z.array(z.string()).min(1),
  timeout: z.number().min(1000).default(30000)
})

// Type inference from schemas
export type ListRoutesParams = z.infer<typeof ListRoutesSchema>
export type TestAllStoriesParams = z.infer<typeof TestAllStoriesSchema>
export type TestStorySetParams = z.infer<typeof TestStorySetSchema>

// MCP request tracking
export type MCPRequestInfo = {
  toolName: string
  params: unknown
  timestamp: number
}

// Route information for responses
export type RouteInfo = {
  filePath: string
  href: string
}

// MCP event details
export type MCPDetails = {
  [MCP_EVENTS.mcp_tool_call]: {
    toolName: string
    params: unknown
    requestId: string
  }
  [MCP_EVENTS.mcp_response]: Array<{
    requestId: string
    data?: unknown
    error?: string
  }>
  [MCP_TOOL_EVENTS.mcp_list_routes]: {
    params: ListRoutesParams
    requestId: string
  }
  [MCP_TOOL_EVENTS.mcp_test_all_stories]: {
    params: TestAllStoriesParams
    requestId: string
  }
  [MCP_TOOL_EVENTS.mcp_test_story_set]: {
    params: TestStorySetParams
    requestId: string
  }
}