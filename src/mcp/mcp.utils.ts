import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import packageJson from '../../package.json' with { type: 'json' }
import { ConfiguredRemoteMcpOptionsSchema, McpManifestSchema, RemoteMcpAuthConfigSchema } from './mcp.schemas.ts'

/** @public */
export type McpContent = { type: string; text?: string; [key: string]: unknown }
/** @public */
export type McpCallToolResult = { content: McpContent[]; isError?: boolean }
/** @public */
export type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> }
/** @public */
export type McpPromptArgument = { name: string; description?: string; required?: boolean }
/** @public */
export type McpPrompt = { name: string; description?: string; arguments?: McpPromptArgument[] }
/** @public */
export type McpPromptMessage = { role: 'user' | 'assistant'; content: McpContent }
/** @public */
export type McpResource = {
  uri: string
  name: string
  description?: string
  mimeType?: string
}
/** @public */
export type McpResourceContent = {
  uri: string
  text?: string
  blob?: string
  mimeType?: string
}
/** @public */
export type McpServerCapabilities = {
  tools: McpTool[]
  prompts: McpPrompt[]
  resources: McpResource[]
}
/** @public */
export type McpSessionOptions = {
  timeoutMs?: number
}
/** @public */
export type RemoteMcpOptions = {
  headers?: Record<string, string>
  authProvider?: OAuthClientProvider
  timeoutMs?: number
}
/** @public */
export type RemoteMcpSecretStorageKind = 'env' | 'varlock-1password' | 'system-keychain' | 'external'
/** @public */
export type RemoteMcpSecretStorage = {
  kind: RemoteMcpSecretStorageKind
  reference?: string
}
/** @public */
export type RemoteMcpSecret = {
  envVar: string
  storage?: RemoteMcpSecretStorage
  optional?: boolean
  description?: string
}
/** @public */
export type RemoteMcpTokenPersistenceKind = 'memory' | 'system-keychain' | 'external'
/** @public */
export type RemoteMcpTokenPersistence = {
  kind: RemoteMcpTokenPersistenceKind
  key?: string
  note?: string
}
/** @public */
export type RemoteMcpOauthClientAuthentication = 'client_secret_basic' | 'client_secret_post' | 'none'
/** @public */
export type RemoteMcpAuthConfig =
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
/** @public */
export type ConfiguredRemoteMcpOptions = {
  headers?: Record<string, string>
  timeoutMs?: number
  auth?: RemoteMcpAuthConfig
}
/** @public */
export type RemoteMcpRefreshMaterial = {
  refreshToken?: string
}
/** @public */
export type RemoteMcpRefreshMaterialStore = {
  load: () => Promise<RemoteMcpRefreshMaterial | undefined> | RemoteMcpRefreshMaterial | undefined
  save: (material: RemoteMcpRefreshMaterial) => Promise<void> | void
  clear?: () => Promise<void> | void
}
/** @public */
export type RemoteMcpSecretResolver = (secret: RemoteMcpSecret) => Promise<string | undefined> | string | undefined
/** @public */
export type ResolveRemoteMcpRuntime = {
  refreshMaterialStore?: RemoteMcpRefreshMaterialStore
  secretResolver?: RemoteMcpSecretResolver
}
/** @public */
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
const DEFAULT_BEARER_PREFIX = 'Bearer'
const TOKEN_EXPIRY_SKEW_MS = 30_000

type InMemoryOAuthTokens = OAuthTokens & { expiresAtMs?: number }
type OAuthAuthConfig = Extract<RemoteMcpAuthConfig, { type: 'oauth-client-credentials' | 'oauth-refresh-token' }>

const getSecretStorageKind = (secret: RemoteMcpSecret) => secret.storage?.kind ?? 'env'

const getSecretResolutionHint = (secret: RemoteMcpSecret) => {
  switch (getSecretStorageKind(secret)) {
    case 'varlock-1password':
      return 'Inject it into the environment with Varlock/1Password or pass a custom secretResolver.'
    case 'system-keychain':
      return 'Expose it as an environment variable or pass a custom secretResolver for keychain access.'
    case 'external':
      return 'Expose it as an environment variable or pass a custom secretResolver for your external secret store.'
    default:
      return 'Set the environment variable before invoking the MCP wrapper.'
  }
}

