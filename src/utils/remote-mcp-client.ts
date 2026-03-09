/**
 * Remote MCP client — Streamable HTTP transport.
 *
 * @remarks
 * Thin convenience layer over `@modelcontextprotocol/sdk` for one-shot
 * discovery and invocation against remote MCP servers.
 *
 * Re-exported from `'plaited'` so skill scripts import directly.
 */

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

// ── Result types — current MCP spec, no backward-compat variants ──

export type McpContent = { type: string; text?: string; [key: string]: unknown }
export type McpCallToolResult = { content: McpContent[]; isError?: boolean }
export type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> }

export type McpPromptArgument = { name: string; description?: string; required?: boolean }
export type McpPrompt = { name: string; description?: string; arguments?: McpPromptArgument[] }
export type McpPromptMessage = { role: 'user' | 'assistant'; content: McpContent }

export type McpResource = {
  uri: string
  name: string
  description?: string
  mimeType?: string
}
export type McpResourceContent = {
  uri: string
  text?: string
  blob?: string
  mimeType?: string
}

export type McpServerCapabilities = {
  tools: McpTool[]
  prompts: McpPrompt[]
  resources: McpResource[]
}

/**
 * Transport-level options for authenticated MCP connections.
 *
 * @param headers - Custom HTTP headers (e.g., `{ Authorization: 'Bearer ...' }`)
 * @param authProvider - SDK OAuth provider for OAuth 2.1 flows (client credentials, authorization code)
 */
export type McpTransportOptions = {
  headers?: Record<string, string>
  authProvider?: OAuthClientProvider
}

// ── Client ──

const CLIENT_INFO = { name: 'plaited', version: '1.0.0' }

/**
 * Connect to a remote MCP server via Streamable HTTP transport.
 *
 * @remarks
 * Returns a connected `Client` — caller must call `client.close()` when done.
 * For one-shot operations, prefer the dedicated convenience functions.
 *
 * @param url - MCP server endpoint
 * @param options - Optional auth: `headers` for API keys, `authProvider` for OAuth 2.1
 */
export const mcpConnect = async (url: string, options?: McpTransportOptions) => {
  const client = new Client(CLIENT_INFO)
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: options?.headers ? { headers: options.headers } : undefined,
    authProvider: options?.authProvider,
  })
  await client.connect(transport)
  return client
}

// ── Tools ──

/**
 * List available tools from a remote MCP server.
 */
export const mcpListTools = async (url: string, options?: McpTransportOptions): Promise<McpTool[]> => {
  const client = await mcpConnect(url, options)
  try {
    const { tools } = await client.listTools()
    return tools
  } finally {
    await client.close()
  }
}

/**
 * Call a tool on a remote MCP server and return the result.
 */
export const mcpCallTool = async (
  url: string,
  toolName: string,
  args: Record<string, unknown>,
  options?: McpTransportOptions,
): Promise<McpCallToolResult> => {
  const client = await mcpConnect(url, options)
  try {
    return (await client.callTool({ name: toolName, arguments: args })) as McpCallToolResult
  } finally {
    await client.close()
  }
}

// ── Prompts ──

/**
 * List available prompts from a remote MCP server.
 */
export const mcpListPrompts = async (url: string, options?: McpTransportOptions): Promise<McpPrompt[]> => {
  const client = await mcpConnect(url, options)
  try {
    const { prompts } = await client.listPrompts()
    return prompts
  } finally {
    await client.close()
  }
}

/**
 * Get a prompt's messages from a remote MCP server.
 */
export const mcpGetPrompt = async (
  url: string,
  name: string,
  args?: Record<string, string>,
  options?: McpTransportOptions,
): Promise<McpPromptMessage[]> => {
  const client = await mcpConnect(url, options)
  try {
    const { messages } = await client.getPrompt({ name, arguments: args })
    return messages as McpPromptMessage[]
  } finally {
    await client.close()
  }
}

// ── Resources ──

/**
 * List available resources from a remote MCP server.
 */
export const mcpListResources = async (url: string, options?: McpTransportOptions): Promise<McpResource[]> => {
  const client = await mcpConnect(url, options)
  try {
    const { resources } = await client.listResources()
    return resources
  } finally {
    await client.close()
  }
}

/**
 * Read a resource from a remote MCP server.
 */
export const mcpReadResource = async (
  url: string,
  uri: string,
  options?: McpTransportOptions,
): Promise<McpResourceContent[]> => {
  const client = await mcpConnect(url, options)
  try {
    const { contents } = await client.readResource({ uri })
    return contents as McpResourceContent[]
  } finally {
    await client.close()
  }
}

// ── Discovery ──

/**
 * Discover all capabilities of a remote MCP server in a single connection.
 */
export const mcpDiscover = async (url: string, options?: McpTransportOptions): Promise<McpServerCapabilities> => {
  const client = await mcpConnect(url, options)
  try {
    const [toolsResult, promptsResult, resourcesResult] = await Promise.allSettled([
      client.listTools(),
      client.listPrompts(),
      client.listResources(),
    ])
    return {
      tools: toolsResult.status === 'fulfilled' ? toolsResult.value.tools : [],
      prompts: promptsResult.status === 'fulfilled' ? promptsResult.value.prompts : [],
      resources: resourcesResult.status === 'fulfilled' ? resourcesResult.value.resources : [],
    }
  } finally {
    await client.close()
  }
}
