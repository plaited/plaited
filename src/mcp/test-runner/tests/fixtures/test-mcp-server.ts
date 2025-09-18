#!/usr/bin/env bun
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { getMcpServer } from '../../../get-mcp-server.js'
import { registerGetStorySetMetadata } from '../../../get-story-set-metadata/register-get-story-set-metadata.js'

async function startServer() {
  // Create the MCP server
  const server = getMcpServer()

  // Register the get-story-set-metadata tool
  registerGetStorySetMetadata(server)

  // Create stdio transport for communication
  const transport = new StdioServerTransport()

  // Connect the server to the transport
  await server.connect(transport)

  // Log that server is ready (helpful for debugging)
  console.error('Test MCP server started with get-story-set-metadata tool registered')
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start test server:', error)
  process.exit(1)
})

// Handle graceful shutdown
process.on('SIGINT', async () => {
  process.exit(0)
})

process.on('SIGTERM', async () => {
  process.exit(0)
})