const getScopeString = (scopes?: string[]) => (scopes && scopes.length > 0 ? scopes.join(' ') : undefined)

const withExpiry = (tokens: OAuthTokens): InMemoryOAuthTokens => ({
  ...tokens,
  expiresAtMs: tokens.expires_in === undefined ? undefined : Date.now() + tokens.expires_in * 1000,
})

const isAccessTokenFresh = (tokens: InMemoryOAuthTokens | undefined) =>
  Boolean(tokens?.access_token) &&
  (tokens?.expiresAtMs === undefined || tokens.expiresAtMs - Date.now() > TOKEN_EXPIRY_SKEW_MS)

const encodeBasicAuth = (username: string, password: string) =>
  Buffer.from(`${username}:${password}`).toString('base64')

/**
 * Resolves a declared remote MCP secret from the environment by default.
 *
 * @public
 */
export const resolveRemoteMcpSecret = async (
  secret: RemoteMcpSecret,
  runtime?: ResolveRemoteMcpRuntime,
): Promise<string | undefined> => {
  const resolvedByRuntime = await runtime?.secretResolver?.(secret)
  if (resolvedByRuntime !== undefined) {
    return resolvedByRuntime
  }

  const envValue = Bun.env[secret.envVar]
  if (envValue !== undefined && envValue !== '') {
    return envValue
  }

  if (secret.optional) {
    return undefined
  }

  throw new Error(
    `Missing remote MCP secret env var ${secret.envVar} (storage: ${getSecretStorageKind(secret)}). ${getSecretResolutionHint(secret)}`,
  )
}

const resolveRequiredRemoteMcpSecret = async ({
  secret,
  runtime,
  label,
}: {
  secret: RemoteMcpSecret
  runtime?: ResolveRemoteMcpRuntime
  label: string
}) => {
  const value = await resolveRemoteMcpSecret(secret, runtime)
  if (value) {
    return value
  }

  throw new Error(
    `Remote MCP ${label} secret ${secret.envVar} resolved to an empty value. Check your env or secret resolver configuration.`,
  )
}

const createBearerHeaderValue = ({ prefix, token }: { prefix?: string; token: string }) =>
  prefix === '' ? token : `${prefix ?? DEFAULT_BEARER_PREFIX} ${token}`

const createOAuthClientMetadata = (auth: OAuthAuthConfig): OAuthClientMetadata => ({
  redirect_uris: [],
  grant_types: [auth.type === 'oauth-client-credentials' ? 'client_credentials' : 'refresh_token'],
  token_endpoint_auth_method: auth.clientAuthentication === 'none' ? undefined : auth.clientAuthentication,
  client_name: 'plaited remote mcp',
  scope: getScopeString(auth.scopes),
})

const createOAuthRequestParams = async ({
  auth,
  runtime,
  refreshToken,
}: {
  auth: OAuthAuthConfig
  runtime?: ResolveRemoteMcpRuntime
  refreshToken?: string
}) => {
  const params = new URLSearchParams()
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  })
  const clientId = await resolveRequiredRemoteMcpSecret({
    label: 'OAuth client ID',
    runtime,
    secret: auth.clientId,
  })
  const clientSecret = auth.clientSecret ? await resolveRemoteMcpSecret(auth.clientSecret, runtime) : undefined
  const clientAuthentication =
    auth.clientAuthentication ?? (clientSecret ? ('client_secret_basic' as const) : ('none' as const))

  if (auth.type === 'oauth-client-credentials') {
    params.set('grant_type', 'client_credentials')
  } else {
    params.set('grant_type', 'refresh_token')
    const resolvedRefreshToken =
      refreshToken ??
      (await resolveRequiredRemoteMcpSecret({
        label: 'OAuth refresh token',
        runtime,
        secret: auth.refreshToken,
      }))

    if (!resolvedRefreshToken) {
      throw new Error('Missing refresh token for remote MCP OAuth refresh-token flow')
    }

    params.set('refresh_token', resolvedRefreshToken)
  }

  const scope = getScopeString(auth.scopes)
  if (scope) {
    params.set('scope', scope)
  }

  if (auth.audience) {
    params.set('audience', auth.audience)
  }

  if (auth.resource) {
    params.set('resource', auth.resource)
  }

  switch (clientAuthentication) {
    case 'client_secret_basic':
      if (!clientSecret) {
        throw new Error('client_secret_basic requires clientSecret for remote MCP OAuth auth')
      }
      headers.set('Authorization', `Basic ${encodeBasicAuth(clientId ?? '', clientSecret)}`)
      break
    case 'client_secret_post':
      params.set('client_id', clientId ?? '')
      if (clientSecret) {
        params.set('client_secret', clientSecret)
      }
      break
    case 'none':
      params.set('client_id', clientId ?? '')
      break
  }

  return { headers, params, clientId, clientSecret }
}

