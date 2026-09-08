import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import {
  PluginLoaderInputSchema,
  PluginLoaderOutputSchema,
  PluginManifestSchema,
  pluginLoader,
} from '../plugin-loader.ts'
import { ajv } from '../use-tool.ts'

const validateInput = ajv.compile(PluginLoaderInputSchema)
const validateOutput = ajv.compile(PluginLoaderOutputSchema)
const validateManifest = ajv.compile(PluginManifestSchema)

const tempDir = async (): Promise<string> => (await Bun.$`mktemp -d`.quiet().text()).trim()

const writePlugin = async (dir: string, manifest: unknown): Promise<string> => {
  const file = path.join(dir, 'plugin.json')
  await Bun.write(file, JSON.stringify(manifest))
  return file
}

describe('plugin-loader tool — schema contract (RED)', () => {
  test('input schema requires path + cwd', () => {
    expect(validateInput({ path: 'plugin.json' })).toBe(false)
    expect(validateInput({ cwd: '/x' })).toBe(false)
    expect(validateInput({ path: 'plugin.json', cwd: '/x' })).toBe(true)
  })

  test('manifest schema accepts a full valid manifest', () => {
    expect(
      validateManifest({
        mcps: [{ url: 'https://srv.example.com/mcp', name: 'docs', description: 'doc server' }],
        skills: ['./skills/echo/SKILL.md'],
        models: [
          {
            provider: 'openai',
            modelId: 'gpt-4o',
            endpointUrl: 'https://api.openai.com/v1',
            apiKeyRef: 'OPENAI_API_KEY',
            locality: 'remote',
          },
        ],
        threads: ['./threads/provision.ts'],
      }),
    ).toBe(true)
  })

  test('manifest schema accepts empty arrays for each group', () => {
    expect(validateManifest({ mcps: [], skills: [], models: [], threads: [] })).toBe(true)
  })

  test('manifest schema rejects a missing group', () => {
    expect(validateManifest({ mcps: [], skills: [], models: [] })).toBe(false)
    expect(validateManifest({ mcps: [], skills: [], threads: [] })).toBe(false)
  })

  test('manifest schema rejects an unknown top-level field', () => {
    expect(validateManifest({ mcps: [], skills: [], models: [], threads: [], extra: 1 })).toBe(false)
  })
})

describe('plugin-loader tool — mcps group', () => {
  test('mcps entry requires url', () => {
    expect(validateManifest({ mcps: [{ name: 'x' }], skills: [], models: [], threads: [] })).toBe(false)
    expect(validateManifest({ mcps: [{ url: 'https://x/mcp' }], skills: [], models: [], threads: [] })).toBe(true)
  })

  test('mcps entry rejects an unknown field', () => {
    expect(
      validateManifest({ mcps: [{ url: 'https://x/mcp', auth: 'none' }], skills: [], models: [], threads: [] }),
    ).toBe(false)
  })
})

describe('plugin-loader tool — skills + threads groups', () => {
  test('skills is an array of non-empty path strings', () => {
    expect(validateManifest({ mcps: [], skills: ['./a/SKILL.md', ''], models: [], threads: [] })).toBe(false)
    expect(validateManifest({ mcps: [], skills: ['./a/SKILL.md'], models: [], threads: [] })).toBe(true)
  })

  test('threads is an array of non-empty behavior-file paths', () => {
    expect(validateManifest({ mcps: [], skills: [], models: [], threads: ['./t.ts', 5] })).toBe(false)
    expect(validateManifest({ mcps: [], skills: [], models: [], threads: ['./t.ts'] })).toBe(true)
  })
})

