/**
 * Agent-facing MCP client for calling remote MCP servers.
 *
 * @remarks
 * Supports all 7 MCP operations: call-tool, list-tools, list-prompts,
 * get-prompt, list-resources, read-resource, and discover.
 *
 * @packageDocumentation
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import * as z from 'zod'
import { makeCli } from './cli.ts'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const remoteMcpSecretSchema = z.object({
  envVar: z.string().min(1),
  optional: z.boolean().optional(),
  description: z.string().optional(),
})

const tokenPersistenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), path: z.string().optional() }),
  z.object({ kind: z.literal('env') }),
])

const authConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('bearer-env'),
    token: remoteMcpSecretSchema,
    headerName: z.string().min(1).optional(),
    prefix: z.string().optional(),
  }),
  z.object({
    type: z.literal('static-headers'),
    headers: z.record(z.string(), z.string()),
  }),
  z.object({
    type: z.literal('oauth-client-credentials'),
    issuer: z.string().url().optional(),
    tokenUrl: z.string().url(),
    clientId: remoteMcpSecretSchema,
    clientSecret: remoteMcpSecretSchema.optional(),
    scopes: z.array(z.string().min(1)).optional(),
    audience: z.string().min(1).optional(),
    resource: z.string().min(1).optional(),
    clientAuthentication: z.enum(['client_secret_basic', 'client_secret_post', 'none']).optional(),
    tokenPersistence: tokenPersistenceSchema.optional(),
  }),
  z.object({
    type: z.literal('oauth-refresh-token'),
    issuer: z.string().url().optional(),
    tokenUrl: z.string().url(),
    clientId: remoteMcpSecretSchema,
    clientSecret: remoteMcpSecretSchema.optional(),
    refreshToken: remoteMcpSecretSchema,
    scopes: z.array(z.string().min(1)).optional(),
    audience: z.string().min(1).optional(),
    resource: z.string().min(1).optional(),
    clientAuthentication: z.enum(['client_secret_basic', 'client_secret_post', 'none']).optional(),
    tokenPersistence: tokenPersistenceSchema.optional(),
  }),
])

const modeFields = {
  auth: authConfigSchema.optional(),
  headers: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  tokenPersistence: tokenPersistenceSchema.optional(),
} as const

const callToolModeSchema = z
  .object({
    mode: z.literal('call-tool'),
    url: z.string().min(1),
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
    ...modeFields,
  })
  .describe('Call a tool on a remote MCP server')

const listToolsModeSchema = z
  .object({ mode: z.literal('list-tools'), url: z.string().min(1), ...modeFields })
  .describe('List available tools from a remote MCP server')

const listPromptsModeSchema = z
  .object({ mode: z.literal('list-prompts'), url: z.string().min(1), ...modeFields })
  .describe('List available prompts from a remote MCP server')

const getPromptModeSchema = z
  .object({
    mode: z.literal('get-prompt'),
    url: z.string().min(1),
    name: z.string().min(1),
    args: z.record(z.string(), z.string()).optional(),
    ...modeFields,
  })
  .describe('Get a specific prompt from a remote MCP server')

const listResourcesModeSchema = z
  .object({ mode: z.literal('list-resources'), url: z.string().min(1), ...modeFields })
  .describe('List available resources from a remote MCP server')

const readResourceModeSchema = z
  .object({
    mode: z.literal('read-resource'),
    url: z.string().min(1),
    uri: z.string().min(1),
    ...modeFields,
  })
  .describe('Read a resource from a remote MCP server by URI')

const discoverModeSchema = z
  .object({ mode: z.literal('discover'), url: z.string().min(1), ...modeFields })
  .describe('Discover all capabilities from a remote MCP server')

const McpClientInputSchema = z
  .discriminatedUnion('mode', [
    callToolModeSchema,
    listToolsModeSchema,
    listPromptsModeSchema,
    getPromptModeSchema,
    listResourcesModeSchema,
    readResourceModeSchema,
    discoverModeSchema,
  ])
  .describe('MCP client operation to perform')

const McpClientOutputSchema = z
  .discriminatedUnion('mode', [
    z.object({
      mode: z.literal('call-tool'),
      result: z.object({
        content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()),
        isError: z.boolean().optional(),
      }),
    }),
    z.object({ mode: z.literal('list-tools'), result: z.array(z.any()) }),
    z.object({ mode: z.literal('list-prompts'), result: z.array(z.any()) }),
    z.object({ mode: z.literal('get-prompt'), result: z.array(z.any()) }),
    z.object({ mode: z.literal('list-resources'), result: z.array(z.any()) }),
    z.object({ mode: z.literal('read-resource'), result: z.array(z.any()) }),
    z.object({
      mode: z.literal('discover'),
      result: z.object({
        tools: z.array(z.any()),
        prompts: z.array(z.any()),
        resources: z.array(z.any()),
      }),
    }),
  ])
  .describe('MCP client operation result')

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type McpContent = { type: string; text?: string; [key: string]: unknown }
type McpCallToolResult = { content: McpContent[]; isError?: boolean }
type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> }
type McpPromptArgument = { name: string; description?: string; required?: boolean }
type McpPrompt = { name: string; description?: string; arguments?: McpPromptArgument[] }
type McpPromptMessage = { role: 'user' | 'assistant'; content: McpContent }
type McpResource = { uri: string; name: string; description?: string; mimeType?: string }
type McpResourceContent = { uri: string; text?: string; blob?: string; mimeType?: string }
type McpServerCapabilities = {
  tools: McpTool[]
  prompts: McpPrompt[]
  resources: McpResource[]
}
type RemoteMcpSecret = {
  envVar: string
  optional?: boolean
  description?: string
}
type RemoteMcpTokenPersistence = { kind: 'file'; path?: string } | { kind: 'env' }
type RemoteMcpOauthClientAuthentication = 'client_secret_basic' | 'client_secret_post' | 'none'

type RemoteMcpAuthConfig =
  | { type: 'none' }
  | {
      type: 'bearer-env'
      token: RemoteMcpSecret
      headerName?: string
      prefix?: string
    }
  | {
      type: 'static-headers'
      headers: Record<string, string>
    }
  | {
      type: 'oauth-client-credentials'
      issuer?: string
      tokenUrl: string
      clientId: RemoteMcpSecret
      clientSecret?: RemoteMcpSecret
      scopes?: string[]
      audience?: string
      resource?: string
      clientAuthentication?: RemoteMcpOauthClientAuthentication
      tokenPersistence?: RemoteMcpTokenPersistence
    }
  | {
      type: 'oauth-refresh-token'
      issuer?: string
      tokenUrl: string
      clientId: RemoteMcpSecret
      clientSecret?: RemoteMcpSecret
      refreshToken: RemoteMcpSecret
      scopes?: string[]
      audience?: string
      resource?: string
      clientAuthentication?: RemoteMcpOauthClientAuthentication
      tokenPersistence?: RemoteMcpTokenPersistence
    }

type McpSessionOptions = {
  headers?: Record<string, string>
  authProvider?: import('@modelcontextprotocol/sdk/client/auth.js').OAuthClientProvider
  timeoutMs?: number
}

type McpSessionApi = {
  listTools: () => Promise<McpTool[]>
  callTool: (name: string, args: Record<string, unknown>) => Promise<McpCallToolResult>
  listPrompts: () => Promise<McpPrompt[]>
  getPrompt: (name: string, args?: Record<string, string>) => Promise<McpPromptMessage[]>
  listResources: () => Promise<McpResource[]>
  readResource: (uri: string) => Promise<McpResourceContent[]>
  discover: () => Promise<McpServerCapabilities>
  [Symbol.asyncDispose]: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BEARER_PREFIX = 'Bearer'
const TOKEN_EXPIRY_SKEW_MS = 30_000
const CLIENT_INFO = { name: 'plaited', version: '0.0.0' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resolveEnvSecret = async (secret: RemoteMcpSecret): Promise<string | undefined> => {
  const envValue = Bun.env[secret.envVar]
  if (envValue !== undefined && envValue !== '') return envValue
  if (secret.optional) return undefined
  throw new Error(
    `Missing required env var ${secret.envVar}. Set it before invoking the MCP client, or mark it optional.`,
  )
}

const resolveRequiredSecret = async (secret: RemoteMcpSecret, label: string): Promise<string> => {
  const value = await resolveEnvSecret(secret)
  if (value) return value
  throw new Error(`${label} env var ${secret.envVar} resolved to an empty value. Check your environment.`)
}

const defaultTokenCachePath = (url: string): string => {
  const home = Bun.env.HOME ?? Bun.env.USERPROFILE ?? '.'
  const host = new URL(url).hostname
  return `${home}/.plaited/mcp/tokens/${host}.json`
}

const encodeBasicAuth = (username: string, password: string) =>
  Buffer.from(`${username}:${password}`).toString('base64')

const getScopeString = (scopes?: string[]) => (scopes && scopes.length > 0 ? scopes.join(' ') : undefined)

type InMemoryOAuthTokens = import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokens & {
  expiresAtMs?: number
}

const withExpiry = (tokens: import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokens): InMemoryOAuthTokens => ({
  ...tokens,
  expiresAtMs: tokens.expires_in === undefined ? undefined : Date.now() + tokens.expires_in * 1000,
})

const isAccessTokenFresh = (tokens: InMemoryOAuthTokens | undefined) =>
  Boolean(tokens?.access_token) &&
  (tokens?.expiresAtMs === undefined || tokens.expiresAtMs - Date.now() > TOKEN_EXPIRY_SKEW_MS)

// ---------------------------------------------------------------------------
// Token persistence (file-backed)
// ---------------------------------------------------------------------------

const readPersistedRefreshToken = async (
  url: string,
  persistence?: RemoteMcpTokenPersistence,
): Promise<string | undefined> => {
  if (!persistence || persistence.kind === 'env') return undefined
  const path = persistence.path ?? defaultTokenCachePath(url)
  try {
    const file = Bun.file(path)
    if (!(await file.exists())) return undefined
    const data = (await file.json()) as { refreshToken?: string }
    return data.refreshToken
  } catch {
    return undefined
  }
}

const writePersistedRefreshToken = async (
  url: string,
  refreshToken: string | undefined,
  persistence?: RemoteMcpTokenPersistence,
): Promise<void> => {
  if (!persistence || persistence.kind === 'env' || !refreshToken) return
  const path = persistence.path ?? defaultTokenCachePath(url)
  await Bun.write(path, JSON.stringify({ refreshToken }, null, 2))
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

const buildOAuthRequest = async (
  auth: Extract<RemoteMcpAuthConfig, { type: 'oauth-client-credentials' | 'oauth-refresh-token' }>,
  refreshTokenOverride?: string,
): Promise<{ headers: Headers; params: URLSearchParams }> => {
  const params = new URLSearchParams()
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  })

  const clientId = await resolveRequiredSecret(auth.clientId, 'OAuth client ID')
  const clientSecret = auth.clientSecret ? await resolveEnvSecret(auth.clientSecret) : undefined
  const clientAuthentication = auth.clientAuthentication ?? (clientSecret ? 'client_secret_basic' : 'none')

  params.set('grant_type', auth.type === 'oauth-client-credentials' ? 'client_credentials' : 'refresh_token')

  if (auth.type === 'oauth-refresh-token') {
    const rt = refreshTokenOverride ?? (await resolveRequiredSecret(auth.refreshToken, 'OAuth refresh token'))
    if (!rt) throw new Error('Missing refresh token for OAuth refresh-token flow')
    params.set('refresh_token', rt)
  }

  const scope = getScopeString(auth.scopes)
  if (scope) params.set('scope', scope)
  if (auth.audience) params.set('audience', auth.audience)
  if (auth.resource) params.set('resource', auth.resource)

  switch (clientAuthentication) {
    case 'client_secret_basic':
      if (!clientSecret) throw new Error('client_secret_basic requires clientSecret')
      headers.set('Authorization', `Basic ${encodeBasicAuth(clientId, clientSecret)}`)
      break
    case 'client_secret_post':
      params.set('client_id', clientId)
      if (clientSecret) params.set('client_secret', clientSecret)
      break
    case 'none':
      params.set('client_id', clientId)
      break
  }

  return { headers, params }
}

const exchangeOAuthTokens = async (
  auth: Extract<RemoteMcpAuthConfig, { type: 'oauth-client-credentials' | 'oauth-refresh-token' }>,
  refreshTokenOverride?: string,
): Promise<import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokens> => {
  const { headers, params } = await buildOAuthRequest(auth, refreshTokenOverride)
  const response = await fetch(auth.tokenUrl, {
    method: 'POST',
    headers,
    body: params.toString(),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OAuth token request failed (${response.status}): ${body}`)
  }

  const json = (await response.json()) as Partial<import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokens>
  if (!json.access_token || !json.token_type) {
    throw new Error('OAuth token response missing access_token or token_type')
  }

  return json as import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokens
}

const createOAuthProvider = (
  auth: Extract<RemoteMcpAuthConfig, { type: 'oauth-client-credentials' | 'oauth-refresh-token' }>,
  url: string,
): import('@modelcontextprotocol/sdk/client/auth.js').OAuthClientProvider => {
  let cachedTokens: InMemoryOAuthTokens | undefined
  let loadedPersisted = false
  let persistedRefreshToken: string | undefined

  const loadRefreshToken = async (): Promise<string | undefined> => {
    if (auth.type !== 'oauth-refresh-token') return undefined
    if (!loadedPersisted) {
      persistedRefreshToken = await readPersistedRefreshToken(url, auth.tokenPersistence)
      loadedPersisted = true
    }
    return persistedRefreshToken ?? resolveEnvSecret(auth.refreshToken)
  }

  const ensureTokens = async (): Promise<InMemoryOAuthTokens> => {
    if (isAccessTokenFresh(cachedTokens)) return cachedTokens as InMemoryOAuthTokens

    const refreshToken = auth.type === 'oauth-refresh-token' ? await loadRefreshToken() : undefined
    const nextTokens = await exchangeOAuthTokens(auth, refreshToken)

    const newRefresh =
      nextTokens.refresh_token ??
      cachedTokens?.refresh_token ??
      (auth.type === 'oauth-refresh-token' ? refreshToken : undefined)

    cachedTokens = withExpiry({ ...nextTokens, ...(newRefresh ? { refresh_token: newRefresh } : {}) })

    if (auth.type === 'oauth-refresh-token' && nextTokens.refresh_token) {
      persistedRefreshToken = nextTokens.refresh_token
      await writePersistedRefreshToken(url, nextTokens.refresh_token, auth.tokenPersistence)
    }

    return cachedTokens
  }

  return {
    get redirectUrl() {
      return undefined
    },
    get clientMetadata() {
      return {
        redirect_uris: [],
        grant_types: [auth.type === 'oauth-client-credentials' ? 'client_credentials' : 'refresh_token'],
        token_endpoint_auth_method: auth.clientAuthentication === 'none' ? undefined : auth.clientAuthentication,
        client_name: 'plaited remote mcp',
        scope: getScopeString(auth.scopes),
      }
    },
    clientInformation: async (): Promise<
      import('@modelcontextprotocol/sdk/shared/auth.js').OAuthClientInformationMixed | undefined
    > => {
      const clientId = await resolveRequiredSecret(auth.clientId, 'OAuth client ID')
      const clientSecret = auth.clientSecret ? await resolveEnvSecret(auth.clientSecret) : undefined
      return { client_id: clientId, ...(clientSecret ? { client_secret: clientSecret } : {}) }
    },
    tokens: () => ensureTokens(),
    saveTokens: async (tokens: import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokens) => {
      const newRefresh = tokens.refresh_token ?? cachedTokens?.refresh_token
      cachedTokens = withExpiry({ ...tokens, ...(newRefresh ? { refresh_token: newRefresh } : {}) })
      if (auth.type === 'oauth-refresh-token' && tokens.refresh_token) {
        persistedRefreshToken = tokens.refresh_token
        await writePersistedRefreshToken(url, tokens.refresh_token, auth.tokenPersistence)
      }
    },
    redirectToAuthorization() {
      throw new Error('Interactive OAuth authorization not supported')
    },
    saveCodeVerifier() {},
    codeVerifier() {
      return ''
    },
    invalidateCredentials: async () => {
      cachedTokens = undefined
    },
  }
}

// ---------------------------------------------------------------------------
// Auth resolution
// ---------------------------------------------------------------------------

const resolveAuth = async (config: RemoteMcpAuthConfig, url: string): Promise<McpSessionOptions> => {
  switch (config.type) {
    case 'none':
      return {}
    case 'bearer-env': {
      const token = await resolveEnvSecret(config.token)
      if (!token) return {}
      const prefix = config.prefix ?? DEFAULT_BEARER_PREFIX
      const headerValue = prefix === '' ? token : `${prefix} ${token}`
      return { headers: { [config.headerName ?? 'Authorization']: headerValue } }
    }
    case 'static-headers':
      return { headers: { ...config.headers } }
    case 'oauth-client-credentials':
    case 'oauth-refresh-token':
      return { authProvider: createOAuthProvider(config, url) }
  }
}

const resolveSessionOptions = async (input: Record<string, unknown>): Promise<McpSessionOptions> => {
  const options: McpSessionOptions = {}
  if (input.headers) options.headers = { ...(input.headers as Record<string, string>) }
  if (input.timeoutMs) options.timeoutMs = input.timeoutMs as number
  if (input.auth) {
    const authOptions = await resolveAuth(input.auth as RemoteMcpAuthConfig, input.url as string)
    if (authOptions.headers) {
      options.headers = { ...options.headers, ...authOptions.headers }
    }
    if (authOptions.authProvider) {
      options.authProvider = authOptions.authProvider
    }
  }
  return options
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

const createTransport = (url: string, options: McpSessionOptions): Transport =>
  new StreamableHTTPClientTransport(new URL(url), {
    requestInit: options.headers ? { headers: options.headers } : undefined,
    authProvider: options.authProvider,
  })

const createSession = async (url: string, options: McpSessionOptions): Promise<McpSessionApi> => {
  const client = new Client(CLIENT_INFO)
  await client.connect(createTransport(url, options))

  const withTimeout = <T>(fn: () => Promise<T>): Promise<T> => {
    if (!options.timeoutMs) return fn()
    return new Promise<T>((resolve, reject) => {
      const signal = AbortSignal.timeout(options.timeoutMs!)
      signal.addEventListener(
        'abort',
        () => reject(new Error(`MCP operation timed out after ${options.timeoutMs}ms`)),
        { once: true },
      )
      fn().then(resolve, reject)
    })
  }

  const close = async () => {
    try {
      await client.close()
    } catch {
      /* best-effort */
    }
  }

  return {
    listTools: () => withTimeout(async () => (await client.listTools()).tools),
    callTool: (name, args) =>
      withTimeout(async () => (await client.callTool({ name, arguments: args })) as McpCallToolResult),
    listPrompts: () => withTimeout(async () => (await client.listPrompts()).prompts),
    getPrompt: (name, args) =>
      withTimeout(async () => (await client.getPrompt({ name, arguments: args })).messages as McpPromptMessage[]),
    listResources: () => withTimeout(async () => (await client.listResources()).resources),
    readResource: (uri) =>
      withTimeout(async () => (await client.readResource({ uri })).contents as McpResourceContent[]),
    discover: () =>
      withTimeout(async () => {
        const [tools, prompts, resources] = await Promise.allSettled([
          client.listTools(),
          client.listPrompts(),
          client.listResources(),
        ])
        return {
          tools: tools.status === 'fulfilled' ? tools.value.tools : [],
          prompts: prompts.status === 'fulfilled' ? prompts.value.prompts : [],
          resources: resources.status === 'fulfilled' ? resources.value.resources : [],
        }
      }),
    [Symbol.asyncDispose]: close,
  }
}

