import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')

describe('scaffold-styles', () => {
  test('generates basic styles file', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-styles.ts button`.json()

    expect(result.filePath).toEndWith('button.css.ts')
    expect(result.content).toContain("import { createStyles } from 'plaited'")
    expect(result.content).toContain('buttonStyles')
    expect(result.message).toContain('button.css.ts')
  })

  test('generates host styles when --host flag is provided', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-styles.ts toggle --host`.json()

    expect(result.content).toContain('createHostStyles')
    expect(result.content).toContain('joinStyles')
    expect(result.content).toContain('hostStyles')
  })

  test('respects --output directory', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-styles.ts card --output src/components`.json()

    expect(result.filePath).toContain('src/components/card.css.ts')
  })

  test('includes state variations in styles', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-styles.ts test`.json()

    expect(result.content).toContain('$default')
    expect(result.content).toContain(':hover')
  })

  test('exits with error when name is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold-styles.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})
