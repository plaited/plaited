import { afterEach, describe, expect, test } from 'bun:test'

import { RUNTIME_SERVER_CONFIG, runVllm } from '../../engines/vllm.ts'

const originalFetch = globalThis.fetch

describe('runVllm', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('checks the default runtime health endpoint', async () => {
    const healthUrls: string[] = []
    globalThis.fetch = (async (url: string | URL | Request) => {
      healthUrls.push(String(url))
      return new Response(null, { status: 200 })
    }) as typeof fetch

    await expect(runVllm({ mode: 'health', runtime: 'analyst' })).resolves.toEqual({
      mode: 'health',
      ok: true,
    })
    expect(healthUrls).toEqual([`http://127.0.0.1:${RUNTIME_SERVER_CONFIG.analyst.port}/health`])
  })

  test('checks an overridden runtime health endpoint', async () => {
    const healthUrls: string[] = []
    globalThis.fetch = (async (url: string | URL | Request) => {
      healthUrls.push(String(url))
      return new Response(null, { status: 503 })
    }) as typeof fetch

    await expect(runVllm({ mode: 'health', runtime: 'coder', port: 9002 })).resolves.toEqual({
      mode: 'health',
      ok: false,
    })
    expect(healthUrls).toEqual(['http://127.0.0.1:9002/health'])
  })
})
