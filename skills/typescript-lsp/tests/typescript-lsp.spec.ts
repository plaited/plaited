import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  executeLsp,
  flattenSymbols,
  getCandidateUnusedExports,
  getExportConsumers,
  getLanguageId,
  getLoader,
  getPublicExports,
  isTestFile,
  LspClient,
  resolveFilePath,
  resolveWorkspaceFiles,
  scanFile,
} from '../scripts/typescript-lsp.ts'

const cliPath = join(import.meta.dir, '..', 'scripts', 'run.ts')
const fixtureFile = join(import.meta.dir, 'fixtures', 'sample.ts')
const fixtureConsumerFile = join(import.meta.dir, '..', 'fixtures', 'sample-consumer.ts')
const fixtureUsageFile = join(import.meta.dir, '..', 'fixtures', 'tests', 'sample-usage.ts')
const rootUri = `file://${process.cwd()}`
const testUri = `file://${fixtureFile}`

// ============================================================================
// LspClient
// ============================================================================

describe('LspClient', () => {
  let client: LspClient

  beforeAll(() => {
    client = new LspClient({ rootUri })
  })

  afterAll(async () => {
    if (client.isRunning()) {
      await client.stop()
    }
  })

  test('initializes with rootUri', () => {
    expect(client).toBeDefined()
    expect(client.isRunning()).toBe(false)
  })

  test('starts and stops LSP server', async () => {
    await client.start()
    expect(client.isRunning()).toBe(true)

    await client.stop()
    expect(client.isRunning()).toBe(false)
  })

  test('throws when starting already running server', async () => {
    await client.start()
    expect(client.isRunning()).toBe(true)

    await expect(client.start()).rejects.toThrow('LSP server already running')

    await client.stop()
  })

  test('handles stop on non-running server gracefully', async () => {
    expect(client.isRunning()).toBe(false)
    await client.stop()
    expect(client.isRunning()).toBe(false)
  })

  describe('LSP operations', () => {
    beforeAll(async () => {
      await client.start()
    })

    afterAll(async () => {
      await client.stop()
    })

    test('opens and closes document', async () => {
      const text = await Bun.file(fixtureFile).text()

      client.openDocument(testUri, 'typescript', 1, text)
      client.closeDocument(testUri)
    })

    test('gets hover information', async () => {
      const text = await Bun.file(fixtureFile).text()

      client.openDocument(testUri, 'typescript', 1, text)

      const lines = text.split('\n')
      let line = 0
      let char = 0
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]?.startsWith('export')) {
          line = i
          char = 0
          break
        }
      }

      const result = await client.hover(testUri, line, char)
      expect(result).toBeDefined()

      client.closeDocument(testUri)
    })

    test('gets document symbols', async () => {
      const text = await Bun.file(fixtureFile).text()

      client.openDocument(testUri, 'typescript', 1, text)

      const result = await client.documentSymbols(testUri)

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)

      client.closeDocument(testUri)
    })

    test('searches workspace symbols', async () => {
      const text = await Bun.file(fixtureFile).text()
      client.openDocument(testUri, 'typescript', 1, text)

      const result = await client.workspaceSymbols('parseConfig')

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)

      client.closeDocument(testUri)
    })

    test('finds references', async () => {
      const text = await Bun.file(fixtureFile).text()

      client.openDocument(testUri, 'typescript', 1, text)

      const lines = text.split('\n')
      let line = 0
      let char = 0
      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i]
        if (!currentLine) continue
        const match = currentLine.match(/export\s+const\s+(\w+)/)
        if (match?.[1]) {
          line = i
          char = currentLine.indexOf(match[1])
          break
        }
      }

      const result = await client.references(testUri, line, char)
      expect(result).toBeDefined()

      client.closeDocument(testUri)
    })

    test('gets definition', async () => {
      const text = await Bun.file(fixtureFile).text()

      client.openDocument(testUri, 'typescript', 1, text)

      const lines = text.split('\n')
      let line = 0
      let char = 0
      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i]
        if (!currentLine) continue
        const match = currentLine.match(/import\s+.*{\s*(\w+)/)
        if (match?.[1]) {
          line = i
          char = currentLine.indexOf(match[1])
          break
        }
      }

      const result = await client.definition(testUri, line, char)
      expect(result).toBeDefined()

      client.closeDocument(testUri)
    })
  })

  describe('error handling', () => {
    test('throws on request when server not running', async () => {
      const notRunningClient = new LspClient({ rootUri })

      await expect(notRunningClient.hover('file:///test.ts', 0, 0)).rejects.toThrow('LSP server not running')
    })

    test('throws on notify when server not running', () => {
      const notRunningClient = new LspClient({ rootUri })

      expect(() => notRunningClient.notify('test')).toThrow('LSP server not running')
    })
  })
})

