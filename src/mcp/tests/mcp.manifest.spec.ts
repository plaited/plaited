import { describe, expect, test } from 'bun:test'
import { normalizeMcpManifestCapabilities } from '../mcp.utils.ts'

describe('normalizeMcpManifestCapabilities', () => {
  test('normalizes record-shaped manifest capabilities into arrays', () => {
    const capabilities = normalizeMcpManifestCapabilities({
      server: { name: 'Bun', transport: 'http', version: '1.0.0' },
      capabilities: {
        tools: {
          search_bun: {
            name: 'search_bun',
            description: 'Search Bun docs',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
              required: ['query'],
            },
          },
        },
        prompts: {},
        resources: [],
      },
    })

    expect(capabilities.tools).toHaveLength(1)
    expect(capabilities.tools[0]?.name).toBe('search_bun')
    expect(capabilities.prompts).toEqual([])
    expect(capabilities.resources).toEqual([])
  })
})
