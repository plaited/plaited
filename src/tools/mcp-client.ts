/**
 * Agent-facing MCP client for calling remote MCP servers.
 *
 * @remarks
 * A `useTool` unit ({@link useTool}) wrapping the seven MCP client operations:
 * `call-tool`, `list-tools`, `list-prompts`, `get-prompt`, `list-resources`,
 * `read-resource`, and `discover`. Connections are pooled in
 * {@link getSharedClient} (one live `Client` per server-url, reused across
 * calls); the tool never closes a client itself — the pool owns teardown.
 *
 * The tool returns remote MCP data only; it never writes to any store.
 *
 * @packageDocumentation
 */

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { JSONSchemaType } from 'ajv'
import { getSharedClient, type McpDiscovery, setPoolDiscovery } from '../kernel/use-plugin-adapter.ts'
import { ajv, useTool } from './use-tool.ts'

// ---------------------------------------------------------------------------
// Internal MCP types
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

// ---------------------------------------------------------------------------
// Auth types (single source: the Zod schema below)
// ---------------------------------------------------------------------------

type RemoteMcpSecret = {
  envVar: string
  optional?: boolean
  description?: string
}
type RemoteMcpTokenPersistence = { kind: 'file'; path?: string } | { kind: 'env' }
type RemoteMcpOauthClientAuthentication = 'client_secret_basic' | 'client_secret_post' | 'none'

type RemoteMcpAuthConfig =
  | { type: 'none' }
  | { type: 'bearer-env'; token: RemoteMcpSecret; headerName?: string; prefix?: string }
  | { type: 'static-headers'; headers: Record<string, string> }
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

// ---------------------------------------------------------------------------
// Auth JSON schema — single source for auth-shape validation, compiled once
// with AJV. The model-facing input schema treats `auth` as a permissive object;
// the tool validates it at the trust boundary here (no parallel schema source,
// no Zod). Structural discriminated union on `type` per AGENTS.md.
// ---------------------------------------------------------------------------

const remoteMcpSecretJsonSchema = {
  type: 'object',
  properties: {
    envVar: { type: 'string', minLength: 1 },
    optional: { type: 'boolean', nullable: true },
    description: { type: 'string', nullable: true },
  },
  required: ['envVar'],
  additionalProperties: false,
} as const

const tokenPersistenceJsonSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        kind: { type: 'string', const: 'file' },
        path: { type: 'string', nullable: true },
      },
      required: ['kind'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { kind: { type: 'string', const: 'env' } },
      required: ['kind'],
      additionalProperties: false,
    },
  ],
} as const

const authConfigJsonSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: { type: { type: 'string', const: 'none' } },
      required: ['type'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'bearer-env' },
        token: remoteMcpSecretJsonSchema,
        headerName: { type: 'string', minLength: 1, nullable: true },
        prefix: { type: 'string', nullable: true },
      },
      required: ['type', 'token'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'static-headers' },
        headers: { type: 'object', additionalProperties: { type: 'string' } },
      },
      required: ['type', 'headers'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'oauth-client-credentials' },
        issuer: { type: 'string', nullable: true },
        tokenUrl: { type: 'string', minLength: 1 },
        clientId: remoteMcpSecretJsonSchema,
        clientSecret: { ...remoteMcpSecretJsonSchema, nullable: true },
        scopes: { type: 'array', items: { type: 'string', minLength: 1 }, nullable: true },
        audience: { type: 'string', minLength: 1, nullable: true },
        resource: { type: 'string', minLength: 1, nullable: true },
        clientAuthentication: {
          type: 'string',
          enum: ['client_secret_basic', 'client_secret_post', 'none'],
          nullable: true,
        },
        tokenPersistence: { ...tokenPersistenceJsonSchema, nullable: true },
      },
      required: ['type', 'tokenUrl', 'clientId'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'oauth-refresh-token' },
        issuer: { type: 'string', nullable: true },
        tokenUrl: { type: 'string', minLength: 1 },
        clientId: remoteMcpSecretJsonSchema,
        clientSecret: { ...remoteMcpSecretJsonSchema, nullable: true },
        refreshToken: remoteMcpSecretJsonSchema,
        scopes: { type: 'array', items: { type: 'string', minLength: 1 }, nullable: true },
        audience: { type: 'string', minLength: 1, nullable: true },
        resource: { type: 'string', minLength: 1, nullable: true },
        clientAuthentication: {
          type: 'string',
          enum: ['client_secret_basic', 'client_secret_post', 'none'],
          nullable: true,
        },
        tokenPersistence: { ...tokenPersistenceJsonSchema, nullable: true },
      },
      required: ['type', 'tokenUrl', 'clientId', 'refreshToken'],
      additionalProperties: false,
    },
  ],
} as const

