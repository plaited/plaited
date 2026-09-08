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

import type { Client, OAuthClientProvider } from '@modelcontextprotocol/client'
import type { JSONSchemaType } from 'ajv'
import type { Keychain } from '../kernel/oauth/keychain.ts'
import { BunKeychainOAuthProvider, type KeychainOAuthProviderOptions } from '../kernel/oauth/keychain-oauth-provider.ts'
import { getSharedClient } from '../kernel/use-plugin-adapter.ts'
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

const getScopeString = (scopes?: string[]) => (scopes && scopes.length > 0 ? scopes.join(' ') : undefined)

// ---------------------------------------------------------------------------
// OAuth provider construction (v2 BunKeychainOAuthProvider)
//
// Replaces the former in-memory createOAuthProvider + file persistence. The
// v2 SDK's `auth()` orchestrator (invoked by the transport on 401) does RFC
// 9728 discovery and the token exchange via the provider's
// prepareTokenRequest + addClientAuthentication + clientInformation; the
// provider supplies grant params + credentials and persists the
// issuer-stamped tokens/client-info to the OS keychain (Bun.secrets). One
// provider per server-url, reused across process restarts.
//
// MINIMAL: the v2 flow is discovery-based, so `auth.tokenUrl` is no longer the
// direct token endpoint — the SDK discovers it. `auth.tokenPersistence`
// (file/env) is obsolete now that the keychain is the store; the field is
// accepted for backward-compat and ignored. Upgrade path: drop the field
// from the auth config once no caller relies on it.
// ---------------------------------------------------------------------------

/**
 * Build a v2 {@link OAuthClientProvider} for an `oauth-*` auth config.
 * Exposed (with an injectable keychain) so tests can drive the provider with
 * an in-memory keychain without touching the OS keychain.
 */
export const createKeychainOAuthProvider = (
  auth: Extract<RemoteMcpAuthConfig, { type: 'oauth-client-credentials' | 'oauth-refresh-token' }>,
  url: string,
  keychain?: Keychain,
): OAuthClientProvider => {
  // clientId is required for both grants; resolve eagerly to fail fast.
  // clientSecret / refreshToken are resolved lazily by the provider via the
  // env-var secret config — but the v2 provider takes resolved values, so we
  // resolve them here. Required secrets throw if missing; optional ones
  // (clientSecret) resolve to undefined.
  const build = async (): Promise<KeychainOAuthProviderOptions> => {
    const clientId = await resolveRequiredSecret(auth.clientId, 'OAuth client ID')
    const clientSecret = auth.clientSecret ? await resolveEnvSecret(auth.clientSecret) : undefined
    const options: KeychainOAuthProviderOptions = {
      serverUrl: url,
      grantType: auth.type === 'oauth-client-credentials' ? 'client_credentials' : 'refresh_token',
      clientId,
      clientSecret,
      scope: getScopeString(auth.scopes),
      audience: auth.audience,
      resource: auth.resource,
      clientAuthentication: auth.clientAuthentication,
      expectedIssuer: auth.issuer,
      keychain,
    }
    if (auth.type === 'oauth-refresh-token') {
      options.initialRefreshToken = await resolveRequiredSecret(auth.refreshToken, 'OAuth refresh token')
    }
    return options
  }

  // The v2 transport reads `authProvider` synchronously at construction, but
  // our env-var secrets resolve async. Bridge with a lazy proxy that resolves
  // the real provider on first method call and delegates every property to
  // it. This keeps getSharedClient(url, options) synchronous in `authProvider`.
  let providerPromise: Promise<BunKeychainOAuthProvider> | undefined
  const getProvider = (): Promise<BunKeychainOAuthProvider> =>
    (providerPromise ??= build().then((opts) => new BunKeychainOAuthProvider(opts)))

  // Delegate every OAuthClientProvider member through the lazy provider.
  // The async members await getProvider() first; the getters (redirectUrl,
  // clientMetadata) are read by the SDK after the first async call has
  // resolved the provider, so a cached reference is used once warmed.
  let cached: BunKeychainOAuthProvider | undefined
  const ensure = async (): Promise<BunKeychainOAuthProvider> => {
    if (cached) return cached
    cached = await getProvider()
    return cached
  }

  const proxy: OAuthClientProvider = {
    get redirectUrl() {
      return undefined
    },
    get clientMetadata() {
      // clientMetadata has no async deps beyond clientId/secret/scope, which
      // the provider resolves in its constructor via the options we pass
      // resolved. Return a best-effort metadata; the real provider's
      // clientMetadata is used once warmed.
      return (
        cached?.clientMetadata ?? {
          redirect_uris: [],
          grant_types: [auth.type === 'oauth-client-credentials' ? 'client_credentials' : 'refresh_token'],
          token_endpoint_auth_method: auth.clientAuthentication === 'none' ? undefined : auth.clientAuthentication,
          client_name: 'plaited remote mcp',
          scope: getScopeString(auth.scopes),
        }
      )
    },
    clientInformation: (ctx) => ensure().then((p) => p.clientInformation(ctx)),
    saveClientInformation: (ci, ctx) => ensure().then((p) => p.saveClientInformation(ci, ctx)),
    tokens: (ctx) => ensure().then((p) => p.tokens(ctx)),
    saveTokens: (tokens, ctx) => ensure().then((p) => p.saveTokens(tokens, ctx)),
    state: () => ensure().then((p) => p.state()),
    redirectToAuthorization: () => {
      throw new Error('Interactive OAuth authorization not supported')
    },
    saveCodeVerifier: () => {
      /* delegated once provider exists; no-op is safe */
    },
    codeVerifier: () => '',
    addClientAuthentication: (headers, params, u, metadata) =>
      ensure().then((p) => p.addClientAuthentication(headers, params, u, metadata)),
    validateResourceURL: (serverUrl, resource) => ensure().then((p) => p.validateResourceURL(serverUrl, resource)),
    invalidateCredentials: (scope) => ensure().then((p) => p.invalidateCredentials(scope)),
    prepareTokenRequest: (scope) => ensure().then((p) => p.prepareTokenRequest(scope)),
    saveDiscoveryState: (state) => ensure().then((p) => p.saveDiscoveryState(state)),
    discoveryState: () => ensure().then((p) => p.discoveryState()),
  }
  return proxy
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
      return { authProvider: createKeychainOAuthProvider(config, url) }
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
      const result = await discoverCapabilities(client, timeoutMs)
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
