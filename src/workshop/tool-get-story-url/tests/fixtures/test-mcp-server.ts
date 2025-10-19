#!/usr/bin/env bun
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { getMcpServer } from '../../../mcp.js'
import { toolGetStoryUrl } from '../../tool-get-story-url.js'

try {
  // Create the MCP server
  const mcpServer = getMcpServer()

  // Register the get-story-set-metadata tool
  toolGetStoryUrl(mcpServer, 'http://localhost:3000/')

  // Create stdio transport for communication
  const transport = new StdioServerTransport()

  // Connect the server to the transport
  await mcpServer.connect(transport)
} catch (error) {
  console.error('Failed to start server', error)
  process.exit(1)
}
