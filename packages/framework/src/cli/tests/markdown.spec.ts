import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('markdownCli', () => {
  test('--help exits 0 and describes all three modes', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        ["import { markdownCli } from '../markdown.ts'", "await markdownCli.markdown(['--help'])"].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('extract-links')
    expect(stderr).toContain('validate-links')
    expect(stderr).toContain('frontmatter')
  })

  test('extract-links returns sorted local links from markdown input', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { markdownCli } from '../markdown.ts'",
          "const input = { mode: 'extract-links', markdown: '[b](scripts/b.ts) [a](scripts/a.ts) ![d](assets/d.png)' }",
          'await markdownCli.markdown([JSON.stringify(input)])',
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({
      mode: 'extract-links',
      result: [
        { value: 'assets/d.png', text: 'd' },
        { value: 'scripts/a.ts', text: 'a' },
        { value: 'scripts/b.ts', text: 'b' },
      ],
    })
  })

  test('extract-links returns empty result for markdown with no local links', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { markdownCli } from '../markdown.ts'",
          "const input = { mode: 'extract-links', markdown: 'Hello **world** [remote](https://example.com)' }",
          'await markdownCli.markdown([JSON.stringify(input)])',
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({ mode: 'extract-links', result: [] })
  })

  test('exits 2 on invalid JSON input', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        ["import { markdownCli } from '../markdown.ts'", "await markdownCli.markdown(['not-json'])"].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(2)
  })

  test('exits 2 on schema validation failure', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { markdownCli } from '../markdown.ts'",
          "const input = { mode: 'extract-links', markdown: '' }",
          'await markdownCli.markdown([JSON.stringify(input)])',
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(2)
  })

  test('exits 2 when no input is provided', async () => {
    const proc = Bun.spawn(
      ['bun', '-e', ["import { markdownCli } from '../markdown.ts'", 'await markdownCli.markdown([])'].join(';\n')],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(2)
  })

  test('--schema input emits JSON Schema and exits 0', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        ["import { markdownCli } from '../markdown.ts'", "await markdownCli.markdown(['--schema', 'input'])"].join(
          ';\n',
        ),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.oneOf).toHaveLength(3)
    expect(output.oneOf[0].properties).toHaveProperty('mode')
  })

  test('--schema output emits output schema and exits 0', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        ["import { markdownCli } from '../markdown.ts'", "await markdownCli.markdown(['--schema', 'output'])"].join(
          ';\n',
        ),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.oneOf).toHaveLength(3)
    expect(output.oneOf[0].properties).toHaveProperty('mode')
  })

  test('exits 2 on invalid --schema target', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        ["import { markdownCli } from '../markdown.ts'", "await markdownCli.markdown(['--schema', 'bad'])"].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(2)
  })

  test('--dry-run shows request details without running the command', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { markdownCli } from '../markdown.ts'",
          "const input = { mode: 'extract-links', markdown: '[x](doc.md)' }",
          "await markdownCli.markdown([JSON.stringify(input), '--dry-run'])",
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({
      command: 'markdown',
      input: { mode: 'extract-links', markdown: '[x](doc.md)' },
      dryRun: true,
    })
  })

  test('validate-links returns present and missing links', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'plaited-markdown-cli-'))

    try {
      await mkdir(join(baseDir, 'docs'), { recursive: true })
      await Bun.write(join(baseDir, 'docs', 'guide.md'), '# guide')

      const proc = Bun.spawn(
        [
          'bun',
          '-e',
          [
            "import { markdownCli } from '../markdown.ts'",
            `const input = { mode: 'validate-links', directory: '${baseDir}', markdownBody: 'See [guide](docs/guide.md) and [missing](docs/missing.md)' }`,
            'await markdownCli.markdown([JSON.stringify(input)])',
          ].join(';\n'),
        ],
        { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
      )

      expect(await proc.exited).toBe(0)
      const output = JSON.parse(await new Response(proc.stdout).text())
      expect(output).toEqual({
        mode: 'validate-links',
        result: {
          present: [{ value: 'docs/guide.md', text: 'guide' }],
          missing: [{ value: 'docs/missing.md', text: 'missing' }],
        },
      })
    } finally {
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  test('frontmatter returns parsed frontmatter and body', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { markdownCli } from '../markdown.ts'",
          "const input = { mode: 'frontmatter', markdown: '---\\ntitle: Hello\\n---\\n\\nBody text' }",
          'await markdownCli.markdown([JSON.stringify(input)])',
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({
      mode: 'frontmatter',
      result: {
        frontmatter: { title: 'Hello' },
        body: 'Body text',
      },
    })
  })

  test('frontmatter returns null frontmatter and full body when no frontmatter block exists', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { markdownCli } from '../markdown.ts'",
          "const input = { mode: 'frontmatter', markdown: 'Just a plain markdown document.' }",
          'await markdownCli.markdown([JSON.stringify(input)])',
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({
      mode: 'frontmatter',
      result: {
        frontmatter: null,
        body: 'Just a plain markdown document.',
      },
    })
  })
})
