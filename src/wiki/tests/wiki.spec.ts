import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')
const TYPESCRIPT_LSP_RUNNER_COMMAND = 'bun skills/typescript-lsp/scripts/run.ts '

const findTypescriptLspCommand = (commands: string[]): string | undefined =>
  commands.find((command) => command.startsWith(TYPESCRIPT_LSP_RUNNER_COMMAND))

const parseTypescriptLspCommandPayload = (
  command: string,
): {
  file?: string
  files?: string[]
  targets?: string[]
  operations: Array<{ type: string }>
} => {
  const quotedPayload = command.slice(TYPESCRIPT_LSP_RUNNER_COMMAND.length)
  expect(quotedPayload.startsWith("'")).toBeTrue()
  expect(quotedPayload.endsWith("'")).toBeTrue()
  const jsonPayload = quotedPayload.slice(1, -1).replaceAll(`'"'"'`, `'`)
  return JSON.parse(jsonPayload) as {
    file?: string
    files?: string[]
    targets?: string[]
    operations: Array<{ type: string }>
  }
}

describe('wiki CLI', () => {
  test('plaited --schema includes wiki command', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts --schema`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as { commands: string[] }
    expect(output.commands).toContain('wiki')
  })

  test('context mode ranks relevant docs from supplied paths and excludes AGENTS.md and skills', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'plaited-wiki-context-'))

    try {
      await mkdir(join(rootDir, 'docs'), { recursive: true })
      await mkdir(join(rootDir, 'skills', 'example-skill'), { recursive: true })
      await Bun.write(
        join(rootDir, 'docs', 'runtime-boundary.md'),
        '# Runtime Boundary\n\nWorker runtime boundary notes.\n',
      )
      await Bun.write(join(rootDir, 'docs', 'changelog.md'), '# Changelog\n\nRelease notes.\n')
      await Bun.write(join(rootDir, 'docs', 'AGENTS.md'), '# nested instructions\n')
      await Bun.write(
        join(rootDir, 'skills', 'example-skill', 'SKILL.md'),
        '---\nname: example-skill\ndescription: example\n---\n\n# Example\n',
      )

      const result = await Bun.$`bun ./bin/plaited.ts wiki ${JSON.stringify({
        mode: 'context',
        rootDir,
        paths: ['docs', 'skills'],
        task: 'review runtime boundary',
      })}`
        .cwd(CLI_PACKAGE_ROOT)
        .quiet()
        .nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim()) as {
        pages: Array<{ path: string }>
      }

      expect(output.pages[0]?.path).toBe('docs/runtime-boundary.md')
      expect(output.pages.some((page) => page.path.endsWith('AGENTS.md'))).toBeFalse()
      expect(output.pages.some((page) => page.path.startsWith('skills/'))).toBeFalse()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('diagnose mode returns broken-link warnings and suggested cross-check commands', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'plaited-wiki-diagnose-'))
    const outsideDir = await mkdtemp(join(tmpdir(), 'plaited-wiki-diagnose-outside-'))

    try {
      await mkdir(join(rootDir, 'docs'), { recursive: true })
      await Bun.write(
        join(rootDir, 'docs', 'guide.md'),
        `# Guide

See [missing](./missing.md).
See [outside](../../${outsideDir.split('/').pop()}/outside.md).
`,
      )

      const result = await Bun.$`bun ./bin/plaited.ts wiki ${JSON.stringify({
        mode: 'diagnose',
        rootDir,
        paths: ['docs'],
      })}`
        .cwd(CLI_PACKAGE_ROOT)
        .quiet()
        .nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim()) as {
        warnings: Array<{ kind: string; path: string }>
        suggestedNextCommands: string[]
      }

      expect(output.warnings.some((warning) => warning.kind === 'missing-target-file')).toBeTrue()
      expect(output.warnings.some((warning) => warning.kind === 'broken-local-link')).toBeTrue()
      expect(output.suggestedNextCommands.some((command) => command.includes('git '))).toBeTrue()
      const lspCommand = findTypescriptLspCommand(output.suggestedNextCommands)
      expect(lspCommand).toBeUndefined()
      expect(output.suggestedNextCommands.some((command) => command.includes('plaited.ts typescript-lsp'))).toBeFalse()
      expect(output.suggestedNextCommands.some((command) => command.includes('skills'))).toBeTrue()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
      await rm(outsideDir, { recursive: true, force: true })
    }
  })

  test('diagnose mode emits a runnable workspace-scan LSP suggestion for code paths', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts wiki ${JSON.stringify({
      mode: 'diagnose',
      rootDir: CLI_PACKAGE_ROOT,
      paths: ['src/wiki'],
    })}`
      .cwd(CLI_PACKAGE_ROOT)
      .quiet()
      .nothrow()

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      suggestedNextCommands: string[]
    }

    const lspCommand = findTypescriptLspCommand(output.suggestedNextCommands)
    expect(lspCommand).toBeString()
    if (!lspCommand) return

    const payload = parseTypescriptLspCommandPayload(lspCommand)
    expect(payload.file).toBe('src/wiki/wiki.schemas.ts')
    expect(payload.file).not.toBe('skills/typescript-lsp/scripts/run.ts')
    expect(payload.files).toEqual(['src/wiki/wiki.schemas.ts'])
    expect(payload.operations).toEqual([{ type: 'workspace_scan' }])
    expect(payload.targets).toBeUndefined()

    const lspResult = await Bun.$`bun skills/typescript-lsp/scripts/run.ts ${JSON.stringify(payload)}`
      .cwd(CLI_PACKAGE_ROOT)
      .quiet()
      .nothrow()

    expect(lspResult.exitCode).toBe(0)
    const lspOutput = JSON.parse(lspResult.stdout.toString().trim()) as {
      results: Array<{ type: string; data?: unknown }>
    }
    const workspaceScanResult = lspOutput.results.find((entry) => entry.type === 'workspace_scan')
    expect(workspaceScanResult).toBeDefined()
  })

  test('diagnose mode shell-quotes unsafe path fragments in suggested commands', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'plaited-wiki-quoted-path-'))

    try {
      const unsafePath = `docs/unsafe'$(echo hi).md`
      const result = await Bun.$`bun ./bin/plaited.ts wiki ${JSON.stringify({
        mode: 'diagnose',
        rootDir,
        paths: [unsafePath],
      })}`
        .cwd(CLI_PACKAGE_ROOT)
        .quiet()
        .nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim()) as {
        suggestedNextCommands: string[]
      }

      expect(
        output.suggestedNextCommands.some((command) => command.includes(`'docs/unsafe'"'"'$(echo hi).md'`)),
      ).toBeTrue()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('applies default ignore globs and additive user ignore globs', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'plaited-wiki-ignore-'))

    try {
      await mkdir(join(rootDir, 'docs'), { recursive: true })
      await mkdir(join(rootDir, 'node_modules', 'fake-pkg'), { recursive: true })
      await Bun.write(join(rootDir, 'docs', 'keep.md'), '# Keep\n')
      await Bun.write(join(rootDir, 'docs', 'skip.md'), '# Skip\n')
      await Bun.write(join(rootDir, 'node_modules', 'fake-pkg', 'readme.md'), '# Package\n')

      const result = await Bun.$`bun ./bin/plaited.ts wiki ${JSON.stringify({
        mode: 'diagnose',
        rootDir,
        paths: ['.'],
        ignore: ['**/skip.md'],
      })}`
        .cwd(CLI_PACKAGE_ROOT)
        .quiet()
        .nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim()) as {
        pages: Array<{ path: string }>
      }

      expect(output.pages.some((page) => page.path === 'docs/keep.md')).toBeTrue()
      expect(output.pages.some((page) => page.path === 'docs/skip.md')).toBeFalse()
      expect(output.pages.some((page) => page.path.includes('node_modules'))).toBeFalse()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('ignores direct non-markdown file inputs', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'plaited-wiki-non-markdown-'))

    try {
      await mkdir(join(rootDir, 'docs'), { recursive: true })
      await Bun.write(join(rootDir, 'docs', 'notes.txt'), 'notes')
      await Bun.write(join(rootDir, 'docs', 'guide.md'), '# Guide')

      const result = await Bun.$`bun ./bin/plaited.ts wiki ${JSON.stringify({
        mode: 'diagnose',
        rootDir,
        paths: ['docs/notes.txt', 'docs/guide.md'],
      })}`
        .cwd(CLI_PACKAGE_ROOT)
        .quiet()
        .nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim()) as {
        pages: Array<{ path: string }>
      }

      expect(output.pages.some((page) => page.path === 'docs/guide.md')).toBeTrue()
      expect(output.pages.some((page) => page.path === 'docs/notes.txt')).toBeFalse()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
