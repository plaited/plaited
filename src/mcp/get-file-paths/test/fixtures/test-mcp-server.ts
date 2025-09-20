#!/usr/bin/env bun
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { getMcpServer } from '../../../get-mcp-server.js'
import { registerGetStorySetPaths } from '../../register-get-story-set-paths.js'
import { registerGetTemplatePaths } from '../../register-get-template-paths.js'

try {
  // Create the MCP server
  const mcpServer = getMcpServer()

  // Get the test cwd from environment variable or use default
  const cwd = process.env.TEST_CWD || process.cwd()

  // Register the tools
  registerGetStorySetPaths(mcpServer, cwd)
  registerGetTemplatePaths(mcpServer, cwd)

  // Create stdio transport for communication
  const transport = new StdioServerTransport()

  // Connect the server to the transport
  await mcpServer.connect(transport)
} catch (error) {
  console.error('Failed to start server', error)
  process.exit(1)
}