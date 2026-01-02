import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')

describe('scaffold-behavioral-template', () => {
  test('generates complete bElement scaffold', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-behavioral-template.ts toggle-input`.json()

    expect(result.files).toHaveLength(4)
    expect(result.message).toContain('toggle-input')

    const [tokensFile, stylesFile, elementFile, storyFile] = result.files

    // Tokens file
    expect(tokensFile.path).toEndWith('toggle-input.tokens.ts')
    expect(tokensFile.content).toContain("import { createTokens } from 'plaited'")

    // Styles file
    expect(stylesFile.path).toEndWith('toggle-input.css.ts')
    expect(stylesFile.content).toContain('createStyles')
    expect(stylesFile.content).toContain('createHostStyles')

    // Element file
    expect(elementFile.path).toEndWith('toggle-input.ts')
    expect(elementFile.content).toContain("import { bElement } from 'plaited'")
    expect(elementFile.content).toContain("tag: 'toggle-input'")

    // Story file
    expect(storyFile.path).toEndWith('toggle-input.stories.tsx')
    expect(storyFile.content).toContain("import { story } from 'plaited/testing'")
  })

  test('includes formAssociated when --form-associated is provided', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-behavioral-template.ts checkbox --form-associated`.json()

    const elementFile = result.files.find(
      (f: { path: string }) => f.path.endsWith('.ts') && !f.path.includes('.css.') && !f.path.includes('.tokens.'),
    )
    expect(elementFile.content).toContain('formAssociated: true')
    expect(elementFile.content).toContain('internals.setFormValue')
    expect(elementFile.content).toContain("internals.states.add('checked')")
  })

  test('respects --output directory', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-behavioral-template.ts my-btn --output src/components`.json()

    for (const file of result.files) {
      expect(file.path).toContain('src/components/')
    }
  })

  test('converts kebab-case to PascalCase for exports', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-behavioral-template.ts my-toggle-button`.json()

    const elementFile = result.files.find((f: { path: string }) => f.path.endsWith('my-toggle-button.ts'))
    expect(elementFile.content).toContain('export const MyToggleButton')
  })

  test('exits with error when name is missing', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold-behavioral-template.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})
