import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { executeLsp, flattenSymbols, getLanguageId, resolveFilePath } from '../lsp.ts'

const scriptsDir = join(import.meta.dir, '..')
const fixtureFile = join(import.meta.dir, 'fixtures/sample.ts')

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
    const result = await Bun.$`bun ${scriptsDir}/lsp.ts --schema input`.quiet()
    const schema = JSON.parse(result.text())

    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('file')
    expect(schema.properties).toHaveProperty('operations')
  })

  test('--schema output outputs JSON Schema', async () => {
    const result = await Bun.$`bun ${scriptsDir}/lsp.ts --schema output`.quiet()
    const schema = JSON.parse(result.text())

    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('file')
    expect(schema.properties).toHaveProperty('results')
  })

  test('--help exits 0', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/lsp.ts`, '--help'], {
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
    const result = await Bun.$`bun ${scriptsDir}/lsp.ts ${input}`.quiet()
    const output = JSON.parse(result.text())

    expect(output.file).toBe(fixtureFile)
    expect(output.results).toHaveLength(1)
    expect(output.results[0].type).toBe('symbols')
    expect(Array.isArray(output.results[0].data)).toBe(true)
  })

  test('exits with code 1 when an operation fails', async () => {
    const input = JSON.stringify({
      file: fixtureFile,
      operations: [{ type: 'hover' }],
    })

    const proc = Bun.spawn(['bun', `${scriptsDir}/lsp.ts`, input], {
      stderr: 'pipe',
      stdout: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
  })

  test('exits with code 2 on invalid input', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/lsp.ts`, '{"bad": true}'], {
      stderr: 'pipe',
      stdout: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(2)
  })
})