// ---------------------------------------------------------------------------
// Generic MCP fetch helper
// ---------------------------------------------------------------------------

const mcpFetch = async <T>(
  url: string,
  method: (session: McpSessionApi) => Promise<T>,
  options: McpSessionOptions,
): Promise<T> => {
  const session = await createSession(url, options)
  try {
    return await method(session)
  } finally {
    await session[Symbol.asyncDispose]()
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

const run = async (input: unknown): Promise<z.infer<typeof McpClientOutputSchema>> => {
  const parsed = McpClientInputSchema.parse(input)
  const options = await resolveSessionOptions(parsed as Record<string, unknown>)

  switch (parsed.mode) {
    case 'call-tool':
      return {
        mode: 'call-tool',
        result: await mcpFetch(parsed.url, (s) => s.callTool(parsed.tool, parsed.args), options),
      }
    case 'list-tools':
      return { mode: 'list-tools', result: await mcpFetch(parsed.url, (s) => s.listTools(), options) }
    case 'list-prompts':
      return { mode: 'list-prompts', result: await mcpFetch(parsed.url, (s) => s.listPrompts(), options) }
    case 'get-prompt':
      return {
        mode: 'get-prompt',
        result: await mcpFetch(parsed.url, (s) => s.getPrompt(parsed.name, parsed.args), options),
      }
    case 'list-resources':
      return { mode: 'list-resources', result: await mcpFetch(parsed.url, (s) => s.listResources(), options) }
    case 'read-resource':
      return { mode: 'read-resource', result: await mcpFetch(parsed.url, (s) => s.readResource(parsed.uri), options) }
    case 'discover':
      return { mode: 'discover', result: await mcpFetch(parsed.url, (s) => s.discover(), options) }
  }
}

export const mcpClientCli = makeCli({
  name: 'mcp-client',
  inputSchema: McpClientInputSchema,
  outputSchema: McpClientOutputSchema,
  help: [
    'Call tools, list capabilities, and interact with remote MCP servers.',
    '',
    'Modes:',
    '  call-tool        Call a tool on a remote MCP server',
    '  list-tools       List available tools from a remote MCP server',
    '  list-prompts     List available prompts from a remote MCP server',
    '  get-prompt       Get a specific prompt from a remote MCP server',
    '  list-resources   List available resources from a remote MCP server',
    '  read-resource    Read a resource from a remote MCP server',
    '  discover         Discover all capabilities from a remote MCP server',
    '',
    'Each mode accepts optional auth, headers, timeoutMs, and tokenPersistence fields.',
  ].join('\n'),
  run,
})
