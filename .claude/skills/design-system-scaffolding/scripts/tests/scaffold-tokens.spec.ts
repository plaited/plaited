import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')

describe('scaffold-tokens', () => {
  test('generates token file scaffold with name and namespace', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-tokens.ts fills fills`.json()

    expect(result.filePath).toEndWith('fills.tokens.ts')
    expect(result.content).toContain("import { createTokens } from 'plaited'")
    expect(result.content).toContain("export const { fills } = createTokens('fills'")
    expect(result.message).toContain('fills.tokens.ts')
  })

  test('respects --output directory', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-tokens.ts colors colors --output src/tokens`.json()

    expect(result.filePath).toContain('src/tokens/colors.tokens.ts')
  })

  test('includes scale pattern example', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-tokens.ts test test`.json()

    expect(result.content).toContain('fill: {')
    expect(result.content).toContain('default: { $value:')
    expect(result.content).toContain('checked: { $value:')
    expect(result.content).toContain('hover: { $value:')
  })

  test('exits with error when name is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold-tokens.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })

  test('exits with error when namespace is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold-tokens.ts`, 'fills'], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})
