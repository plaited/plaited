import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cacheEvidence } from '../cache-evidence.ts'
import { exportReview } from '../export-review.ts'
import { initDb } from '../init-db.ts'
import { queryCache } from '../query-cache.ts'
import { recordFindingEntry } from '../record-finding.ts'

const tempDirs: string[] = []

const createTempDbPath = async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'plaited-context-persistence-'))
  tempDirs.push(rootDir)
  return {
    rootDir,
    dbPath: join(rootDir, '.plaited/context.sqlite'),
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('plaited-context persistence scripts', () => {
  test('init-db creates the database and reports idempotent state', async () => {
    const { rootDir, dbPath } = await createTempDbPath()
    const first = await initDb({ cwd: rootDir, dbPath })
    const second = await initDb({ cwd: rootDir, dbPath })

    expect(first.ok).toBe(true)
    expect(first.created).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.created).toBe(false)
  })

  test('record-finding and export-review return stored findings', async () => {
    const { rootDir, dbPath } = await createTempDbPath()
    await initDb({ cwd: rootDir, dbPath })

    const findingResult = await recordFindingEntry({
      cwd: rootDir,
      dbPath,
      finding: {
        kind: 'pattern',
        status: 'candidate',
        summary: 'Use plaited CLI evidence commands before review synthesis.',
        evidence: [{ path: 'AGENTS.md', line: 1, symbol: 'Rules' }],
      },
    })

    expect(findingResult.ok).toBe(true)
    expect(findingResult.evidenceCount).toBe(1)

    await expect(
      recordFindingEntry({
        cwd: rootDir,
        dbPath,
        finding: {
          kind: 'pattern',
          status: 'validated',
          summary: 'Validated finding without evidence should fail.',
          evidence: [],
        },
      }),
    ).rejects.toThrow('Validated or retired findings require at least one evidence item.')

    const exported = await exportReview({
      cwd: rootDir,
      dbPath,
      status: ['candidate'],
      format: 'json',
    })

    expect(exported.ok).toBe(true)
    expect(exported.findings).toHaveLength(1)
    expect(Array.isArray(exported.cachedEvidence)).toBe(true)
    expect(exported.cachedEvidence).toHaveLength(0)
    expect(exported.findings[0]?.summary).toContain('plaited CLI evidence commands')
  })

  test('cache-evidence upserts keyed rows and query-cache returns filtered rows', async () => {
    const { rootDir, dbPath } = await createTempDbPath()
    await initDb({ cwd: rootDir, dbPath })

    const initialWrite = await cacheEvidence({
      cwd: rootDir,
      dbPath,
      tool: 'git',
      topic: 'context',
      key: 'src/worker',
      summary: 'initial git context snapshot',
      command: `bun ./bin/plaited.ts git '{"mode":"context"}'`,
      tags: ['review', 'worker'],
      input: { mode: 'context', paths: ['src/worker/worker.ts'] },
      output: { ok: true, dirty: { isDirty: false } },
    })

    expect(initialWrite.ok).toBe(true)
    expect(initialWrite.record.replaced).toBe(false)

    const upsertWrite = await cacheEvidence({
      cwd: rootDir,
      dbPath,
      tool: 'git',
      topic: 'context',
      key: 'src/worker',
      summary: 'updated git context snapshot',
      command: `bun ./bin/plaited.ts git '{"mode":"context"}'`,
      tags: ['review', 'worker'],
      input: { mode: 'context', paths: ['src/worker/worker.ts'] },
      output: { ok: true, dirty: { isDirty: true } },
    })

    expect(upsertWrite.ok).toBe(true)
    expect(upsertWrite.record.replaced).toBe(true)
    expect(upsertWrite.record.id).toBe(initialWrite.record.id)

    await cacheEvidence({
      cwd: rootDir,
      dbPath,
      tool: 'wiki',
      topic: 'diagnose',
      summary: 'wiki cleanup warnings',
      tags: ['docs'],
      input: { mode: 'diagnose' },
      output: { warnings: [{ kind: 'missing-target-file' }] },
    })

    const filtered = await queryCache({
      cwd: rootDir,
      dbPath,
      tool: 'git',
      topic: 'context',
      limit: 10,
      includePayload: true,
    })

    expect(filtered.ok).toBe(true)
    expect(filtered.count).toBe(1)
    expect(filtered.entries[0]?.summary).toBe('updated git context snapshot')
    expect(filtered.entries[0]?.output).toEqual({ ok: true, dirty: { isDirty: true } })

    const exported = await exportReview({
      cwd: rootDir,
      dbPath,
      status: ['candidate', 'validated', 'retired'],
      format: 'json',
      cacheLimit: 10,
    })
    expect(exported.cachedEvidence).toHaveLength(2)
    expect(exported.cachedEvidence[0]?.tool).toBe('wiki')
    expect(exported.cachedEvidence[1]?.tool).toBe('git')

    const textFiltered = await queryCache({
      cwd: rootDir,
      dbPath,
      text: 'cleanup warnings',
      limit: 10,
      includePayload: false,
    })

    expect(textFiltered.count).toBe(1)
    expect(textFiltered.entries[0]?.tool).toBe('wiki')
    expect('input' in (textFiltered.entries[0] ?? {})).toBe(false)
    expect('output' in (textFiltered.entries[0] ?? {})).toBe(false)
  })
})
