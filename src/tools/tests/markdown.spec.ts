import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import {
  MARKDOWN_EXTRACT_LINKS_TOOL_NAME,
  MARKDOWN_FRONTMATTER_TOOL_NAME,
  MARKDOWN_VALIDATE_LINKS_TOOL_NAME,
  markdownExtractLinks,
  markdownFrontmatter,
  markdownValidateLinks,
} from '../markdown.ts'

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  markdownExtractLinks(server)
  markdownValidateLinks(server)
  markdownFrontmatter(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

describe('markdown extract-links tool', () => {
  beforeEach(async () => {
    await setupServer()
  })
  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes markdown tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain(MARKDOWN_EXTRACT_LINKS_TOOL_NAME)
    expect(names).toContain(MARKDOWN_VALIDATE_LINKS_TOOL_NAME)
    expect(names).toContain(MARKDOWN_FRONTMATTER_TOOL_NAME)
  })

  test('extract-links returns sorted local links', async () => {
    const result = await client.callTool({
      name: MARKDOWN_EXTRACT_LINKS_TOOL_NAME,
      arguments: { markdown: '[b](scripts/b.ts) [a](scripts/a.ts) ![d](assets/d.png)' },
    })
    const data = result.structuredContent as { links: Array<{ value: string; text: string }> }
    expect(data.links).toEqual([
      { value: 'assets/d.png', text: 'd' },
      { value: 'scripts/a.ts', text: 'a' },
      { value: 'scripts/b.ts', text: 'b' },
    ])
  })

  test('extract-links returns empty result for no local links', async () => {
    const result = await client.callTool({
      name: MARKDOWN_EXTRACT_LINKS_TOOL_NAME,
      arguments: { markdown: 'Hello **world** [remote](https://example.com)' },
    })
    const data = result.structuredContent as { links: Array<{ value: string; text: string }> }
    expect(data.links).toEqual([])
  })

  test('extract-links handles HTML anchor tags', async () => {
    const result = await client.callTool({
      name: MARKDOWN_EXTRACT_LINKS_TOOL_NAME,
      arguments: { markdown: 'See <a href="docs/guide.md">guide</a> and <a href="docs/api.md">API</a>' },
    })
    const data = result.structuredContent as { links: Array<{ value: string; text: string }> }
    expect(data.links).toContainEqual({ value: 'docs/guide.md', text: 'guide' })
    expect(data.links).toContainEqual({ value: 'docs/api.md', text: 'API' })
  })

  test('extract-links handles HTML img tags', async () => {
    const result = await client.callTool({
      name: MARKDOWN_EXTRACT_LINKS_TOOL_NAME,
      arguments: { markdown: '<img src="assets/logo.png" alt="Logo">' },
    })
    const data = result.structuredContent as { links: Array<{ value: string; text: string }> }
    expect(data.links).toContainEqual({ value: 'assets/logo.png', text: 'Logo' })
  })

  test('extract-links skips fragment-only and external links', async () => {
    const result = await client.callTool({
      name: MARKDOWN_EXTRACT_LINKS_TOOL_NAME,
      arguments: { markdown: '[anchor](#section) [web](https://example.com) [mail](mailto:a@b.com)' },
    })
    const data = result.structuredContent as { links: Array<{ value: string; text: string }> }
    expect(data.links).toEqual([])
  })
})

describe('markdown validate-links tool', () => {
  beforeEach(async () => {
    await setupServer()
  })
  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('validate-links returns present and missing links', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'plaited-md-test-'))
    try {
      await Bun.write(join(baseDir, 'guide.md'), '# guide')

      const result = await client.callTool({
        name: MARKDOWN_VALIDATE_LINKS_TOOL_NAME,
        arguments: { directory: baseDir, markdownBody: 'See [guide](guide.md) and [missing](missing.md)' },
      })
      const data = result.structuredContent as {
        present: Array<{ value: string; text: string }>
        missing: Array<{ value: string; text: string }>
      }
      expect(data.present).toHaveLength(1)
      expect(data.present[0]!.value).toBe('guide.md')
      expect(data.missing).toHaveLength(1)
      expect(data.missing[0]!.value).toBe('missing.md')
    } finally {
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  test('validate-links with rootRelative resolves leading-slash links', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'plaited-md-test-'))
    try {
      await Bun.write(join(baseDir, 'customers.md'), '# customers')

      const result = await client.callTool({
        name: MARKDOWN_VALIDATE_LINKS_TOOL_NAME,
        arguments: {
          directory: baseDir,
          markdownBody: 'See [customers](/customers.md) and [gone](/gone.md)',
          rootRelative: true,
        },
      })
      const data = result.structuredContent as {
        present: Array<{ value: string; text: string }>
        missing: Array<{ value: string; text: string }>
      }
      expect(data.present).toHaveLength(1)
      expect(data.present[0]!.value).toBe('/customers.md')
      expect(data.missing).toHaveLength(1)
      expect(data.missing[0]!.value).toBe('/gone.md')
    } finally {
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  test('validate-links without rootRelative treats leading-slash as filesystem-root', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'plaited-md-test-'))
    try {
      await Bun.write(join(baseDir, 'customers.md'), '# customers')

      const result = await client.callTool({
        name: MARKDOWN_VALIDATE_LINKS_TOOL_NAME,
        arguments: { directory: baseDir, markdownBody: 'See [customers](/customers.md)' },
      })
      const data = result.structuredContent as {
        present: Array<{ value: string; text: string }>
        missing: Array<{ value: string; text: string }>
      }
      expect(data.present).toHaveLength(0)
      expect(data.missing).toHaveLength(1)
    } finally {
      await rm(baseDir, { recursive: true, force: true })
    }
  })
})

describe('markdown frontmatter tool', () => {
  beforeEach(async () => {
    await setupServer()
  })
  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('frontmatter returns parsed frontmatter and body', async () => {
    const result = await client.callTool({
      name: MARKDOWN_FRONTMATTER_TOOL_NAME,
      arguments: { markdown: '---\ntitle: Hello\n---\n\nBody text' },
    })
    const data = result.structuredContent as { frontmatter: Record<string, unknown>; body: string }
    expect(data.frontmatter).toEqual({ title: 'Hello' })
    expect(data.body).toBe('Body text')
  })

  test('frontmatter echoes raw body when no frontmatter block exists', async () => {
    const result = await client.callTool({
      name: MARKDOWN_FRONTMATTER_TOOL_NAME,
      arguments: { markdown: 'Just a plain markdown document.' },
    })
    const data = result.structuredContent as { frontmatter: Record<string, unknown> | null; body: string }
    expect(data.frontmatter).toBeNull()
    expect(data.body).toBe('Just a plain markdown document.')
  })
})