// ============================================================================
// Helper functions
// ============================================================================

describe('resolveFilePath', () => {
  test('returns absolute path as-is', () => {
    expect(resolveFilePath('/usr/local/file.ts')).toBe('/usr/local/file.ts')
  })

  test('resolves relative path from cwd', () => {
    const result = resolveFilePath('./src/file.ts')
    expect(result).toBe(join(process.cwd(), './src/file.ts'))
  })

  test('resolves implicit relative path from cwd', () => {
    const result = resolveFilePath('src/file.ts')
    expect(result).toBe(join(process.cwd(), 'src/file.ts'))
  })

  test('resolves relative path from custom base', () => {
    const result = resolveFilePath('src/file.ts', '/projects/my-app')
    expect(result).toBe('/projects/my-app/src/file.ts')
  })

  test('ignores base for absolute paths', () => {
    const result = resolveFilePath('/usr/local/file.ts', '/projects/my-app')
    expect(result).toBe('/usr/local/file.ts')
  })
})

describe('getLanguageId', () => {
  test('returns typescriptreact for .tsx', () => {
    expect(getLanguageId('file.tsx')).toBe('typescriptreact')
  })

  test('returns typescript for .ts', () => {
    expect(getLanguageId('file.ts')).toBe('typescript')
  })

  test('returns javascriptreact for .jsx', () => {
    expect(getLanguageId('file.jsx')).toBe('javascriptreact')
  })

  test('returns javascript for .js', () => {
    expect(getLanguageId('file.js')).toBe('javascript')
  })

  test('returns javascript for unknown extension', () => {
    expect(getLanguageId('file.mjs')).toBe('javascript')
  })
})

describe('getLoader', () => {
  test('returns tsx for .tsx', () => {
    expect(getLoader('file.tsx')).toBe('tsx')
  })

  test('returns ts for .ts', () => {
    expect(getLoader('file.ts')).toBe('ts')
  })

  test('returns jsx for .jsx', () => {
    expect(getLoader('file.jsx')).toBe('jsx')
  })

  test('returns js for .js', () => {
    expect(getLoader('file.js')).toBe('js')
  })

  test('returns js for unknown extension', () => {
    expect(getLoader('file.mjs')).toBe('js')
  })
})

describe('workspace audit helpers', () => {
  test('classifies test files by path convention', () => {
    expect(isTestFile(fixtureUsageFile)).toBe(true)
    expect(isTestFile(fixtureConsumerFile)).toBe(false)
  })

  test('resolves workspace files from explicit file list', () => {
    const files = resolveWorkspaceFiles({
      input: {
        files: [fixtureFile, fixtureConsumerFile],
        operations: [{ type: 'workspace_scan' }],
      },
      base: process.cwd(),
    })

    expect(files).toEqual([fixtureConsumerFile, fixtureFile].sort())
  })

  test('scans a file for imports and exports', async () => {
    const result = await scanFile(fixtureConsumerFile, process.cwd())

    expect(result.file.endsWith('skills/typescript-lsp/fixtures/sample-consumer.ts')).toBe(true)
    expect(result.imports).toEqual([
      {
        kind: 'import-statement',
        path: '../tests/fixtures/sample.ts',
      },
    ])
    expect(result.exports).toContain('formatConfig')
  })

  test('lists public exports across files', () => {
    const results = getPublicExports({
      absolutePaths: [fixtureFile, fixtureConsumerFile],
      base: process.cwd(),
    })

    const sampleExports = results.find((entry) => entry.file.endsWith('sample.ts'))?.exports ?? []
    expect(sampleExports.some((entry) => entry.name === 'Config')).toBe(true)
    expect(sampleExports.some((entry) => entry.name === 'parseConfig')).toBe(true)
  })

  test('finds candidate export consumers and separates prod from test usage', async () => {
    const results = await getExportConsumers({
      absolutePaths: [fixtureFile, fixtureConsumerFile, fixtureUsageFile],
      base: process.cwd(),
      includeTests: true,
      query: 'parseConfig',
    })

    expect(results).toEqual([
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        kind: 'Variable',
        line: 8,
        name: 'parseConfig',
        prodRefs: ['skills/typescript-lsp/fixtures/sample-consumer.ts'],
        testRefs: ['skills/typescript-lsp/fixtures/tests/sample-usage.ts'],
      },
    ])
  })

  test('finds verified candidate unused exports', async () => {
    const results = await getCandidateUnusedExports({
      absolutePaths: [fixtureFile, fixtureConsumerFile, fixtureUsageFile],
      base: process.cwd(),
      includeTests: true,
      query: 'onlyUsedInTests',
    })

    expect(results).toEqual([
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        kind: 'Variable',
        line: 16,
        name: 'onlyUsedInTests',
        status: 'test_only',
        prodRefs: [],
        testRefs: ['skills/typescript-lsp/fixtures/tests/sample-usage.ts'],
        verified: true,
      },
    ])
  })
})

