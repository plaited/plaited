/**
 * Transport-agnostic MCP client — session API with connection reuse.
 *
 * @remarks
 * Core library for connecting to any MCP server via the SDK's Transport
 * interface. Provides both a session API (connection reuse, explicit
 * disposal) and one-shot helpers that manage connections internally.
 *
 * For HTTP-specific convenience, see `add-remote-mcp/scripts/remote-mcp.ts`.
 *
 * @public
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

// ── Result types — current MCP spec, no backward-compat variants ──

/**
 * Content item returned by an MCP tool call.
 *
 * @public
 */
export type McpContent = { type: string; text?: string; [key: string]: unknown }
/**
 * Result of a tool call via MCP.
 *
 * @public
 */
export type McpCallToolResult = { content: McpContent[]; isError?: boolean }
/**
 * Tool definition returned by an MCP server.
 *
 * @public
 */
export type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> }

/**
 * Argument definition for an MCP prompt.
 *
 * @public
 */
export type McpPromptArgument = { name: string; description?: string; required?: boolean }
/**
 * Prompt definition returned by an MCP server.
 *
 * @public
 */
export type McpPrompt = { name: string; description?: string; arguments?: McpPromptArgument[] }
/**
 * A single message within an MCP prompt.
 *
 * @public
 */
export type McpPromptMessage = { role: 'user' | 'assistant'; content: McpContent }

/**
 * Resource entry returned by an MCP server.
 *
 * @public
 */
export type McpResource = {
  uri: string
  name: string
  description?: string
  mimeType?: string
}
/**
 * Content of a resource read from an MCP server.
 *
 * @public
 */
export type McpResourceContent = {
  uri: string
  text?: string
  blob?: string
  mimeType?: string
}

/**
 * Subset of capabilities advertised by an MCP server.
 *
 * @public
 */
export type McpServerCapabilities = {
  tools: McpTool[]
  prompts: McpPrompt[]
  resources: McpResource[]
}

/**
 * Options for creating an MCP session.
 *
 * @public
 */
export type McpSessionOptions = {
  timeoutMs?: number
}

// ── Client ──

const CLIENT_INFO = { name: 'plaited', version: '1.0.0' }

/**
 * Connect to an MCP server via any SDK Transport.
 *
 * @remarks
 * Returns a connected `Client` — caller must call `client.close()` when done.
 * For managed lifecycle, use `createMcpSession` instead.
 *
 * @param transport - SDK Transport instance (StreamableHTTP, stdio, etc.)
 * @returns Connected `Client` instance — caller must call `client.close()` when done.
 *
 * @public
 */
export const mcpConnect = async (transport: Transport) => {
  const client = new Client(CLIENT_INFO)
  await client.connect(transport)
  return client
}

// ── Session API ──

/**
 * MCP session with connection reuse and explicit disposal.
 *
 * @remarks
 * Use `await using` for automatic cleanup:
 * ```typescript
 * await using session = await createMcpSession(transport)
 * const tools = await session.listTools()
 * const result = await session.callTool('search', { query: 'test' })
 * ```
 *
 * @public
 */
export type McpSession = {
  listTools: () => Promise<McpTool[]>
  callTool: (name: string, args: Record<string, unknown>) => Promise<McpCallToolResult>
  listPrompts: () => Promise<McpPrompt[]>
  getPrompt: (name: string, args?: Record<string, string>) => Promise<McpPromptMessage[]>
  listResources: () => Promise<McpResource[]>
  readResource: (uri: string) => Promise<McpResourceContent[]>
  discover: () => Promise<McpServerCapabilities>
  close: () => Promise<void>
  [Symbol.asyncDispose]: () => Promise<void>
}

/**
 * Create a reusable MCP session over a transport.
 *
 * @remarks
 * The session maintains a single connection for multiple operations.
 * Supports `Symbol.asyncDispose` for `await using` cleanup.
 *
 * @param transport - SDK Transport instance
 * @param options - Optional session configuration
 *
 * @public
 */
export const createMcpSession = async (transport: Transport, options?: McpSessionOptions): Promise<McpSession> => {
  const timeoutMs = options?.timeoutMs

  const client = new Client(CLIENT_INFO)
  await client.connect(transport)

  const withTimeout = <T>(fn: () => Promise<T>): Promise<T> => {
    if (!timeoutMs) return fn()
    const timeout = AbortSignal.timeout(timeoutMs)
    return new Promise<T>((resolve, reject) => {
      timeout.addEventListener('abort', () => reject(new Error(`MCP operation timed out after ${timeoutMs}ms`)), {
        once: true,
      })
      fn().then(resolve, reject)
    })
  }

  const close = async () => {
    try {
      await client.close()
    } catch {
      // Best-effort cleanup — SDK may throw if connection already closing
    }
  }

  return {
    listTools: () =>
      withTimeout(async () => {
        const { tools } = await client.listTools()
        return tools
      }),

    callTool: (name, args) =>
      withTimeout(async () => (await client.callTool({ name, arguments: args })) as McpCallToolResult),

    listPrompts: () =>
      withTimeout(async () => {
        const { prompts } = await client.listPrompts()
        return prompts
      }),

    getPrompt: (name, args) =>
      withTimeout(async () => {
        const { messages } = await client.getPrompt({ name, arguments: args })
        return messages as McpPromptMessage[]
      }),

    listResources: () =>
      withTimeout(async () => {
        const { resources } = await client.listResources()
        return resources
      }),

    readResource: (uri) =>
      withTimeout(async () => {
        const { contents } = await client.readResource({ uri })
        return contents as McpResourceContent[]
      }),

    discover: () =>
      withTimeout(async () => {
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
      }),

    close,
    [Symbol.asyncDispose]: close,
  }
}