const validateAuth = ajv.compile(authConfigJsonSchema)

// ---------------------------------------------------------------------------
// Tool input / output types (discriminated unions on `mode`)
// ---------------------------------------------------------------------------

type SharedInputFields = {
  url: string
  auth?: RemoteMcpAuthConfig
  headers?: Record<string, string>
  timeoutMs?: number
}

export type McpClientInput =
  | ({ mode: 'call-tool'; tool: string; args: Record<string, unknown> } & SharedInputFields)
  | ({ mode: 'list-tools' } & SharedInputFields)
  | ({ mode: 'list-prompts' } & SharedInputFields)
  | ({ mode: 'get-prompt'; name: string; args?: Record<string, string> } & SharedInputFields)
  | ({ mode: 'list-resources' } & SharedInputFields)
  | ({ mode: 'read-resource'; uri: string } & SharedInputFields)
  | ({ mode: 'discover' } & SharedInputFields)

export type McpClientOutput =
  | { mode: 'call-tool'; result: McpCallToolResult }
  | { mode: 'list-tools'; result: McpTool[] }
  | { mode: 'list-prompts'; result: McpPrompt[] }
  | { mode: 'get-prompt'; result: McpPromptMessage[] }
  | { mode: 'list-resources'; result: McpResource[] }
  | { mode: 'read-resource'; result: McpResourceContent[] }
  | { mode: 'discover'; result: McpServerCapabilities }

// ---------------------------------------------------------------------------
// Tool JSON schemas — hand-written oneOf with `mode` as the discriminator
// const per branch. JSONSchemaType cannot statically verify a discriminated
// union, so the whole object is cast through `unknown` — same pattern as
// read.ts / frontier.ts. AJV validates the shape at runtime. `auth` and
// `args` are permissive objects here; the tool validates `auth` at the
// boundary via `authConfigSchema` above (single source).
// ---------------------------------------------------------------------------

const authJsonSchema = {
  type: 'object',
  additionalProperties: true,
  nullable: true,
  description: 'auth config — validated at the boundary (none | bearer-env | static-headers | oauth-*)',
} as const

// Shared optional fields present on every mode branch.
const sharedInputFields = {
  auth: authJsonSchema,
  headers: {
    type: 'object',
    additionalProperties: { type: 'string' },
    nullable: true,
    description: 'extra HTTP headers to send with MCP requests',
  },
  timeoutMs: {
    type: 'integer',
    minimum: 1,
    nullable: true,
    description: 'per-operation timeout in milliseconds',
  },
} as const

export const McpClientInputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'call-tool' },
        url: { type: 'string', minLength: 1, description: 'remote MCP server URL' },
        tool: { type: 'string', minLength: 1, description: 'tool name to call' },
        args: {
          type: 'object',
          additionalProperties: true,
          description: 'tool arguments — a JSON object, validated at the boundary',
        },
        ...sharedInputFields,
      },
      required: ['mode', 'url', 'tool', 'args'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'list-tools' },
        url: { type: 'string', minLength: 1, description: 'remote MCP server URL' },
        ...sharedInputFields,
      },
      required: ['mode', 'url'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'list-prompts' },
        url: { type: 'string', minLength: 1, description: 'remote MCP server URL' },
        ...sharedInputFields,
      },
      required: ['mode', 'url'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'get-prompt' },
        url: { type: 'string', minLength: 1, description: 'remote MCP server URL' },
        name: { type: 'string', minLength: 1, description: 'prompt name' },
        args: {
          type: 'object',
          additionalProperties: { type: 'string' },
          nullable: true,
          description: 'prompt arguments',
        },
        ...sharedInputFields,
      },
      required: ['mode', 'url', 'name'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'list-resources' },
        url: { type: 'string', minLength: 1, description: 'remote MCP server URL' },
        ...sharedInputFields,
      },
      required: ['mode', 'url'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'read-resource' },
        url: { type: 'string', minLength: 1, description: 'remote MCP server URL' },
        uri: { type: 'string', minLength: 1, description: 'resource URI to read' },
        ...sharedInputFields,
      },
      required: ['mode', 'url', 'uri'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'discover' },
        url: { type: 'string', minLength: 1, description: 'remote MCP server URL' },
        ...sharedInputFields,
      },
      required: ['mode', 'url'],
      additionalProperties: false,
    },
  ],
  description:
    'MCP client operation to perform (call-tool | list-tools | list-prompts | get-prompt | list-resources | read-resource | discover).',
} as unknown as JSONSchemaType<McpClientInput>

