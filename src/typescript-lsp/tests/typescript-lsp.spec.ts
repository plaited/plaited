import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

const runTypescriptLsp = async (input: unknown, extraArgs: string[] = []) => {
  const proc = Bun.spawn(['bun', './bin/plaited.ts', 'typescript-lsp', JSON.stringify(input), ...extraArgs], {
    cwd: CLI_PACKAGE_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

const createTempRoot = (): string =>
  join('/tmp', `plaited-typescript-lsp-tests-${Date.now()}-${Math.random().toString(16).slice(2)}`)

const withTempRoot = async (run: (rootDir: string) => Promise<void>) => {
  const rootDir = createTempRoot()
  await Bun.$`mkdir -p ${rootDir}`
  try {
    await run(rootDir)
  } finally {
    await Bun.$`rm -rf ${rootDir}`
  }
}

describe('typescript-lsp CLI registration and schema', () => {
  test('plaited --schema includes typescript-lsp', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts --schema`.cwd(CLI_PACKAGE_ROOT).quiet()
    const output = JSON.parse(result.stdout.toString().trim()) as { commands: string[] }

    expect(output.commands).toContain('typescript-lsp')
  })

  test('output schema includes data field for successful results', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts typescript-lsp --schema output`.cwd(CLI_PACKAGE_ROOT).quiet()
    const output = JSON.parse(result.stdout.toString().trim()) as {
      properties?: {
        results?: {
          items?: {
            properties?: Record<string, unknown>
          }
        }
      }
    }

    expect(output.properties?.results?.items?.properties).toHaveProperty('data')
  })

  test('accepts dash-case workspace operation names', async () => {
    const result = await runTypescriptLsp({
      files: ['src/cli.ts'],
      operations: [{ type: 'workspace-scan' }],
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.trim()) as { results: Array<{ type: string }> }
    expect(output.results[0]?.type).toBe('workspace-scan')
  })

  test('rejects legacy underscore workspace operation names', async () => {
    const result = await runTypescriptLsp({
      files: ['src/cli.ts'],
      operations: [{ type: 'workspace_scan' }],
    })

    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('operations')
    expect(result.stderr).toContain('type')
  })

  test('requires file for LSP session operations', async () => {
    const result = await runTypescriptLsp({
      targets: ['src/**/*.ts'],
      operations: [{ type: 'hover', line: 0, character: 0 }],
    })

    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('file')
  })

  test('accepts targets without file for workspace operations', async () => {
    const result = await runTypescriptLsp({
      targets: ['src/**/*.ts'],
      operations: [{ type: 'workspace-scan' }],
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.trim()) as { results: Array<{ type: string }> }
    expect(output.results[0]?.type).toBe('workspace-scan')
  })

  test('workspace operations ignore optional file when files are provided', async () => {
    const result = await runTypescriptLsp({
      file: 'does-not-exist.ts',
      files: ['src/cli.ts'],
      operations: [{ type: 'workspace-scan' }],
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.trim()) as {
      results: Array<{ type: string; data?: Array<{ file: string }> }>
    }
    expect(output.results[0]?.type).toBe('workspace-scan')
    const files = output.results[0]?.data?.map((entry) => entry.file) ?? []
    expect(files).toContain('src/cli.ts')
  })

  test('rejects workspace operations when only file is provided', async () => {
    const result = await runTypescriptLsp({
      file: 'src/cli.ts',
      operations: [{ type: 'workspace-scan' }],
    })

    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('operations')
  })

  test('workspace scan outputs paths relative to rootDir when possible', async () => {
    await withTempRoot(async (rootDir) => {
      await Bun.$`mkdir -p ${join(rootDir, 'src')}`
      await Bun.write(join(rootDir, 'src', 'entry.ts'), 'export const value = 1')

      const result = await runTypescriptLsp({
        rootDir,
        targets: ['src/**/*.ts'],
        operations: [{ type: 'workspace-scan' }],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.trim()) as {
        results: Array<{ data: Array<{ file: string }> }>
      }

      expect(output.results[0]?.data?.[0]?.file).toBe('src/entry.ts')
    })
  })

  test('workspace operations apply default ignore globs', async () => {
    await withTempRoot(async (rootDir) => {
      await Bun.$`mkdir -p ${join(rootDir, 'src')} ${join(rootDir, 'node_modules/pkg')}`
      await Bun.write(join(rootDir, 'src', 'kept.ts'), 'export const kept = true')
      await Bun.write(join(rootDir, 'node_modules/pkg', 'ignored.ts'), 'export const ignored = true')

      const result = await runTypescriptLsp({
        rootDir,
        targets: ['**/*.ts'],
        operations: [{ type: 'workspace-scan' }],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.trim()) as {
        results: Array<{ data: Array<{ file: string }> }>
      }
      const files = output.results[0]?.data?.map((entry) => entry.file) ?? []
      expect(files).toContain('src/kept.ts')
      expect(files.some((file) => file.includes('node_modules'))).toBe(false)
    })
  })

  test('workspace operations apply additive ignoreGlobs', async () => {
    await withTempRoot(async (rootDir) => {
      await Bun.$`mkdir -p ${join(rootDir, 'src')}`
      await Bun.write(join(rootDir, 'src', 'kept.ts'), 'export const kept = true')
      await Bun.write(join(rootDir, 'src', 'skip.ts'), 'export const skip = true')

      const result = await runTypescriptLsp({
        rootDir,
        targets: ['src/**/*.ts'],
        ignoreGlobs: ['**/skip.ts'],
        operations: [{ type: 'workspace-scan' }],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.trim()) as {
        results: Array<{ data: Array<{ file: string }> }>
      }
      const files = output.results[0]?.data?.map((entry) => entry.file) ?? []
      expect(files).toContain('src/kept.ts')
      expect(files).not.toContain('src/skip.ts')
    })
  })

  test('find includes rootDir-relative path for symbol locations', async () => {
    const result = await runTypescriptLsp({
      rootDir: '.',
      file: 'src/typescript-lsp/tests/fixtures/sample.ts',
      operations: [{ type: 'find', query: 'parseConfig' }],
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.trim()) as {
      results: Array<{ data?: Array<{ location?: { path?: string } }> }>
    }
    const symbols = output.results[0]?.data ?? []
    expect(symbols.some((entry) => entry.location?.path === 'src/typescript-lsp/tests/fixtures/sample.ts')).toBe(true)
  })
})
