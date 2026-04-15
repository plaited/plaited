import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import ts from 'typescript'
import {
  codeDocumentationCli,
  executeDocumentationAudit,
  getOrphanedComments,
  resolvePath,
  resolveTargets,
} from '../scripts/code-documentation.ts'

const fixtureFile = join(import.meta.dir, 'fixtures', 'sample.ts')

describe('resolvePath', () => {
  test('returns absolute path as-is', () => {
    expect(resolvePath('/tmp/example.ts')).toBe('/tmp/example.ts')
  })

  test('resolves relative path from cwd', () => {
    expect(resolvePath('src/example.ts', '/repo')).toBe('/repo/src/example.ts')
  })
})

describe('resolveTargets', () => {
  test('resolves explicit files', async () => {
    const targets = await resolveTargets([fixtureFile])
    expect(targets).toEqual([fixtureFile])
  })

  test('resolves glob targets', async () => {
    const targets = await resolveTargets(['skills/code-documentation/tests/fixtures/*.ts'], process.cwd())
    expect(targets).toContain(fixtureFile)
  })
})

describe('documentation analysis helpers', () => {
  test('finds exported declarations and documentation status', async () => {
    const text = await Bun.file(fixtureFile).text()
    const parsed = await executeDocumentationAudit({ targets: [fixtureFile] }, [{ type: 'public-exports' }])
    const exportsResult = parsed.results[0]?.data as Array<{ name: string; documented: boolean }>

    expect(text.length).toBeGreaterThan(0)
    expect(exportsResult).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'documentedValue', documented: true }),
        expect.objectContaining({ name: 'undocumentedValue', documented: false }),
        expect.objectContaining({ name: 'DocumentedType', documented: true }),
      ]),
    )
  })

  test('reports missing docs', async () => {
    const result = await executeDocumentationAudit({ targets: [fixtureFile] }, [{ type: 'missing-docs' }])
    const missing = result.results[0]?.data as Array<{ name: string }>

    expect(missing).toEqual([expect.objectContaining({ name: 'undocumentedValue' })])
  })

  test('reports orphaned docs', async () => {
    const text = await Bun.file(fixtureFile).text()
    const sourceFile = ts.createSourceFile(fixtureFile, text, ts.ScriptTarget.Latest, true)
    const orphaned = getOrphanedComments(fixtureFile, sourceFile)

    expect(orphaned).toEqual([expect.objectContaining({ preview: 'Orphaned comment block.' })])
  })

  test('reports per-file coverage', async () => {
    const result = await executeDocumentationAudit({ targets: [fixtureFile] }, [{ type: 'doc-coverage' }])
    const coverage = result.results[0]?.data as Array<{ documented: number; exported: number; undocumented: number }>

    expect(coverage).toEqual([
      expect.objectContaining({
        exported: 3,
        documented: 2,
        undocumented: 1,
      }),
    ])
  })
})

describe('CLI', () => {
  test('prints help', async () => {
    const consoleLog = console.log
    const lines: string[] = []
    console.log = (value?: unknown) => lines.push(String(value ?? ''))

    try {
      await codeDocumentationCli(['--help'])
    } finally {
      console.log = consoleLog
    }

    expect(lines.join('\n')).toContain('code-documentation skill')
  })
})
