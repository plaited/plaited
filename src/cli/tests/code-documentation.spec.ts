import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

describe('codeDocumentationCli', () => {
  test('--help exits 0 and describes all four operations', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { codeDocumentationCli } from '../code-documentation.ts'",
          "await codeDocumentationCli['code-documentation'](['--help'])",
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('missing-docs')
    expect(stderr).toContain('public-exports')
    expect(stderr).toContain('orphaned-docs')
    expect(stderr).toContain('doc-coverage')
  })

  test('rejects empty targets array', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { codeDocumentationCli } from '../code-documentation.ts'",
          "await codeDocumentationCli['code-documentation']([JSON.stringify({ targets: [] })])",
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBeGreaterThan(0)
  })

  test('rejects no input', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { codeDocumentationCli } from '../code-documentation.ts'",
          "await codeDocumentationCli['code-documentation']([])",
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(2)
  })

  test('rejects non-JSON input', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { codeDocumentationCli } from '../code-documentation.ts'",
          "await codeDocumentationCli['code-documentation'](['not-json'])",
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(2)
  })

  test('--schema input emits JSON Schema and exits 0', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { codeDocumentationCli } from '../code-documentation.ts'",
          "await codeDocumentationCli['code-documentation'](['--schema', 'input'])",
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.properties).toHaveProperty('targets')
    expect(output.description).toContain('Code documentation')
  })

  test('--schema output emits output schema and exits 0', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { codeDocumentationCli } from '../code-documentation.ts'",
          "await codeDocumentationCli['code-documentation'](['--schema', 'output'])",
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.properties).toHaveProperty('targets')
    expect(output.properties).toHaveProperty('results')
  })

  test('--dry-run shows request details without executing', async () => {
    const input = { targets: ['src/cli/tests/fixtures/sample.ts'] }
    const inputJson = JSON.stringify(input)

    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { codeDocumentationCli } from '../code-documentation.ts'",
          `await codeDocumentationCli['code-documentation']([${JSON.stringify(inputJson)}, '--dry-run'])`,
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.command).toBe('code-documentation')
    expect(output.dryRun).toBe(true)
    expect(output.input).toEqual(input)
  })

  test('runs all four operations against a fixture file', async () => {
    const fixturePath = join(import.meta.dir, 'fixtures', 'sample.ts')
    const input = { targets: [fixturePath] }

    const inputJson = JSON.stringify(input)

    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        [
          "import { codeDocumentationCli } from '../code-documentation.ts'",
          `await codeDocumentationCli['code-documentation']([${JSON.stringify(inputJson)}])`,
        ].join(';\n'),
      ],
      { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())

    expect(output.targets).toEqual([fixturePath])
    expect(output.results).toHaveLength(4)

    const missingDocs = output.results.find((r: { type: string }) => r.type === 'missing-docs')
    const publicExports = output.results.find((r: { type: string }) => r.type === 'public-exports')
    const orphanedDocs = output.results.find((r: { type: string }) => r.type === 'orphaned-docs')
    const docCoverage = output.results.find((r: { type: string }) => r.type === 'doc-coverage')

    expect(missingDocs).toBeDefined()
    expect(publicExports).toBeDefined()
    expect(orphanedDocs).toBeDefined()
    expect(docCoverage).toBeDefined()

    // undocumentedValue is the only undocumented export
    expect(missingDocs.data).toEqual([expect.objectContaining({ name: 'undocumentedValue', documented: false })])

    // three exports: documentedValue, undocumentedValue, DocumentedType
    expect(publicExports.data).toHaveLength(3)
    expect(publicExports.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'documentedValue', documented: true }),
        expect.objectContaining({ name: 'undocumentedValue', documented: false }),
        expect.objectContaining({ name: 'DocumentedType', documented: true }),
      ]),
    )

    // one orphaned comment
    expect(orphanedDocs.data).toHaveLength(1)
    expect(orphanedDocs.data[0].preview).toBe('Orphaned comment block.')

    // coverage: 2/3 documented
    expect(docCoverage.data).toHaveLength(1)
    expect(docCoverage.data[0]).toEqual(
      expect.objectContaining({
        exported: 3,
        documented: 2,
        undocumented: 1,
      }),
    )
  })
})
