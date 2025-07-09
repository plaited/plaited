/**
 * @module mcp
 *
 * Model Context Protocol integration for Plaited
 * Provides high-level APIs for creating MCP servers and clients
 * with behavioral programming support
 */

export { defineMCPServer } from './mcp/define-mcp-server.js'
export { defineMCPClient } from './mcp/define-mcp-client.js'

// Export types for external use
export type {
  // Server types
  Registry,
  PromptEntry,
  ResourceEntry,
  ToolEntry,
  PromptConfig,
  ResourceConfig,
  ToolConfig,
  PrimitiveHandlers,

  // Client types
  ServerTransportConfigs as MCPTransportConfig,
  MCPClientConfig,
  MCPClientEventDetails,
  MCPClientBProgramArgs,
  CallToolDetail,
  ReadResourceDetail,
  GetPromptDetail,
} from './mcp/mcp.types.js'
