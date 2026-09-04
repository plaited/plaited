import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { binary, EDIT_TOOL_NAME } from '../edit.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// edit tool — exercised through an in-process MCP client/server
// ================================================================

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  binary(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callEdit = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: EDIT_TOOL_NAME, arguments: { cwd: process.cwd(), ...args } })
  return result
}

type EditToolOutput = {
  content?: string
  patch: string
  replacements: number
  isError?: boolean
}

describe('edit tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes edit', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === EDIT_TOOL_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Edit a file')
  })

  test('replaces exact text and produces a valid patch', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world\nfoo bar\nbaz qux' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'foo bar', new_text: 'FOO BAR' })
      const data = result.structuredContent as EditToolOutput

      expect(data.replacements).toBe(1)
      expect(data.patch).toContain('@@')
      expect(data.patch).toContain('-foo bar')
      expect(data.patch).toContain('+FOO BAR')

      const content = await Bun.file(filePath).text()
      expect(content).toBe('hello world\nFOO BAR\nbaz qux')
      expect(data.content).toBe(content)
    } finally {
      await cleanup()
    }
  })

  test('reports error on missing old_text with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'existing content' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'does not exist', new_text: 'replacement' })
      const data = result.structuredContent as EditToolOutput

      expect(data.isError).toBe(true)
      expect(data.replacements).toBe(0)
      expect(data.content).toContain('Error')
    } finally {
      await cleanup()
    }
  })

  test('reports error on ambiguous match with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'dup dup\nother' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'dup', new_text: 'replaced' })
      const data = result.structuredContent as EditToolOutput

      expect(data.isError).toBe(true)
      expect(data.replacements).toBe(0)
      expect(data.content).toContain('2 occurrences')
    } finally {
      await cleanup()
    }
  })

  test('replace_all replaces multiple occurrences with multi-hunk patch', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'apple\nbanana\napple\ncherry' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'apple', new_text: 'orange', replace_all: true })
      const data = result.structuredContent as EditToolOutput

      expect(data.replacements).toBe(2)
      expect(data.patch).toContain('@@')

      const content = await Bun.file(filePath).text()
      expect(content).toBe('orange\nbanana\norange\ncherry')
    } finally {
      await cleanup()
    }
  })

  // Reconstruction verifier: apply a unified patch (as emitted by edit.ts) to
  // the old content. No patch library — hunk headers, '-', '+', ' ' lines only.
  const applyUnifiedPatch = (oldContent: string, patch: string): string => {
    const oldLines = oldContent.split('\n')
    const out: string[] = []
    let oldIdx = 0
    const hunkRe = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@$/
    for (const line of patch.split('\n')) {
      const header = hunkRe.exec(line)
      if (header) {
        oldIdx = Math.max(oldIdx, Number(header[1]) - 1)
        continue
      }
      if (line.startsWith('-')) {
        oldIdx++
        continue
      }
      if (line.startsWith('+')) {
        out.push(line.slice(1))
        continue
      }
      out.push(oldLines[oldIdx++] ?? '')
    }
    while (oldIdx < oldLines.length) out.push(oldLines[oldIdx++]!)
    return out.join('\n')
  }

  test('reconstruction: line-count-changing replacement — patch reproduces new content', async () => {
    const before = 'one\ntwo\nthree\nfour\n'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'two', new_text: 'TWO-A\nTWO-B' })
      const data = result.structuredContent as EditToolOutput
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, data.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('reconstruction: replace_all with line-count changes — patch reproduces new content', async () => {
    const before = 'a\nX\nb\nX\nc\n'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'X', new_text: 'Y1\nY2', replace_all: true })
      const data = result.structuredContent as EditToolOutput
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, data.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('reconstruction: same-size replace_all — patch reproduces new content', async () => {
    const before = 'apple\nbanana\napple\ncherry'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'apple', new_text: 'orange', replace_all: true })
      const data = result.structuredContent as EditToolOutput
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, data.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('reconstruction: mid-line replacement with prefix/suffix — patch reproduces new content', async () => {
    const before = 'apple pie\ncherry\ndate\n'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'apple', new_text: 'orange' })
      const data = result.structuredContent as EditToolOutput
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, data.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('preserves CRLF line endings', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'line1\r\nline2\r\nline3' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await callEdit({ path: filePath, old_text: 'line2', new_text: 'modified' })
      const data = result.structuredContent as EditToolOutput

      expect(data.replacements).toBe(1)

      const bytes = await Bun.file(filePath).bytes()
      const raw = new TextDecoder().decode(bytes)
      expect(raw).toBe('line1\r\nmodified\r\nline3')
    } finally {
      await cleanup()
    }
  })
})

describe('edit tool — provisioned cwd', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('relative path resolves against the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'old text' })
    try {
      const result = await callEdit({ path: 'file.txt', cwd: dir, old_text: 'old', new_text: 'new' })
      const data = result.structuredContent as EditToolOutput
      expect(data.replacements).toBe(1)
      expect(await Bun.file(path.join(dir, 'file.txt')).text()).toBe('new text')
    } finally {
      await cleanup()
    }
  })
})
