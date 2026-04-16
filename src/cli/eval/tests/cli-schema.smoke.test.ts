/**
 * Smoke tests for CLI schema discovery via bunx plaited.
 *
 * @remarks
 * These tests verify that the package's CLI bin is correctly configured and
 * that schema discovery commands emit valid JSON Schema output.
 */

import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

// Use the installed bin path via bunx
// Since these are smoke tests, we verify the bin exists and the CLI responds

describe('CLI schema discovery smoke tests', () => {
  const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../../')

  test('plaited --schema emits command manifest', async () => {
    const result = await Bun.$`bunx plaited --schema`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.name).toBe('plaited')
    expect(output.commands).toContain('eval')
    expect(output.commands).toContain('compare-trials')
  })

  test('plaited eval --schema input emits EvalInputSchema', async () => {
    const result = await Bun.$`bunx plaited eval --schema input`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const schema = JSON.parse(result.stdout.toString().trim())
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
    expect(schema.properties.adapterPath).toBeDefined()
    expect(schema.properties.promptsPath).toBeDefined()
  })

  test('plaited eval --schema output emits EvalOutputSchema', async () => {
    const result = await Bun.$`bunx plaited eval --schema output`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const schema = JSON.parse(result.stdout.toString().trim())
    // EvalOutputSchema is z.array(TrialResultSchema)
    expect(schema.type).toBe('array')
    expect(schema.items).toBeDefined()
    expect(schema.items.type).toBe('object')
    expect(schema.items.properties.id).toBeDefined()
    expect(schema.items.properties.trials).toBeDefined()
  })

  test('plaited compare-trials --schema input emits CompareTrialsInputSchema', async () => {
    const result = await Bun.$`bunx plaited compare-trials --schema input`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const schema = JSON.parse(result.stdout.toString().trim())
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
    expect(schema.properties.baselinePath).toBeDefined()
    expect(schema.properties.challengerPath).toBeDefined()
  })

  test('plaited compare-trials --schema output emits CompareTrialsOutputSchema', async () => {
    const result = await Bun.$`bunx plaited compare-trials --schema output`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const schema = JSON.parse(result.stdout.toString().trim())
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
    expect(schema.properties.baseline).toBeDefined()
    expect(schema.properties.challenger).toBeDefined()
    expect(schema.properties.summary).toBeDefined()
  })
})
