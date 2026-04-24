import { afterEach, describe, expect, test } from 'bun:test'
import { ConfiguredRemoteMcpOptionsSchema, RemoteMcpAuthConfigSchema } from '../mcp.schemas.ts'
import {
  type RemoteMcpRefreshMaterial,
  resolveConfiguredRemoteMcpOptions,
  resolveRemoteMcpAuthOptions,
  resolveRemoteMcpSecret,
} from '../mcp.utils.ts'

const originalFetch = globalThis.fetch
const envKeys = [
  'PLAITED_MCP_BEARER_TOKEN',
  'PLAITED_MCP_CLIENT_ID',
  'PLAITED_MCP_CLIENT_SECRET',
  'PLAITED_MCP_REFRESH_TOKEN',
]

const restoreEnv = () => {
  for (const key of envKeys) {
    delete Bun.env[key]
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch
  restoreEnv()
})

describe('RemoteMcpAuthConfigSchema', () => {
  test('accepts refresh-token auth with storage metadata and env var names', () => {
    const parsed = RemoteMcpAuthConfigSchema.parse({
      type: 'oauth-refresh-token',
      tokenUrl: 'https://example.com/oauth/token',
      issuer: 'https://example.com',
      clientId: {
        envVar: 'PLAITED_MCP_CLIENT_ID',
        storage: { kind: 'env' },
      },
      clientSecret: {
        envVar: 'PLAITED_MCP_CLIENT_SECRET',
        storage: { kind: 'varlock-1password', reference: 'op://vault/item/client-secret' },
      },
      refreshToken: {
        envVar: 'PLAITED_MCP_REFRESH_TOKEN',
        storage: { kind: 'varlock-1password', reference: 'op://vault/item/refresh-token' },
      },
      scopes: ['mcp:tools'],
      tokenPersistence: {
        kind: 'system-keychain',
        key: 'com.plaited.remote-mcp.example',
      },
    })

    expect(parsed.type).toBe('oauth-refresh-token')
    if (parsed.type !== 'oauth-refresh-token') {
      throw new Error('Expected oauth-refresh-token auth config')
    }
    expect(parsed.refreshToken.storage?.kind).toBe('varlock-1password')
    expect(parsed.tokenPersistence?.kind).toBe('system-keychain')
  })
})

describe('resolveRemoteMcpSecret', () => {
  test('resolves varlock-oriented secrets from env vars', async () => {
    Bun.env.PLAITED_MCP_BEARER_TOKEN = 'secret-from-varlock'

    const resolved = await resolveRemoteMcpSecret({
      envVar: 'PLAITED_MCP_BEARER_TOKEN',
      storage: { kind: 'varlock-1password', reference: 'op://vault/item/token' },
    })

    expect(resolved).toBe('secret-from-varlock')
  })

  test('prefers a custom secret resolver over env lookups', async () => {
    Bun.env.PLAITED_MCP_BEARER_TOKEN = 'env-token'

    const resolved = await resolveRemoteMcpSecret(
      {
        envVar: 'PLAITED_MCP_BEARER_TOKEN',
        storage: { kind: 'external' },
      },
      {
        secretResolver: () => 'resolver-token',
      },
    )

    expect(resolved).toBe('resolver-token')
  })

  test('reports missing env vars with storage hint', async () => {
    await expect(
      resolveRemoteMcpSecret({
        envVar: 'PLAITED_MCP_BEARER_TOKEN',
        storage: { kind: 'varlock-1password' },
      }),
    ).rejects.toThrow('Varlock/1Password')
  })
})

describe('resolveRemoteMcpAuthOptions', () => {
  test('builds bearer auth headers from env-backed config', async () => {
    Bun.env.PLAITED_MCP_BEARER_TOKEN = 'bearer-token'

    const options = await resolveRemoteMcpAuthOptions({
      type: 'bearer-env',
      token: {
        envVar: 'PLAITED_MCP_BEARER_TOKEN',
        storage: { kind: 'varlock-1password' },
      },
    })

    expect(options.headers).toEqual({ Authorization: 'Bearer bearer-token' })
  })
})

