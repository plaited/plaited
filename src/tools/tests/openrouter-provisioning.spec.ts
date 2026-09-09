import { describe, expect, test } from 'bun:test'
import { InMemoryKeychain, type Keychain } from '../../kernel/oauth/keychain.ts'
import { createModelTools } from '../model.ts'
import { startOpenResponsesServer } from './model-server-fixture.ts'

/**
 * Tests for OpenRouter model provisioning (Q8/E step 5).
 *
 * The provisioning flow: plugin.json declares a model with `apiKeyRef:
 * 'openrouter'`. At provisioning time, the caller resolves the key from the
 * keychain (populated from `OPENROUTER_API_KEY` env) and builds a
 * `ModelEndpointConfig` with the resolved `apiKey`. The tool never sees the
 * `apiKeyRef` — it only sees the resolved config. No key is hardcoded.
 *
 * These tests use the loopback fixture as the endpoint, with the keychain
 * populated as `OPENROUTER_API_KEY` env would populate it.
 */

describe('OpenRouter provisioning — apiKeyRef → keychain → endpoint config', () => {
  test('resolves apiKeyRef from the keychain and provisions the endpoint', async () => {
    // Simulate the provisioning step: the keychain holds the OpenRouter key
    // under the 'openrouter' name (matching apiKeyRef in plugin.json).
    const keychain: Keychain = InMemoryKeychain()
    await keychain.set('openrouter', 'sk-openrouter-test-key')

    // The provisioner reads the keychain and builds the endpoint config.
    const apiKey = await keychain.get('openrouter')
    expect(apiKey).toBe('sk-openrouter-test-key')

    // The endpoint config carries the full base URL (per Part 0's contract).
    const server = await startOpenResponsesServer({ apiKey: 'sk-openrouter-test-key' })
    try {
      const { modelRespond } = createModelTools({
        endpoints: {
          openrouter: {
            url: `${server.url}/api/v1`,
            apiKey: apiKey ?? undefined,
          },
        },
      })
      const out = await modelRespond({
        provider: 'openrouter',
        modelId: 'z-ai/glm-5.3-flash',
        input: [{ type: 'message', role: 'user', content: 'Say OK' }],
      })
      const success = out as { items: unknown[]; status: string; isError?: boolean }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')
      // The fixture recorded the bearer token from the keychain-resolved key.
      expect(server.requests[0]!.auth).toBe('Bearer sk-openrouter-test-key')
    } finally {
      await server.close()
    }
  })

  test('provisioning without a key still works (key is optional)', async () => {
    const keychain: Keychain = InMemoryKeychain()
    // No key set — provisioning returns null, endpoint has no apiKey.
    const apiKey = await keychain.get('openrouter')
    expect(apiKey).toBeNull()

    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({
        endpoints: {
          openrouter: { url: server.url },
        },
      })
      const out = await modelRespond({
        provider: 'openrouter',
        modelId: 'z-ai/glm-5.3-flash',
        input: [{ type: 'message', role: 'user', content: 'Say OK' }],
      })
      const success = out as { items: unknown[]; status: string; isError?: boolean }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')
    } finally {
      await server.close()
    }
  })

  test('the endpoint URL is the full base (OpenRouter base-with-path)', async () => {
    // Prove the OpenRouter base URL (https://openrouter.ai/api/v1) would
    // produce /api/v1/responses — not /api/v1/v1/responses.
    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({
        endpoints: {
          openrouter: { url: `${server.url}/api/v1` },
        },
      })
      const out = await modelRespond({
        provider: 'openrouter',
        modelId: 'z-ai/glm-5.3-flash',
        input: [{ type: 'message', role: 'user', content: 'Say OK' }],
      })
      const success = out as { items: unknown[]; status: string; isError?: boolean }
      expect(success.isError).toBeUndefined()
      // The request hit /api/v1/responses — the correct join for a
      // base-with-path endpoint.
      expect(server.requests[0]!.path).toBe('/api/v1/responses')
    } finally {
      await server.close()
    }
  })
})