describe('flattenSymbols', () => {
  test('flattens top-level symbols', () => {
    const symbols = [
      { name: 'foo', kind: 13, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } } },
      { name: 'bar', kind: 12, range: { start: { line: 5, character: 0 }, end: { line: 5, character: 20 } } },
    ]
    const result = flattenSymbols(symbols)
    expect(result).toEqual([
      { name: 'foo', kind: 'Variable', line: 0 },
      { name: 'bar', kind: 'Function', line: 5 },
    ])
  })

  test('flattens nested symbols with dotted names', () => {
    const symbols = [
      {
        name: 'MyClass',
        kind: 5,
        range: { start: { line: 0, character: 0 }, end: { line: 10, character: 1 } },
        children: [
          { name: 'method', kind: 6, range: { start: { line: 2, character: 2 }, end: { line: 4, character: 3 } } },
        ],
      },
    ]
    const result = flattenSymbols(symbols)
    expect(result).toEqual([
      { name: 'MyClass', kind: 'Class', line: 0 },
      { name: 'MyClass.method', kind: 'Method', line: 2 },
    ])
  })

  test('handles unknown symbol kinds', () => {
    const symbols = [
      { name: 'x', kind: 99, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } },
    ]
    const result = flattenSymbols(symbols)
    expect(result[0]?.kind).toBe('Unknown(99)')
  })
})

// ============================================================================
// Library API
// ============================================================================

