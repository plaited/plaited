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
  [MCP_EVENTS.MCP_TOOL_CALL]: {
    toolName: string
    params: unknown
    requestId: string
  }
  [MCP_EVENTS.MCP_RESPONSE]: Array<{
    requestId: string
    data?: unknown
    error?: string
  }>
  [MCP_TOOL_EVENTS.MCP_LIST_ROUTES]: {
    params: ListRoutesParams
    requestId: string
  }
  [MCP_TOOL_EVENTS.MCP_TEST_ALL_STORIES]: {
    params: TestAllStoriesParams
    requestId: string
  }
  [MCP_TOOL_EVENTS.MCP_TEST_STORY_SET]: {
    params: TestStorySetParams
    requestId: string
  }
}