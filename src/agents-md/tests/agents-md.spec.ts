import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

const createTempRoot = (): string =>
  join('/tmp', `plaited-agents-md-tests-${Date.now()}-${Math.random().toString(16).slice(2)}`)

const withTempRoot = async (run: (rootDir: string) => Promise<void>): Promise<void> => {
  const rootDir = createTempRoot()
  await Bun.$`mkdir -p ${rootDir}`

  try {
    await run(rootDir)
  } finally {
    await Bun.$`rm -rf ${rootDir}`
  }
}

const writeAgentsFile = async ({
  rootDir,
  relativeDir = '.',
  body,
}: {
  rootDir: string
  relativeDir?: string
  body: string
}): Promise<void> => {
  const directoryPath = relativeDir === '.' ? rootDir : join(rootDir, relativeDir)
  await Bun.$`mkdir -p ${directoryPath}`
  await Bun.write(join(directoryPath, 'AGENTS.md'), body)
}

const runPlaitedCommand = async (args: string[]) =>
  Bun.$`bun ./bin/plaited.ts ${args}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

const runAgentsMdCommand = async (input: unknown) =>
  Bun.$`bun ./bin/plaited.ts agents-md ${JSON.stringify(input)}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

describe('agents-md CLI', () => {
  test('plaited --schema includes agents-md', async () => {
    const result = await runPlaitedCommand(['--schema'])

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.commands).toContain('agents-md')
  })

  test('plaited agents-md --schema input and output expose mode contracts', async () => {
    const inputResult = await runPlaitedCommand(['agents-md', '--schema', 'input'])
    expect(inputResult.exitCode).toBe(0)
    const inputSchema = JSON.parse(inputResult.stdout.toString().trim())
    expect(inputSchema.description).toContain('mode-discriminated')
    expect(inputSchema.anyOf ?? inputSchema.oneOf).toHaveLength(2)

    const outputResult = await runPlaitedCommand(['agents-md', '--schema', 'output'])
    expect(outputResult.exitCode).toBe(0)
    const outputSchema = JSON.parse(outputResult.stdout.toString().trim())
    expect(outputSchema.description).toContain('matching the selected mode')
    expect(outputSchema.anyOf ?? outputSchema.oneOf).toHaveLength(2)
  })

  test('mode=relevant returns root and scoped AGENTS.md entries for target paths', async () => {
    await withTempRoot(async (rootDir) => {
      await writeAgentsFile({ rootDir, body: '# Root\n\nRoot instructions.' })
      await writeAgentsFile({ rootDir, relativeDir: 'src', body: '# Source\n\nSource instructions.' })
      await writeAgentsFile({ rootDir, relativeDir: 'docs', body: '# Docs\n\nDocs instructions.' })

      const result = await runAgentsMdCommand({
        mode: 'relevant',
        rootDir,
        paths: ['src/feature/file.ts'],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.mode).toBe('relevant')
      expect(output.paths).toEqual(['src/feature/file.ts'])
      expect(output.entries.map((entry: { path: string }) => entry.path)).toEqual(['AGENTS.md', 'src/AGENTS.md'])
      expect(output.warnings).toEqual([])
    })
  })

  test('mode=relevant orders entries from root to matching dot-prefixed scopes', async () => {
    await withTempRoot(async (rootDir) => {
      await writeAgentsFile({ rootDir, body: '# Root\n\nRoot instructions.' })
      await writeAgentsFile({
        rootDir,
        relativeDir: '.worktrees',
        body: '# Worktrees\n\nShared worktree instructions.',
      })
      await writeAgentsFile({
        rootDir,
        relativeDir: '.worktrees/local',
        body: '# Local\n\nLocal worktree instructions.',
      })

      const result = await runAgentsMdCommand({
        mode: 'relevant',
        rootDir,
        paths: ['.worktrees/local/src/file.ts'],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.entries.map((entry: { path: string }) => entry.path)).toEqual([
        'AGENTS.md',
        '.worktrees/AGENTS.md',
        '.worktrees/local/AGENTS.md',
      ])
    })
  })

  test('mode=list emits missing local links as warnings without failing', async () => {
    await withTempRoot(async (rootDir) => {
      await writeAgentsFile({
        rootDir,
        body: '# Root\n\nSee [local guide](docs/guide.md) and [missing guide](docs/missing.md).',
      })
      await Bun.$`mkdir -p ${join(rootDir, 'docs')}`
      await Bun.write(join(rootDir, 'docs', 'guide.md'), '# Guide')

      const result = await runAgentsMdCommand({
        mode: 'list',
        rootDir,
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.mode).toBe('list')
      expect(output.entries).toHaveLength(1)
      expect(output.entries[0]?.links.present).toEqual([{ value: 'docs/guide.md', text: 'local guide' }])
      expect(output.entries[0]?.links.missing).toEqual([{ value: 'docs/missing.md', text: 'missing guide' }])
      expect(output.warnings).toEqual([
        {
          code: 'missing_local_link',
          path: 'AGENTS.md',
          link: {
            value: 'docs/missing.md',
            text: 'missing guide',
          },
          message: 'Missing local markdown link: docs/missing.md',
        },
      ])
    })
  })

  test('default ignore patterns apply while .worktrees remains discoverable', async () => {
    await withTempRoot(async (rootDir) => {
      await writeAgentsFile({ rootDir, body: '# Root\n\nRoot instructions.' })
      await writeAgentsFile({ rootDir, relativeDir: 'node_modules/pkg', body: '# Ignored\n\nIgnored instructions.' })
      await writeAgentsFile({ rootDir, relativeDir: '.worktrees/local', body: '# Worktree\n\nWorktree instructions.' })

      const result = await runAgentsMdCommand({ mode: 'list', rootDir })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.entries.map((entry: { path: string }) => entry.path)).toEqual([
        '.worktrees/local/AGENTS.md',
        'AGENTS.md',
      ])
    })
  })

  test('mode=relevant rejects path traversal outside rootDir', async () => {
    await withTempRoot(async (rootDir) => {
      await writeAgentsFile({ rootDir, body: '# Root\n\nRoot instructions.' })

      const result = await runAgentsMdCommand({
        mode: 'relevant',
        rootDir,
        paths: ['../outside.ts'],
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr.toString()).toContain('Path escapes rootDir: ../outside.ts')
    })
  })
})