const mcpContentJsonSchema = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    text: { type: 'string', nullable: true },
  },
  required: ['type'],
  additionalProperties: true,
} as const

export const McpClientOutputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'call-tool' },
        result: {
          type: 'object',
          properties: {
            content: { type: 'array', items: mcpContentJsonSchema },
            isError: { type: 'boolean', nullable: true },
          },
          required: ['content'],
          additionalProperties: true,
        },
      },
      required: ['mode', 'result'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'list-tools' },
        result: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
      required: ['mode', 'result'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'list-prompts' },
        result: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
      required: ['mode', 'result'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'get-prompt' },
        result: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
      required: ['mode', 'result'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'list-resources' },
        result: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
      required: ['mode', 'result'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'read-resource' },
        result: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
      required: ['mode', 'result'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'discover' },
        result: {
          type: 'object',
          properties: {
            tools: { type: 'array', items: { type: 'object', additionalProperties: true } },
            prompts: { type: 'array', items: { type: 'object', additionalProperties: true } },
            resources: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
          required: ['tools', 'prompts', 'resources'],
          additionalProperties: true,
        },
      },
      required: ['mode', 'result'],
      additionalProperties: false,
    },
  ],
  description: 'MCP client operation result, discriminated by mode.',
} as unknown as JSONSchemaType<McpClientOutput>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MCP_CLIENT_TOOL_NAME = 'mcp-client'
const DEFAULT_BEARER_PREFIX = 'Bearer'
const TOKEN_EXPIRY_SKEW_MS = 30_000

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

type InMemoryOAuthTokens = OAuthTokens & {
  expiresAtMs?: number
}

const withExpiry = (tokens: OAuthTokens): InMemoryOAuthTokens => ({
  ...tokens,
  expiresAtMs: tokens.expires_in === undefined ? undefined : Date.now() + tokens.expires_in * 1000,
})

const isAccessTokenFresh = (tokens: InMemoryOAuthTokens | undefined) =>
  Boolean(tokens?.access_token) &&
  (tokens?.expiresAtMs === undefined || tokens.expiresAtMs - Date.now() > TOKEN_EXPIRY_SKEW_MS)

// ---------------------------------------------------------------------------
// Token persistence (file-backed).
//
// MINIMAL: file persistence under ~/.plaited/mcp/tokens/<host>.json. Upgrade
// path (Slice C): replace with a BunKeychainOAuthProvider backed by
// Bun.secrets and upgrade to the v2 OAuthClientProvider shape (issuer-keyed
// clientInformation(ctx), state()/saveDiscoveryState/discoveryState(),
// validateResourceURL with RFC 9207 iss validation).
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
): Promise<OAuthTokens> => {
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

  const json = (await response.json()) as Partial<OAuthTokens>
  if (!json.access_token || !json.token_type) {
    throw new Error('OAuth token response missing access_token or token_type')
  }

  return json as OAuthTokens
}

