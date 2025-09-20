#!/usr/bin/env bun
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { getMcpServer } from '../../../get-mcp-server.js'
import { registerGetStorySetMetadata } from '../../register-get-story-set-metadata.js'

try {
  // Create the MCP server
  const mcpServer = getMcpServer()

  // Register the get-story-set-metadata tool
  registerGetStorySetMetadata(mcpServer)

  // Create stdio transport for communication
  const transport = new StdioServerTransport()

  // Connect the server to the transport
  await mcpServer.connect(transport)
} catch (error) {
  console.error('Failed to start server', error)
  process.exit(1)
}