describe('executeLsp', () => {
  test('returns symbols for a valid file', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'symbols' }],
    })

    expect(result.file).toBe(fixtureFile)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('symbols')
    expect(result.results[0]?.data).toBeDefined()
    expect(Array.isArray(result.results[0]?.data)).toBe(true)
  })

  test('returns exports for a valid file', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'exports' }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('exports')
    const exports = result.results[0]?.data as Array<{ name: string }>
    expect(exports.length).toBeGreaterThan(0)

    const names = exports.map((e) => e.name)
    expect(names).toContain('parseConfig')
    expect(names).toContain('Config')
    expect(names).toContain('validateInput')
    expect(names).toContain('ConfigManager')
  })

  test('exports excludes nested symbols', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'exports' }],
    })

    const exports = result.results[0]?.data as Array<{ name: string }>
    const nestedNames = exports.filter((e) => e.name.includes('.'))
    expect(nestedNames).toHaveLength(0)
  })

  test('returns hover data at a valid position', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'hover', line: 8, character: 13 }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('hover')
    expect(result.results[0]?.data).toBeDefined()
  })

  test('returns references for a symbol', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'references', line: 8, character: 13 }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('references')
    expect(result.results[0]?.data).toBeDefined()
  })

  test('returns definition for a symbol', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'definition', line: 19, character: 22 }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('definition')
    expect(result.results[0]?.data).toBeDefined()
  })

  test('scan returns imports and exports without LSP subprocess', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'scan' }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('scan')
    const data = result.results[0]?.data as { imports: unknown[]; exports: unknown[] }
    expect(data).toBeDefined()
    expect(Array.isArray(data.imports)).toBe(true)
    expect(Array.isArray(data.exports)).toBe(true)
    expect(data.exports).toEqual(['ConfigManager', 'onlyUsedInTests', 'parseConfig', 'unusedValue', 'validateInput'])
  })

  test('scan-only operations skip LSP server startup', async () => {
    // Scan should succeed even when only scan ops are requested (no LSP subprocess)
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'scan' }, { type: 'scan' }],
    })

    expect(result.results).toHaveLength(2)
    expect(result.results.every((r) => r.type === 'scan' && r.data !== undefined)).toBe(true)
  })

  test('scan mixed with LSP operations works', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'scan' }, { type: 'symbols' }],
    })

    expect(result.results).toHaveLength(2)
    expect(result.results[0]?.type).toBe('scan')
    expect(result.results[0]?.data).toBeDefined()
    expect(result.results[1]?.type).toBe('symbols')
    expect(result.results[1]?.data).toBeDefined()
  })

  test('returns workspace scan results across explicit files', async () => {
    const result = await executeLsp({
      files: [fixtureFile, fixtureConsumerFile],
      operations: [{ type: 'workspace_scan', includeTests: true }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('workspace_scan')
    expect(result.results[0]?.data).toEqual([
      {
        file: 'skills/typescript-lsp/fixtures/sample-consumer.ts',
        imports: [
          {
            kind: 'import-statement',
            path: '../tests/fixtures/sample.ts',
          },
        ],
        exports: ['formatConfig'],
        isTest: false,
      },
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        imports: [],
        exports: ['ConfigManager', 'onlyUsedInTests', 'parseConfig', 'unusedValue', 'validateInput'],
        isTest: true,
      },
    ])
  })

  test('returns public exports across explicit files', async () => {
    const result = await executeLsp({
      files: [fixtureFile, fixtureConsumerFile],
      operations: [{ type: 'public_exports', includeTests: true }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('public_exports')
    expect(result.results[0]?.data).toEqual([
      {
        file: 'skills/typescript-lsp/fixtures/sample-consumer.ts',
        exports: [{ kind: 'Variable', line: 2, name: 'formatConfig' }],
      },
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        exports: [
          { kind: 'TypeAlias', line: 3, name: 'Config' },
          { kind: 'Variable', line: 8, name: 'parseConfig' },
          { kind: 'Variable', line: 12, name: 'validateInput' },
          { kind: 'Variable', line: 16, name: 'onlyUsedInTests' },
          { kind: 'Variable', line: 20, name: 'unusedValue' },
          { kind: 'Class', line: 22, name: 'ConfigManager' },
        ],
      },
    ])
  })

  test('returns export consumer audit results', async () => {
    const result = await executeLsp({
      files: [fixtureFile, fixtureConsumerFile, fixtureUsageFile],
      operations: [{ type: 'export_consumers', query: 'parseConfig', includeTests: true }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('export_consumers')
    expect(result.results[0]?.data).toEqual([
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        kind: 'Variable',
        line: 8,
        name: 'parseConfig',
        prodRefs: ['skills/typescript-lsp/fixtures/sample-consumer.ts'],
        testRefs: ['skills/typescript-lsp/fixtures/tests/sample-usage.ts'],
      },
    ])
  })

  test('returns verified candidate unused exports', async () => {
    const result = await executeLsp({
      files: [fixtureFile, fixtureConsumerFile, fixtureUsageFile],
      operations: [{ type: 'candidate_unused_exports', includeTests: true }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('candidate_unused_exports')
    expect(result.results[0]?.data).toEqual([
      {
        file: 'skills/typescript-lsp/fixtures/sample-consumer.ts',
        kind: 'Variable',
        line: 2,
        name: 'formatConfig',
        status: 'unused',
        prodRefs: [],
        testRefs: [],
        verified: true,
      },
      {
        file: 'skills/typescript-lsp/fixtures/tests/sample-usage.ts',
        kind: 'Variable',
        line: 2,
        name: 'runFixtureUsage',
        status: 'unused',
        prodRefs: [],
        testRefs: [],
        verified: true,
      },
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        kind: 'Variable',
        line: 12,
        name: 'validateInput',
        status: 'unused',
        prodRefs: [],
        testRefs: [],
        verified: true,
      },
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        kind: 'Variable',
        line: 16,
        name: 'onlyUsedInTests',
        status: 'test_only',
        prodRefs: [],
        testRefs: ['skills/typescript-lsp/fixtures/tests/sample-usage.ts'],
        verified: true,
      },
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        kind: 'Variable',
        line: 20,
        name: 'unusedValue',
        status: 'unused',
        prodRefs: [],
        testRefs: [],
        verified: true,
      },
      {
        file: 'skills/typescript-lsp/tests/fixtures/sample.ts',
        kind: 'Class',
        line: 22,
        name: 'ConfigManager',
        status: 'unused',
        prodRefs: [],
        testRefs: [],
        verified: true,
      },
    ])
  })

  test('returns workspace symbols for find', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'find', query: 'parseConfig' }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.type).toBe('find')
    expect(Array.isArray(result.results[0]?.data)).toBe(true)
  })

  test('batches multiple operations in one session', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'symbols' }, { type: 'exports' }, { type: 'hover', line: 8, character: 13 }],
    })

    expect(result.results).toHaveLength(3)
    expect(result.results[0]?.type).toBe('symbols')
    expect(result.results[1]?.type).toBe('exports')
    expect(result.results[2]?.type).toBe('hover')
    expect(result.results.every((r) => r.data !== undefined)).toBe(true)
  })

  test('returns error for operation missing required fields', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'hover' }],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.error).toBe('hover requires line and character')
    expect(result.results[0]?.data).toBeUndefined()
  })

  test('continues after a failed operation', async () => {
    const result = await executeLsp({
      file: fixtureFile,
      operations: [{ type: 'hover' }, { type: 'symbols' }],
    })

    expect(result.results).toHaveLength(2)
    expect(result.results[0]?.error).toBeDefined()
    expect(result.results[1]?.data).toBeDefined()
  })

  test('throws for non-existent file', async () => {
    await expect(
      executeLsp({
        file: '/nonexistent/file.ts',
        operations: [{ type: 'symbols' }],
      }),
    ).rejects.toThrow('File not found')
  })
})