const createOAuthProvider = (
  auth: Extract<RemoteMcpAuthConfig, { type: 'oauth-client-credentials' | 'oauth-refresh-token' }>,
  url: string,
): OAuthClientProvider => {
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
    clientInformation: async (): Promise<OAuthClientInformationMixed | undefined> => {
      const clientId = await resolveRequiredSecret(auth.clientId, 'OAuth client ID')
      const clientSecret = auth.clientSecret ? await resolveEnvSecret(auth.clientSecret) : undefined
      return { client_id: clientId, ...(clientSecret ? { client_secret: clientSecret } : {}) }
    },
    tokens: () => ensureTokens(),
    saveTokens: async (tokens: OAuthTokens) => {
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
// Auth + session-option resolution
// ---------------------------------------------------------------------------

type ResolvedSessionOptions = {
  headers?: Record<string, string>
  authProvider?: OAuthClientProvider
  timeoutMs?: number
}

const resolveAuth = async (config: RemoteMcpAuthConfig, url: string): Promise<ResolvedSessionOptions> => {
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

const resolveSessionOptions = async (input: {
  url: string
  auth?: RemoteMcpAuthConfig
  headers?: Record<string, string>
  timeoutMs?: number
}): Promise<ResolvedSessionOptions> => {
  const options: ResolvedSessionOptions = {}
  if (input.headers) options.headers = { ...input.headers }
  if (input.timeoutMs) options.timeoutMs = input.timeoutMs
  if (input.auth) {
    // Boundary validation — the model-facing schema is permissive; this is the
    // single source (authConfigJsonSchema, AJV-compiled) that defines the auth
    // shape. No Zod, no parallel schema source.
    if (!validateAuth(input.auth)) {
      throw new Error(`Invalid auth config: ${ajv.errorsText(validateAuth.errors)}`)
    }
    const validated = input.auth as RemoteMcpAuthConfig
    const authOptions = await resolveAuth(validated, input.url)
    if (authOptions.headers) options.headers = { ...options.headers, ...authOptions.headers }
    if (authOptions.authProvider) options.authProvider = authOptions.authProvider
  }
  return options
}

// ---------------------------------------------------------------------------
// Operation helpers (operate on a pooled client; never close it)
// ---------------------------------------------------------------------------

const withTimeout = <T>(timeoutMs: number | undefined, fn: () => Promise<T>): Promise<T> => {
  if (!timeoutMs) return fn()
  return new Promise<T>((resolve, reject) => {
    const signal = AbortSignal.timeout(timeoutMs)
    signal.addEventListener('abort', () => reject(new Error(`MCP operation timed out after ${timeoutMs}ms`)), {
      once: true,
    })
    fn().then(resolve, reject)
  })
}

const discoverCapabilities = async (client: Client, timeoutMs?: number): Promise<McpServerCapabilities> => {
  const [tools, prompts, resources] = await Promise.allSettled([
    withTimeout(timeoutMs, async () => (await client.listTools()).tools),
    withTimeout(timeoutMs, async () => (await client.listPrompts()).prompts),
    withTimeout(timeoutMs, async () => (await client.listResources()).resources),
  ])
  return {
    tools: tools.status === 'fulfilled' ? (tools.value as McpTool[]) : [],
    prompts: prompts.status === 'fulfilled' ? (prompts.value as McpPrompt[]) : [],
    resources: resources.status === 'fulfilled' ? (resources.value as McpResource[]) : [],
  }
}

// ---------------------------------------------------------------------------
// Tool run
// ---------------------------------------------------------------------------

const run = async (input: McpClientInput): Promise<McpClientOutput> => {
  const { url, auth, headers, timeoutMs } = input
  const options = await resolveSessionOptions({ url, auth, headers, timeoutMs })
  const client = await getSharedClient(url, options)

  switch (input.mode) {
    case 'call-tool': {
      const result = (await withTimeout(timeoutMs, () =>
        client.callTool({ name: input.tool, arguments: input.args }),
      )) as McpCallToolResult
      return { mode: 'call-tool', result }
    }
    case 'list-tools': {
      const result = (await withTimeout(timeoutMs, async () => (await client.listTools()).tools)) as McpTool[]
      return { mode: 'list-tools', result }
    }
    case 'list-prompts': {
      const result = (await withTimeout(timeoutMs, async () => (await client.listPrompts()).prompts)) as McpPrompt[]
      return { mode: 'list-prompts', result }
    }
    case 'get-prompt': {
      const result = (await withTimeout(
        timeoutMs,
        async () => (await client.getPrompt({ name: input.name, arguments: input.args })).messages,
      )) as McpPromptMessage[]
      return { mode: 'get-prompt', result }
    }
    case 'list-resources': {
      const result = (await withTimeout(
        timeoutMs,
        async () => (await client.listResources()).resources,
      )) as McpResource[]
      return { mode: 'list-resources', result }
    }
    case 'read-resource': {
      const result = (await withTimeout(
        timeoutMs,
        async () => (await client.readResource({ uri: input.uri })).contents,
      )) as McpResourceContent[]
      return { mode: 'read-resource', result }
    }
    case 'discover': {
      // MINIMAL: the connection-level discover cache is write-only here — we
      // always re-discover and refresh the cache. A refresh-aware mode (or a
      // TTL) can read getPoolDiscovery later to skip the round-trip.
      const result = await discoverCapabilities(client, timeoutMs)
      setPoolDiscovery(url, result satisfies McpDiscovery)
      return { mode: 'discover', result }
    }
  }
}

// ---------------------------------------------------------------------------
// useTool registration
// ---------------------------------------------------------------------------

/**
 * Call tools, list capabilities, and interact with remote MCP servers.
 *
 * Seven modes: `call-tool`, `list-tools`, `list-prompts`, `get-prompt`,
 * `list-resources`, `read-resource`, `discover`. Connections are pooled per
 * server-url and reused across calls. Returns remote MCP data only — never
 * writes a store.
 */
export const mcpClient = useTool(
  {
    name: MCP_CLIENT_TOOL_NAME,
    description:
      'Call tools and list capabilities on remote MCP servers. Seven modes: ' +
      'call-tool, list-tools, list-prompts, get-prompt, list-resources, ' +
      'read-resource, discover. Connections are pooled per server-url and ' +
      'reused across calls. Returns remote MCP data only — never writes a store.',
    inputSchema: McpClientInputSchema,
    outputSchema: McpClientOutputSchema,
  },
  run,
)
