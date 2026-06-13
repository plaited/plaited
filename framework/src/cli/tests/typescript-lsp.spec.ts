import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const runCli = async (input: unknown, ...extraArgs: string[]) => {
  const hasInput = input !== null
  const inputJson = hasInput ? JSON.stringify(input) : undefined
  const args = [
    ...(inputJson === undefined ? [] : [JSON.stringify(inputJson)]),
    ...extraArgs.map((a) => JSON.stringify(a)),
  ]
  const proc = Bun.spawn(
    [
      'bun',
      '-e',
      ["import { lspCli } from '../typescript-lsp.ts'", `await lspCli['typescript-lsp']([${args.join(',')}])`].join(
        ';\n',
      ),
    ],
    { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'onbraid-lsp-'))
  return dir
}

describe('lspCli', () => {
  test('--help exits 0 and describes the CLI', async () => {
    const { exitCode, stderr } = await runCli(null, '--help')

    expect(exitCode).toBe(0)
    expect(stderr).toContain('typescript-lsp')
    expect(stderr).toContain('execute')
    expect(stderr).toContain('discover')
    expect(stderr).toContain('requests')
  })

  test('rejects invalid JSON input', async () => {
    const { exitCode } = await runCli(null, 'not-json')

    expect(exitCode).toBe(2)
  })

  test('rejects no input', async () => {
    const { exitCode } = await runCli(null)

    expect(exitCode).toBe(2)
  })

  test('returns document symbols for a simple file', async () => {
    const dir = await createTempDir()
    const filePath = join(dir, 'sample.ts')
    const uri = `file://${filePath}`
    await writeFile(filePath, 'export const x = 1\n')

    const { exitCode, stdout } = await runCli({
      mode: 'execute',
      rootDir: dir,
      file: filePath,
      requests: [{ method: 'textDocument/documentSymbol', params: { textDocument: { uri } } }],
    })

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.mode).toBe('execute')
    expect(output.file).toBe('sample.ts')
    expect(output.results).toHaveLength(1)
    expect(output.results[0].method).toBe('textDocument/documentSymbol')
    expect(output.results[0].result).toBeDefined()

    await rm(dir, { recursive: true, force: true })
  })

  test('discovers server capabilities', async () => {
    const { exitCode, stdout } = await runCli({ mode: 'discover' })

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.mode).toBe('discover')
    expect(Array.isArray(output.capabilities)).toBe(true)
    expect(output.capabilities.length).toBeGreaterThan(0)
    expect(output.capabilities[0].method).toBeString()
    expect(output.capabilities[0].capability).toBeString()
  })

  test('--schema input emits JSON Schema', async () => {
    const { exitCode, stdout } = await runCli(null, '--schema', 'input')

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.oneOf).toBeDefined()
    expect(output.description).toContain('TypeScript')
  })

  test('--dry-run prints request details without executing', async () => {
    const { exitCode, stdout } = await runCli(
      {
        mode: 'execute',
        file: 'test.ts',
        requests: [{ method: 'textDocument/documentSymbol', params: { textDocument: { uri: 'file://test.ts' } } }],
      },
      '--dry-run',
    )

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.command).toBe('typescript-lsp')
    expect(output.dryRun).toBe(true)
    expect(output.input.requests[0].method).toBe('textDocument/documentSymbol')
  })
})
