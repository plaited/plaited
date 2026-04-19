import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assembleTaskContext } from '../context.ts'
import { exportReview } from '../export-review.ts'
import { initDb } from '../init-db.ts'
import { resolveOperationalContext } from '../plaited-context.ts'
import { recordFindingEntry } from '../record-finding.ts'
import { scanWorkspace } from '../scan.ts'
import { searchWorkspace } from '../search.ts'

const tempDirs: string[] = []

const createTempWorkspace = async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'plaited-context-'))
  tempDirs.push(rootDir)

  await Bun.write(
    join(rootDir, 'src/example.ts'),
    `export const useBehavioralContext = () => 'behavioral context'
export const reportSnapshot = () => 'snapshot'
`,
  )

  await Bun.write(
    join(rootDir, 'skills/example-skill/SKILL.md'),
    `---
name: example-skill
description: Example skill for behavioral review.
license: ISC
compatibility: Requires bun
---

# Example Skill
`,
  )

  await Bun.write(
    join(rootDir, 'docs/example.md'),
    `# Example Doc

Use the behavioral context helper during review.
`,
  )

  return rootDir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('plaited-context scripts', () => {
  test('resolveOperationalContext honors explicit dbPath override', async () => {
    const context = await resolveOperationalContext({
      cwd: process.cwd(),
      dbPath: '/tmp/plaited-context-override.sqlite',
    })

    expect(context.dbPath).toBe('/tmp/plaited-context-override.sqlite')
    expect(context.workspaceRoot.length).toBeGreaterThan(0)
  })

  test('indexes workspace and exports recorded findings', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    const initOutput = await initDb({
      cwd: rootDir,
      dbPath,
    })

    expect(initOutput.ok).toBe(true)
    expect(initOutput.dbPath).toBe(dbPath)

    const scanOutput = await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['src', 'skills', 'docs'],
      force: true,
    })

    expect(scanOutput.ok).toBe(true)
    expect(scanOutput.filesIndexed).toBeGreaterThan(0)
    expect(scanOutput.symbolsIndexed).toBeGreaterThan(0)
    expect(scanOutput.skillsIndexed).toBeGreaterThan(0)
    expect(scanOutput.docsIndexed).toBeGreaterThan(0)

    const searchOutput = await searchWorkspace({
      cwd: rootDir,
      dbPath,
      query: 'behavioral',
      limit: 5,
      rootDir,
      fallbackToRipgrep: false,
    })

    expect(searchOutput.ok).toBe(true)
    expect(searchOutput.results.length).toBeGreaterThan(0)

    const contextOutput = await assembleTaskContext({
      cwd: rootDir,
      dbPath,
      task: 'review behavioral module',
      mode: 'review',
      paths: ['src/example.ts'],
    })

    expect(contextOutput.ok).toBe(true)
    expect(contextOutput.filesToRead).toContain('src/example.ts')

    const findingOutput = await recordFindingEntry({
      cwd: rootDir,
      dbPath,
      finding: {
        kind: 'pattern',
        status: 'candidate',
        summary: 'Use reportSnapshot for diagnostics.',
        evidence: [{ path: 'src/example.ts', line: 2, symbol: 'reportSnapshot' }],
      },
    })

    expect(findingOutput.ok).toBe(true)
    expect(findingOutput.evidenceCount).toBe(1)

    await expect(
      recordFindingEntry({
        cwd: rootDir,
        dbPath,
        finding: {
          kind: 'pattern',
          status: 'validated',
          summary: 'Validated findings need evidence.',
          evidence: [],
        },
      }),
    ).rejects.toThrow('Validated or retired findings require at least one evidence item.')

    const exportOutput = await exportReview({
      cwd: rootDir,
      dbPath,
      status: ['candidate'],
      format: 'json',
    })

    expect(exportOutput.ok).toBe(true)
    expect(exportOutput.findings.length).toBe(1)
    expect(exportOutput.findings[0]?.summary).toContain('reportSnapshot')
    expect(exportOutput.contextRuns.length).toBeGreaterThan(0)
  })
})
