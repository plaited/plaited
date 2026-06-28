/**
 * @module css-schemas.spec
 *
 * Behavior tests for the css-schemas CLI command.
 */

import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'

const repoRoot = path.resolve(import.meta.dir, '../../..')

describe('css-schemas CLI', () => {
  test('--schema input emits a valid JSON schema with mode enum', async () => {
    const proc = Bun.spawn(['bun', 'bin/plaited.ts', 'css-schemas', '--schema', 'input'], {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: repoRoot,
    })
    expect(await proc.exited).toBe(0)
    const output = await new Response(proc.stdout).text()
    const schema = JSON.parse(output)
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('mode')
    const modeProp = schema.properties.mode as Record<string, unknown>
    expect(modeProp.enum).toContain('generate')
    expect(modeProp.enum).toContain('diff')
  })

  test('--schema output emits the output schema', async () => {
    const proc = Bun.spawn(['bun', 'bin/plaited.ts', 'css-schemas', '--schema', 'output'], {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: repoRoot,
    })
    expect(await proc.exited).toBe(0)
    const output = await new Response(proc.stdout).text()
    const schema = JSON.parse(output)
    expect(schema.properties).toHaveProperty('path')
    expect(schema.properties).toHaveProperty('changed')
  })

  test('diff mode against committed file returns changed:false', async () => {
    const proc = Bun.spawn(['bun', 'bin/plaited.ts', 'css-schemas', JSON.stringify({ mode: 'diff' })], {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: repoRoot,
    })
    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.changed).toBe(false)
    expect(output.propertyCount).toBeGreaterThan(0)
  })

  test('generate mode with --dry-run does not write the file', async () => {
    const outputPath = path.resolve(repoRoot, 'src/client/css.schemas.ts')
    const before = (await Bun.file(outputPath).stat()).mtimeMs

    const proc = Bun.spawn(
      ['bun', 'bin/plaited.ts', 'css-schemas', JSON.stringify({ mode: 'generate' }), '--dry-run'],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: repoRoot,
      },
    )
    expect(await proc.exited).toBe(0)

    const after = (await Bun.file(outputPath).stat()).mtimeMs
    expect(after).toBe(before)

    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.dryRun).toBe(true)
    expect(output.input.mode).toBe('generate')
  })

  test('--help prints usage information', async () => {
    const proc = Bun.spawn(['bun', 'bin/plaited.ts', 'css-schemas', '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: repoRoot,
    })
    expect(await proc.exited).toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('generate')
    expect(stderr).toContain('diff')
    expect(stderr).toContain('--schema')
    expect(stderr).toContain('--dry-run')
  })
})
