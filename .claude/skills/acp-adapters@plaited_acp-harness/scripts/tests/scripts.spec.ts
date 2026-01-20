/**
 * Tests for acp-adapters skill scripts.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

const scriptsDir = join(import.meta.dir, '..')

describe('scaffold.ts', () => {
  const testOutputDir = join(import.meta.dir, 'test-adapter-output')

  afterEach(async () => {
    // Clean up test output directory
    await rm(testOutputDir, { recursive: true, force: true })
  })

  test('outputs JSON with scaffold result', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold.ts`, 'test-adapter', '-o', testOutputDir], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const output = await new Response(proc.stdout).text()
    await proc.exited

    const result = JSON.parse(output)
    expect(result.outputDir).toBe(testOutputDir)
    expect(result.lang).toBe('ts')
    expect(result.files).toBeArray()
    expect(result.files).toContain('package.json')
    expect(result.files).toContain('src/main.ts')
  })

  test('supports Python language option', async () => {
    const proc = Bun.spawn(
      ['bun', `${scriptsDir}/scaffold.ts`, 'test-adapter', '-o', testOutputDir, '--lang', 'python'],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const output = await new Response(proc.stdout).text()
    await proc.exited

    const result = JSON.parse(output)
    expect(result.lang).toBe('python')
    expect(result.files).toContain('adapter.py')
  })

  test('supports minimal option', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold.ts`, 'test-adapter', '-o', testOutputDir, '--minimal'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const output = await new Response(proc.stdout).text()
    await proc.exited

    const result = JSON.parse(output)
    expect(result.files).not.toContain('README.md')
  })

  test('exits with error when name is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold.ts`], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    expect(exitCode).toBe(1)
  })

  test('exits with error when directory exists', async () => {
    // Create the directory first
    await Bun.write(join(testOutputDir, '.gitkeep'), '')

    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold.ts`, 'test-adapter', '-o', testOutputDir], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    expect(exitCode).toBe(1)
  })

  test('shows help with --help flag', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold.ts`, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toContain('Usage:')
    expect(stderr).toContain('--output')
    expect(stderr).toContain('--lang')
  })
})

describe('check.ts', () => {
  test('exits with error when command is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/check.ts`], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    expect(exitCode).toBe(1)
  })

  test('shows help with --help flag', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/check.ts`, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toContain('Usage:')
    expect(stderr).toContain('--timeout')
    expect(stderr).toContain('--verbose')
  })

  test('outputs JSON with check result structure', async () => {
    // Use a simple echo command that will fail spawn check
    // This tests that the script produces valid JSON even on failure
    const proc = Bun.spawn(['bun', `${scriptsDir}/check.ts`, 'false'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const output = await new Response(proc.stdout).text()
    await proc.exited

    // Even failed checks should produce valid JSON
    const result = JSON.parse(output)
    expect(result).toHaveProperty('passed')
    expect(result).toHaveProperty('checks')
    expect(result).toHaveProperty('summary')
    expect(result.summary).toHaveProperty('total')
    expect(result.summary).toHaveProperty('passed')
    expect(result.summary).toHaveProperty('failed')
  })
})