describe('plugin-loader tool — models group', () => {
  test('model requires provider, modelId, endpointUrl', () => {
    expect(
      validateManifest({
        mcps: [],
        skills: [],
        models: [{ provider: 'openai', modelId: 'gpt-4o' }],
        threads: [],
      }),
    ).toBe(false)
  })

  test('model accepts apiKeyRef (a key name, not the key) and optional locality', () => {
    expect(
      validateManifest({
        mcps: [],
        skills: [],
        models: [{ provider: 'openai', modelId: 'gpt-4o', endpointUrl: 'https://x', apiKeyRef: 'OPENAI_API_KEY' }],
        threads: [],
      }),
    ).toBe(true)
  })

  test('model rejects a raw apiKey field — secrets stay in the keychain', () => {
    expect(
      validateManifest({
        mcps: [],
        skills: [],
        models: [{ provider: 'openai', modelId: 'gpt-4o', endpointUrl: 'https://x', apiKey: 'sk-secret' }],
        threads: [],
      }),
    ).toBe(false)
  })

  test('model rejects an unknown field', () => {
    expect(
      validateManifest({
        mcps: [],
        skills: [],
        models: [{ provider: 'openai', modelId: 'gpt-4o', endpointUrl: 'https://x', temperature: 0.7 }],
        threads: [],
      }),
    ).toBe(false)
  })
})

describe('plugin-loader tool — run against real plugin.json files', () => {
  test('parses a valid plugin.json into the declaration groups', async () => {
    const dir = await tempDir()
    try {
      const file = await writePlugin(dir, {
        mcps: [{ url: 'https://srv.example.com/mcp', name: 'docs' }],
        skills: ['./skills/echo/SKILL.md'],
        models: [
          {
            provider: 'openai',
            modelId: 'gpt-4o',
            endpointUrl: 'https://api.openai.com/v1',
            apiKeyRef: 'OPENAI_API_KEY',
          },
        ],
        threads: ['./threads/provision.ts'],
      })
      const result = (await pluginLoader({ path: path.basename(file), cwd: dir })) as {
        mcps: { url: string }[]
        skills: string[]
        models: { provider: string }[]
        threads: string[]
      }
      expect(validateOutput(result)).toBe(true)
      expect(result.mcps[0]?.url).toBe('https://srv.example.com/mcp')
      expect(result.skills).toEqual(['./skills/echo/SKILL.md'])
      expect(result.models[0]?.provider).toBe('openai')
      expect(result.threads).toEqual(['./threads/provision.ts'])
    } finally {
      await Bun.$`rm -rf ${dir}`.quiet().nothrow()
    }
  })

  test('returns isError when the plugin.json path does not exist', async () => {
    const dir = await tempDir()
    try {
      const result = (await pluginLoader({ path: 'missing.json', cwd: dir })) as {
        isError?: boolean
        message?: string
      }
      expect(validateOutput(result)).toBe(true)
      expect(result.isError).toBe(true)
      expect(result.message).toContain('missing.json')
    } finally {
      await Bun.$`rm -rf ${dir}`.quiet().nothrow()
    }
  })

  test('returns isError when the file is not valid JSON', async () => {
    const dir = await tempDir()
    try {
      const file = path.join(dir, 'plugin.json')
      await Bun.write(file, '{ not json')
      const result = (await pluginLoader({ path: 'plugin.json', cwd: dir })) as {
        isError?: boolean
        message?: string
      }
      expect(validateOutput(result)).toBe(true)
      expect(result.isError).toBe(true)
      expect(result.message).toContain('JSON')
    } finally {
      await Bun.$`rm -rf ${dir}`.quiet().nothrow()
    }
  })

  test('returns isError when the manifest fails structural validation', async () => {
    const dir = await tempDir()
    try {
      const file = await writePlugin(dir, {
        mcps: [{ name: 'no-url' }],
        skills: [],
        models: [],
        threads: [],
      })
      const result = (await pluginLoader({ path: path.basename(file), cwd: dir })) as {
        isError?: boolean
        message?: string
      }
      expect(validateOutput(result)).toBe(true)
      expect(result.isError).toBe(true)
      expect(result.message).toContain('manifest')
    } finally {
      await Bun.$`rm -rf ${dir}`.quiet().nothrow()
    }
  })

  test('rejects a manifest with a raw apiKey in a model at the tool boundary', async () => {
    const dir = await tempDir()
    try {
      const file = await writePlugin(dir, {
        mcps: [],
        skills: [],
        models: [{ provider: 'openai', modelId: 'gpt-4o', endpointUrl: 'https://x', apiKey: 'sk-secret' }],
        threads: [],
      })
      const result = (await pluginLoader({ path: path.basename(file), cwd: dir })) as {
        isError?: boolean
        message?: string
      }
      expect(result.isError).toBe(true)
    } finally {
      await Bun.$`rm -rf ${dir}`.quiet().nothrow()
    }
  })
})
