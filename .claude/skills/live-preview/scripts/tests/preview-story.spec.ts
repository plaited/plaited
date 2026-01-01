import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')

describe('preview-story', () => {
  test('generates story URL with default port', async () => {
    const result = await $`bun ${scriptsDir}/preview-story.ts src/button.stories.tsx PrimaryButton`.json()

    expect(result.url).toBe('http://localhost:3000/src/button--primary-button')
    expect(result.templateUrl).toBe('http://localhost:3000/src/button--primary-button.template')
    expect(result.storyFile).toBe('src/button.stories.tsx')
    expect(result.exportName).toBe('PrimaryButton')
    expect(result.route).toBe('/src/button--primary-button')
  })

  test('respects --port option', async () => {
    const result = await $`bun ${scriptsDir}/preview-story.ts src/button.stories.tsx PrimaryButton --port 3500`.json()

    expect(result.url).toBe('http://localhost:3500/src/button--primary-button')
    expect(result.templateUrl).toBe('http://localhost:3500/src/button--primary-button.template')
  })

  test('handles nested paths', async () => {
    const result = await $`bun ${scriptsDir}/preview-story.ts src/components/forms/input.stories.tsx TextInput`.json()

    expect(result.route).toBe('/src/components/forms/input--text-input')
  })

  test('converts camelCase export names to kebab-case', async () => {
    const result = await $`bun ${scriptsDir}/preview-story.ts src/toggle.stories.tsx toggleButtonWithLabel`.json()

    expect(result.route).toContain('toggle-button-with-label')
  })

  test('exits with error when file path is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/preview-story.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })

  test('exits with error when export name is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/preview-story.ts`, 'src/button.stories.tsx'], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})
