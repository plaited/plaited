import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')

describe('scaffold-story', () => {
  test('generates basic story file without element', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-story.ts button`.json()

    expect(result.filePath).toEndWith('button.stories.tsx')
    expect(result.content).toContain("import { story } from 'plaited/testing'")
    expect(result.content).toContain('buttonStyles')
    expect(result.content).toContain('basicButton')
    expect(result.message).toContain('button.stories.tsx')
  })

  test('generates element story when --element is provided', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-story.ts toggle-input --element toggle-input`.json()

    expect(result.content).toContain("import { ToggleInput } from './toggle-input.ts'")
    expect(result.content).toContain('<ToggleInput />')
    expect(result.content).toContain('play({ findByAttribute, assert })')
  })

  test('converts kebab-case to PascalCase', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-story.ts my-custom-element --element my-custom-element`.json()

    expect(result.content).toContain('MyCustomElement')
    expect(result.content).toContain('basicMyCustomElement')
  })

  test('respects --output directory', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-story.ts card --output src/components`.json()

    expect(result.filePath).toContain('src/components/card.stories.tsx')
  })

  test('exits with error when name is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold-story.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})
