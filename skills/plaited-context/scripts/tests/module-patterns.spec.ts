import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { initDb } from '../init-db.ts'
import { checkModulePatterns, ModulePatternCheckOutputSchema } from '../module-patterns.ts'
import { closeContextDatabase, openContextDatabase } from '../plaited-context.ts'

const SCRIPT_PATH = new URL('../module-patterns.ts', import.meta.url).pathname

const tempDirs: string[] = []

const writeFixture = async ({ name, source }: { name: string; source: string }) => {
  const dir = await mkdtemp(join(tmpdir(), 'plaited-context-module-patterns-'))
  tempDirs.push(dir)
  const file = join(dir, name)
  await Bun.write(file, source)
  return file
}

const runCli = async (args: string[]) => {
  const proc = Bun.spawn(['bun', SCRIPT_PATH, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('module-patterns', () => {
  test('flags zod recovery in returned internal handlers', async () => {
    const file = await writeFixture({
      name: 'bad-zod-recovery.ts',
      source: `
import * as z from 'zod'

const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('mod', (_ctx) => ({
  [EVENTS.start](detail: unknown) {
    try {
      StartSchema.parse(detail)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return
      }
      throw error
    }
  },
}))
`,
    })

    const output = await checkModulePatterns({ files: [file] })
    expect(output.ok).toBe(false)
    expect(output.findings.some((finding) => finding.ruleId === 'module/no-internal-zod-recovery')).toBe(true)
  })

  test('accepts strict internal parse without local recovery', async () => {
    const file = await writeFixture({
      name: 'clean.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('mod', (_ctx) => ({
  [EVENTS.start](detail: unknown) {
    StartSchema.parse(detail)
  },
}))
`,
    })

    const output = await checkModulePatterns({ files: [file] })
    expect(output.ok).toBe(true)
    expect(output.findings).toEqual([])
  })

  test('records deterministic findings to SQLite when record is true', async () => {
    const file = await writeFixture({
      name: 'recordable.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('mod', (_ctx) => ({
  [EVENTS.start](detail: unknown) {
    const parsed = StartSchema.safeParse(detail)
    if (!parsed.success) {
      return
    }
  },
}))
`,
    })

    const dbPath = join(dirname(file), '.plaited/context.sqlite')
    await initDb({
      cwd: dirname(file),
      dbPath,
    })

    const output = await checkModulePatterns({
      cwd: dirname(file),
      dbPath,
      files: [file],
      record: true,
    })

    expect(output.ok).toBe(false)

    const db = await openContextDatabase({ dbPath })
    try {
      const rows = db
        .query(
          `SELECT kind, status, summary
           FROM findings
           WHERE summary LIKE 'module/no-safeparse-in-internal-handler:%'`,
        )
        .all() as Array<{ kind: string; status: string; summary: string }>

      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0]?.kind).toBe('anti-pattern')
      expect(rows[0]?.status).toBe('validated')
    } finally {
      closeContextDatabase(db)
    }
  })

  test('exits 2 for missing file and invalid input', async () => {
    const missingPath = join(tmpdir(), 'does-not-exist-module-patterns.ts')

    const missingResult = await runCli([JSON.stringify({ files: [missingPath] })])
    expect(missingResult.exitCode).toBe(2)
    expect(missingResult.stderr).toContain('Missing file')

    const invalidResult = await runCli(['{"files":42}'])
    expect(invalidResult.exitCode).toBe(2)
    expect(invalidResult.stderr.length).toBeGreaterThan(0)
  })

  test('prints stable JSON output shape and exits 1 when findings exist', async () => {
    const file = await writeFixture({
      name: 'json-shape.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('mod', (_ctx) => ({
  [EVENTS.start](detail: unknown) {
    const parsed = StartSchema.safeParse(detail)
    if (!parsed.success) {
      return
    }
  },
}))
`,
    })

    const result = await runCli([JSON.stringify({ files: [file] })])
    expect(result.exitCode).toBe(1)

    const parsed = JSON.parse(result.stdout)
    const output = ModulePatternCheckOutputSchema.parse(parsed)
    expect(output.ok).toBe(false)
    expect(output.findings.length).toBeGreaterThan(0)
  })

  test('supports --human output for operator readability', async () => {
    const file = await writeFixture({
      name: 'human-output-clean.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('mod', (_ctx) => ({
  [EVENTS.start](detail: unknown) {
    StartSchema.parse(detail)
  },
}))
`,
    })

    const result = await runCli([JSON.stringify({ files: [file] }), '--human'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('No module pattern findings.')
  })
})
