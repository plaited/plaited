/**
 * HTTP convenience layer for remote MCP servers (Streamable HTTP transport).
 *
 * @remarks
 * Wraps the transport-agnostic `createMcpSession` with URL-based helpers
 * that construct `StreamableHTTPClientTransport` automatically. Supports
 * custom headers (API keys) and OAuth providers.
 *
 * For transport-agnostic usage, see `add-mcp/scripts/mcp-client.ts`.
 *
 * @public
 */

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  createMcpSession,
  type McpCallToolResult,
  type McpPrompt,
  type McpPromptMessage,
  type McpResource,
  type McpResourceContent,
  type McpServerCapabilities,
  type McpSession,
  type McpTool,
  mcpConnect,
} from '../../add-mcp/scripts/mcp-client.ts'

// Re-export core types for convenience
export type {
  McpCallToolResult,
  McpContent,
  McpPrompt,
  McpPromptArgument,
  McpPromptMessage,
  McpResource,
  McpResourceContent,
  McpServerCapabilities,
  McpSession,
  McpSessionOptions,
  McpTool,
} from '../../add-mcp/scripts/mcp-client.ts'

/**
 * Options for remote (HTTP) MCP connections.
 *
 * @param headers - Custom HTTP headers (e.g., `{ Authorization: 'Bearer ...' }`)
 * @param authProvider - SDK OAuth provider for OAuth 2.1 flows
 * @param timeoutMs - Timeout per MCP operation in milliseconds
 *
 * @public
 */
export type RemoteMcpOptions = {
  headers?: Record<string, string>
  authProvider?: OAuthClientProvider
  timeoutMs?: number
}

// ── Transport factory ──

const createTransport = (url: string, options?: RemoteMcpOptions) =>
  new StreamableHTTPClientTransport(new URL(url), {
    requestInit: options?.headers ? { headers: options.headers } : undefined,
    authProvider: options?.authProvider,
  })

// ── Session API ──

/**
 * Create a reusable MCP session over Streamable HTTP.
 *
 * @remarks
 * Convenience wrapper that constructs the transport from a URL.
 * Supports `await using` for automatic cleanup.
 *
 * ```typescript
 * await using session = await createRemoteMcpSession('https://example.com/mcp')
 * const tools = await session.listTools()
 * ```
 *
 * @param url - MCP server endpoint
 * @param options - Optional auth and timeout configuration
 *
 * @public
 */
export const createRemoteMcpSession = async (url: string, options?: RemoteMcpOptions): Promise<McpSession> => {
  const transport = createTransport(url, options)
  return createMcpSession(transport, { timeoutMs: options?.timeoutMs })
}

// ── One-shot helpers ──

/**
 * Connect to a remote MCP server via Streamable HTTP.
 *
 * @remarks
 * Returns a connected `Client` — caller must call `client.close()` when done.
 * For managed lifecycle, use `createRemoteMcpSession` instead.
 *
 * @param url - MCP server endpoint
 * @param options - Optional auth configuration
 *
 * @public
 */
export const remoteMcpConnect = async (url: string, options?: RemoteMcpOptions) => {
  const transport = createTransport(url, options)
  return mcpConnect(transport)
}

/**
 * List available tools from a remote MCP server.
 *
 * @public
 */
export const mcpListTools = async (url: string, options?: RemoteMcpOptions): Promise<McpTool[]> => {
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.listTools()
  } finally {
    await session.close()
  }
}

/**
 * Call a tool on a remote MCP server.
 *
 * @public
 */
export const mcpCallTool = async (
  url: string,
  toolName: string,
  args: Record<string, unknown>,
  options?: RemoteMcpOptions,
): Promise<McpCallToolResult> => {
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.callTool(toolName, args)
  } finally {
    await session.close()
  }
}

/**
 * List available prompts from a remote MCP server.
 *
 * @public
 */
export const mcpListPrompts = async (url: string, options?: RemoteMcpOptions): Promise<McpPrompt[]> => {
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.listPrompts()
  } finally {
    await session.close()
  }
}

/**
 * Get a prompt's messages from a remote MCP server.
 *
 * @public
 */
export const mcpGetPrompt = async (
  url: string,
  name: string,
  args?: Record<string, string>,
  options?: RemoteMcpOptions,
): Promise<McpPromptMessage[]> => {
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.getPrompt(name, args)
  } finally {
    await session.close()
  }
}

/**
 * List available resources from a remote MCP server.
 *
 * @public
 */
export const mcpListResources = async (url: string, options?: RemoteMcpOptions): Promise<McpResource[]> => {
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.listResources()
  } finally {
    await session.close()
  }
}

/**
 * Read a resource from a remote MCP server.
 *
 * @public
 */
export const mcpReadResource = async (
  url: string,
  uri: string,
  options?: RemoteMcpOptions,
): Promise<McpResourceContent[]> => {
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.readResource(uri)
  } finally {
    await session.close()
  }
}

/**
 * Discover all capabilities of a remote MCP server.
 *
 * @public
 */
export const mcpDiscover = async (url: string, options?: RemoteMcpOptions): Promise<McpServerCapabilities> => {
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.discover()
  } finally {
    await session.close()
  }
}