const requestOAuthTokens = async ({
  auth,
  runtime,
  refreshToken,
}: {
  auth: OAuthAuthConfig
  runtime?: ResolveRemoteMcpRuntime
  refreshToken?: string
}): Promise<OAuthTokens> => {
  const { headers, params } = await createOAuthRequestParams({ auth, runtime, refreshToken })
  const response = await fetch(auth.tokenUrl, {
    body: params.toString(),
    headers,
    method: 'POST',
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Remote MCP OAuth token request failed (${response.status}): ${body}`)
  }

  const json = (await response.json()) as Partial<OAuthTokens>
  if (!json.access_token || !json.token_type) {
    throw new Error('Remote MCP OAuth token response did not include access_token and token_type')
  }

  return json as OAuthTokens
}

/**
 * Creates an SDK-compatible OAuth provider from declarative remote MCP auth config.
 *
 * @public
 */
export const createConfiguredOAuthClientProvider = (
  auth: Extract<RemoteMcpAuthConfig, { type: 'oauth-client-credentials' | 'oauth-refresh-token' }>,
  runtime?: ResolveRemoteMcpRuntime,
): OAuthClientProvider => {
  const clientMetadata = createOAuthClientMetadata(auth)
  let cachedTokens: InMemoryOAuthTokens | undefined
  let cachedRefreshMaterial: RemoteMcpRefreshMaterial | undefined
  let didLoadRefreshMaterial = false

  const loadRefreshMaterial = async () => {
    if (didLoadRefreshMaterial) {
      return cachedRefreshMaterial
    }

    cachedRefreshMaterial = await runtime?.refreshMaterialStore?.load()
    didLoadRefreshMaterial = true
    return cachedRefreshMaterial
  }

  const getRefreshToken = async () => {
    if (auth.type !== 'oauth-refresh-token') {
      return undefined
    }

    const storedRefreshToken = (await loadRefreshMaterial())?.refreshToken
    if (storedRefreshToken) {
      return storedRefreshToken
    }

    return resolveRequiredRemoteMcpSecret({
      label: 'OAuth refresh token',
      runtime,
      secret: auth.refreshToken,
    })
  }

  const saveRefreshToken = async (refreshToken: string | undefined) => {
    if (auth.type !== 'oauth-refresh-token' || !refreshToken) {
      return
    }

    cachedRefreshMaterial = { refreshToken }
    didLoadRefreshMaterial = true
    await runtime?.refreshMaterialStore?.save({ refreshToken })
  }

  const saveTokens = async (tokens: OAuthTokens) => {
    const refreshToken =
      tokens.refresh_token ??
      cachedTokens?.refresh_token ??
      (auth.type === 'oauth-refresh-token' ? await getRefreshToken() : undefined)
    cachedTokens = withExpiry({
      ...tokens,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    })
    await saveRefreshToken(refreshToken)
  }

  const ensureTokens = async () => {
    if (isAccessTokenFresh(cachedTokens)) {
      return cachedTokens
    }

    const nextTokens = await requestOAuthTokens({
      auth,
      runtime,
      refreshToken: auth.type === 'oauth-refresh-token' ? await getRefreshToken() : undefined,
    })
    await saveTokens(nextTokens)
    return cachedTokens
  }

  return {
    get redirectUrl() {
      return undefined
    },
    get clientMetadata() {
      return clientMetadata
    },
    clientInformation: async (): Promise<OAuthClientInformationMixed | undefined> => {
      const clientId = await resolveRequiredRemoteMcpSecret({
        label: 'OAuth client ID',
        runtime,
        secret: auth.clientId,
      })
      const clientSecret = auth.clientSecret ? await resolveRemoteMcpSecret(auth.clientSecret, runtime) : undefined
      return {
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
      }
    },
    tokens: async () => ensureTokens(),
    saveTokens,
    redirectToAuthorization() {
      throw new Error('Interactive OAuth authorization is not supported for this remote MCP provider')
    },
    saveCodeVerifier() {},
    codeVerifier() {
      return ''
    },
    invalidateCredentials: async (scope) => {
      cachedTokens = undefined
      if ((scope === 'all' || scope === 'tokens') && runtime?.refreshMaterialStore?.clear) {
        cachedRefreshMaterial = undefined
        didLoadRefreshMaterial = true
        await runtime.refreshMaterialStore.clear()
      }
    },
  }
}

/**
 * Resolves declarative auth config into transport options for remote MCP helpers.
 *
 * @public
 */
export const resolveRemoteMcpAuthOptions = async (
  auth: RemoteMcpAuthConfig,
  runtime?: ResolveRemoteMcpRuntime,
): Promise<Pick<RemoteMcpOptions, 'authProvider' | 'headers'>> => {
  const parsed = RemoteMcpAuthConfigSchema.parse(auth) as RemoteMcpAuthConfig

  switch (parsed.type) {
    case 'none':
      return {}
    case 'bearer-env': {
      const token = await resolveRemoteMcpSecret(parsed.token, runtime)
      return token
        ? {
            headers: {
              [parsed.headerName ?? 'Authorization']: createBearerHeaderValue({ prefix: parsed.prefix, token }),
            },
          }
        : {}
    }
    case 'static-headers':
      return { headers: { ...parsed.headers } }
    case 'oauth-client-credentials':
    case 'oauth-refresh-token':
      return {
        authProvider: createConfiguredOAuthClientProvider(parsed, runtime),
      }
  }
}

/**
 * Resolves checked-in remote MCP config into runtime connection options.
 *
 * @public
 */
export const resolveConfiguredRemoteMcpOptions = async (
  config: ConfiguredRemoteMcpOptions,
  runtime?: ResolveRemoteMcpRuntime,
): Promise<RemoteMcpOptions> => {
  const parsed = ConfiguredRemoteMcpOptionsSchema.parse(config) as ConfiguredRemoteMcpOptions
  const authOptions = parsed.auth ? await resolveRemoteMcpAuthOptions(parsed.auth, runtime) : {}

  return {
    timeoutMs: parsed.timeoutMs,
    authProvider: authOptions.authProvider,
    headers: {
      ...parsed.headers,
      ...authOptions.headers,
    },
  }
}

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

/**
 * Normalizes manifest capability records into array form.
 *
 * @public
 */
export const normalizeMcpManifestCapabilities = (manifest: McpManifest): McpServerCapabilities => ({
  tools: normalizeManifestEntries(manifest.capabilities.tools),
  prompts: normalizeManifestEntries(manifest.capabilities.prompts),
  resources: normalizeManifestEntries(manifest.capabilities.resources),
})

/**
 * Fetches and validates an MCP manifest from a remote endpoint.
 *
 * @public
 */
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

/**
 * Connects an MCP client to an already-created transport.
 *
 * @public
 */
export const mcpConnect = async (transport: Transport) => {
  const client = new Client(CLIENT_INFO)
  await client.connect(transport)
  return client
}

/** @public */
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
 * Creates an MCP session wrapper around a connected transport.
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

/**
 * Creates a streamable HTTP transport for a remote MCP endpoint.
 *
 * @public
 */
export const createRemoteMcpTransport = (url: string, options?: RemoteMcpOptions) =>
  new StreamableHTTPClientTransport(new URL(url), {
    requestInit: options?.headers ? { headers: options.headers } : undefined,
    authProvider: options?.authProvider,
  })

/**
 * Creates an MCP session for a remote streamable HTTP endpoint.
 *
 * @public
 */
export const createRemoteMcpSession = async (url: string, options?: RemoteMcpOptions): Promise<McpSession> =>
  createMcpSession(createRemoteMcpTransport(url, options), { timeoutMs: options?.timeoutMs })

/**
 * Connects an MCP client directly to a remote streamable HTTP endpoint.
 *
 * @public
 */
export const remoteMcpConnect = async (url: string, options?: RemoteMcpOptions) => {
  const transport = createRemoteMcpTransport(url, options)
  return mcpConnect(transport)
}

/** @public */
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

/** @public */
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

/** @public */
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

/** @public */
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

/** @public */
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

/** @public */
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

/** @public */
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