// ============================================================================
// CLI
// ============================================================================

describe('CLI', () => {
  test('--schema input outputs JSON Schema', async () => {
    const result = await Bun.$`bun ${cliPath} --schema input`.quiet()
    const schema = JSON.parse(result.text())

    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('file')
    expect(schema.properties).toHaveProperty('operations')
  })

  test('--schema output outputs JSON Schema', async () => {
    const result = await Bun.$`bun ${cliPath} --schema output`.quiet()
    const schema = JSON.parse(result.text())

    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('file')
    expect(schema.properties).toHaveProperty('results')
  })

  test('--help exits 0', async () => {
    const proc = Bun.spawn(['bun', cliPath, '--help'], {
      stderr: 'pipe',
      stdout: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
  })

  test('runs symbols via JSON positional arg', async () => {
    const input = JSON.stringify({
      file: fixtureFile,
      operations: [{ type: 'symbols' }],
    })
    const result = await Bun.$`bun ${cliPath} ${input}`.quiet()
    const output = JSON.parse(result.text())

    expect(output.file).toBe(fixtureFile)
    expect(output.results).toHaveLength(1)
    expect(output.results[0].type).toBe('symbols')
    expect(Array.isArray(output.results[0].data)).toBe(true)
  })

  test('runs workspace audit via JSON positional arg', async () => {
    const input = JSON.stringify({
      files: [fixtureFile, fixtureConsumerFile],
      operations: [{ type: 'workspace_scan', includeTests: true }],
    })
    const result = await Bun.$`bun ${cliPath} ${input}`.quiet()
    const output = JSON.parse(result.text())

    expect(output.file).toBe(fixtureFile)
    expect(output.results[0].type).toBe('workspace_scan')
    expect(Array.isArray(output.results[0].data)).toBe(true)
  })

  test('exits with code 1 when an operation fails', async () => {
    const input = JSON.stringify({
      file: fixtureFile,
      operations: [{ type: 'hover' }],
    })

    const proc = Bun.spawn(['bun', cliPath, input], {
      stderr: 'pipe',
      stdout: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
  })

  test('exits with code 2 on invalid input', async () => {
    const proc = Bun.spawn(['bun', cliPath, '{"bad": true}'], {
      stderr: 'pipe',
      stdout: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(2)
  })
})
