import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { defineWorkshop } from '../define-workshop.js'
import { MCP_EVENTS } from './mcp.constants.js'
import { ListRoutesSchema, TestAllStoriesSchema, TestStorySetSchema } from './mcp.types.js'
import { zodToJsonSchema } from './zod-to-json-schema.js'
import { storeMCPPromise, generateMCPRequestId } from './mcp-promise-manager.js'

export async function createMCPWorkshopServer({ cwd }: { cwd: string }) {
  // Initialize workshop behavioral program
  const workshopTrigger = await defineWorkshop({ cwd })
  
  // Create MCP server
  const server = new Server(
    {
      name: 'plaited-workshop',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // Tool definitions for MCP protocol
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_routes',
        description: 'List all available story routes with optional filtering',
        inputSchema: zodToJsonSchema(ListRoutesSchema),
      },
      {
        name: 'test_all_stories',
        description: 'Run tests for all stories with configurable options',
        inputSchema: zodToJsonSchema(TestAllStoriesSchema),
      },
      {
        name: 'test_story_set',
        description: 'Run tests for a specific set of story routes',
        inputSchema: zodToJsonSchema(TestStorySetSchema),
      },
    ],
  }))

  // Tool execution handler - bridges to behavioral program
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: params } = request.params
    
    return new Promise((resolve, reject) => {
      const requestId = generateMCPRequestId()
      
      // Store promise resolver with timeout
      storeMCPPromise(requestId, resolve, reject)
      
      // Trigger behavioral program coordination
      workshopTrigger({
        type: MCP_EVENTS.mcp_tool_call,
        detail: { toolName, params, requestId }
      })
    })
  })

  return server
}

// Main server startup function
export async function startMCPServer() {
  try {
    const server = await createMCPWorkshopServer({ 
      cwd: process.cwd() + '/src' 
    })
    
    const transport = new StdioServerTransport()
    await server.connect(transport)
    
    console.error('Plaited Workshop MCP server running on stdio')
  } catch (error) {
    console.error('Failed to start MCP server:', error)
    process.exit(1)
  }
}

// Run server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMCPServer()
}