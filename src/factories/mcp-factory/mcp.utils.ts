import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import packageJson from '../../../package.json' with { type: 'json' }
import { McpManifestSchema } from './mcp.schemas.ts'

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
export type McpSessionOptions = {
  timeoutMs?: number
}
export type RemoteMcpOptions = {
  headers?: Record<string, string>
  authProvider?: OAuthClientProvider
  timeoutMs?: number
}
export type McpManifest = {
  server?: {
    name: string
    version?: string
    transport?: string
  }
  capabilities: {
    tools: Record<string, McpTool> | McpTool[]
    prompts: Record<string, McpPrompt> | McpPrompt[]
    resources: Record<string, McpResource> | McpResource[]
  }
}

const CLIENT_INFO = { name: 'plaited', version: packageJson.version }

const createRemoteHeaders = async (options?: RemoteMcpOptions) => {
  const headers = new Headers(options?.headers)
  headers.set('Accept', 'application/json')

  if (options?.authProvider) {
    const tokens = await options.authProvider.tokens()
    if (tokens?.access_token) {
      headers.set('Authorization', `Bearer ${tokens.access_token}`)
    }
  }

  return headers
}

const normalizeManifestEntries = <T extends { name: string }>(entries: Record<string, T> | T[]) =>
  Array.isArray(entries) ? entries : Object.values(entries)

export const normalizeMcpManifestCapabilities = (manifest: McpManifest): McpServerCapabilities => ({
  tools: normalizeManifestEntries(manifest.capabilities.tools),
  prompts: normalizeManifestEntries(manifest.capabilities.prompts),
  resources: normalizeManifestEntries(manifest.capabilities.resources),
})

export const fetchRemoteMcpManifest = async (url: string, options?: RemoteMcpOptions): Promise<McpManifest | null> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: await createRemoteHeaders(options),
  })

  if (!response.ok) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return null
  }

  const json = await response.json()
  const result = McpManifestSchema.safeParse(json)
  return result.success ? (result.data as McpManifest) : null
}

const getRemoteManifestCapabilities = async (url: string, options?: RemoteMcpOptions) => {
  const manifest = await fetchRemoteMcpManifest(url, options)
  return manifest ? normalizeMcpManifestCapabilities(manifest) : null
}

export const mcpConnect = async (transport: Transport) => {
  const client = new Client(CLIENT_INFO)
  await client.connect(transport)
  return client
}

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
      // Best-effort cleanup
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

export const createRemoteMcpTransport = (url: string, options?: RemoteMcpOptions) =>
  new StreamableHTTPClientTransport(new URL(url), {
    requestInit: options?.headers ? { headers: options.headers } : undefined,
    authProvider: options?.authProvider,
  })

export const createRemoteMcpSession = async (url: string, options?: RemoteMcpOptions): Promise<McpSession> =>
  createMcpSession(createRemoteMcpTransport(url, options), { timeoutMs: options?.timeoutMs })

export const remoteMcpConnect = async (url: string, options?: RemoteMcpOptions) => {
  const transport = createRemoteMcpTransport(url, options)
  return mcpConnect(transport)
}

export const mcpListTools = async (url: string, options?: RemoteMcpOptions): Promise<McpTool[]> => {
  const capabilities = await getRemoteManifestCapabilities(url, options)
  if (capabilities) return capabilities.tools
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.listTools()
  } finally {
    await session.close()
  }
}

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

export const mcpListPrompts = async (url: string, options?: RemoteMcpOptions): Promise<McpPrompt[]> => {
  const capabilities = await getRemoteManifestCapabilities(url, options)
  if (capabilities) return capabilities.prompts
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.listPrompts()
  } finally {
    await session.close()
  }
}

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

export const mcpListResources = async (url: string, options?: RemoteMcpOptions): Promise<McpResource[]> => {
  const capabilities = await getRemoteManifestCapabilities(url, options)
  if (capabilities) return capabilities.resources
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.listResources()
  } finally {
    await session.close()
  }
}

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

export const mcpDiscover = async (url: string, options?: RemoteMcpOptions): Promise<McpServerCapabilities> => {
  const capabilities = await getRemoteManifestCapabilities(url, options)
  if (capabilities) return capabilities
  const session = await createRemoteMcpSession(url, options)
  try {
    return await session.discover()
  } finally {
    await session.close()
  }
}