describe('resolveConfiguredRemoteMcpOptions', () => {
  test('auth headers override conflicting explicit headers', async () => {
    Bun.env.PLAITED_MCP_BEARER_TOKEN = 'fresh-token'

    const options = await resolveConfiguredRemoteMcpOptions({
      headers: { Authorization: 'Bearer stale-token', 'X-Plaited': '1' },
      auth: {
        type: 'bearer-env',
        token: {
          envVar: 'PLAITED_MCP_BEARER_TOKEN',
          storage: { kind: 'env' },
        },
      },
    })

    expect(options.headers).toEqual({
      Authorization: 'Bearer fresh-token',
      'X-Plaited': '1',
    })
  })

  test('merges explicit headers with parsed config', async () => {
    const parsed = ConfiguredRemoteMcpOptionsSchema.parse({
      headers: { 'X-Plaited': '1' },
      timeoutMs: 20_000,
      auth: { type: 'static-headers', headers: { 'X-Remote': 'enabled' } },
    })

    const options = await resolveConfiguredRemoteMcpOptions(parsed)

    expect(options.timeoutMs).toBe(20_000)
    expect(options.headers).toEqual({
      'X-Plaited': '1',
      'X-Remote': 'enabled',
    })
  })

  test('creates a client-credentials auth provider that mints access tokens in memory', async () => {
    Bun.env.PLAITED_MCP_CLIENT_ID = 'client-id'
    Bun.env.PLAITED_MCP_CLIENT_SECRET = 'client-secret'

    const fetchCalls: Array<{ body: string; headers: Headers; url: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({
        body: String(init?.body ?? ''),
        headers: new Headers(init?.headers),
        url: String(input),
      })

      return new Response(
        JSON.stringify({
          access_token: 'access-token-1',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        },
      )
    }) as unknown as typeof fetch

    const options = await resolveConfiguredRemoteMcpOptions({
      auth: {
        type: 'oauth-client-credentials',
        tokenUrl: 'https://example.com/oauth/token',
        clientId: {
          envVar: 'PLAITED_MCP_CLIENT_ID',
          storage: { kind: 'env' },
        },
        clientSecret: {
          envVar: 'PLAITED_MCP_CLIENT_SECRET',
          storage: { kind: 'varlock-1password' },
        },
        scopes: ['mcp:tools', 'mcp:prompts'],
      },
    })

    const tokensOne = await options.authProvider?.tokens()
    const tokensTwo = await options.authProvider?.tokens()

    expect(tokensOne?.access_token).toBe('access-token-1')
    expect(tokensTwo?.access_token).toBe('access-token-1')
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]?.url).toBe('https://example.com/oauth/token')
    expect(fetchCalls[0]?.headers.get('authorization')).toContain('Basic ')
    expect(fetchCalls[0]?.body).toContain('grant_type=client_credentials')
    expect(fetchCalls[0]?.body).toContain('scope=mcp%3Atools+mcp%3Aprompts')
  })

  test('fails clearly when a required oauth secret resolves empty', async () => {
    const options = await resolveConfiguredRemoteMcpOptions({
      auth: {
        type: 'oauth-client-credentials',
        tokenUrl: 'https://example.com/oauth/token',
        clientId: {
          envVar: 'PLAITED_MCP_CLIENT_ID',
          optional: true,
          storage: { kind: 'env' },
        },
      },
    })

    await expect(options.authProvider?.tokens()).rejects.toThrow('OAuth client ID')
  })

  test('uses refresh-token storage without persisting access tokens', async () => {
    Bun.env.PLAITED_MCP_CLIENT_ID = 'client-id'
    Bun.env.PLAITED_MCP_CLIENT_SECRET = 'client-secret'
    Bun.env.PLAITED_MCP_REFRESH_TOKEN = 'bootstrap-refresh-token'

    const savedRefreshMaterial: RemoteMcpRefreshMaterial[] = []
    let clearCalls = 0

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          access_token: 'access-token-2',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'rotated-refresh-token',
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        },
      )) as unknown as typeof fetch

    const options = await resolveConfiguredRemoteMcpOptions(
      {
        auth: {
          type: 'oauth-refresh-token',
          tokenUrl: 'https://example.com/oauth/token',
          clientId: {
            envVar: 'PLAITED_MCP_CLIENT_ID',
            storage: { kind: 'env' },
          },
          clientSecret: {
            envVar: 'PLAITED_MCP_CLIENT_SECRET',
            storage: { kind: 'varlock-1password' },
          },
          refreshToken: {
            envVar: 'PLAITED_MCP_REFRESH_TOKEN',
            storage: { kind: 'varlock-1password' },
          },
          tokenPersistence: {
            kind: 'external',
            key: 'remote-mcp/example',
          },
        },
      },
      {
        refreshMaterialStore: {
          load: () => undefined,
          save: (material) => {
            savedRefreshMaterial.push(material)
          },
          clear: () => {
            clearCalls += 1
          },
        },
      },
    )

    const tokens = await options.authProvider?.tokens()
    await options.authProvider?.invalidateCredentials?.('tokens')

    expect(tokens?.access_token).toBe('access-token-2')
    expect(savedRefreshMaterial).toEqual([{ refreshToken: 'rotated-refresh-token' }])
    expect(savedRefreshMaterial.some((material) => 'access_token' in material)).toBe(false)
    expect(clearCalls).toBe(1)
  })
})
