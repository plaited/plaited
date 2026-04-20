import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { initDb } from '../init-db.ts'
import { ModuleFlowRenderOutputSchema, renderModuleFlow } from '../module-flow.ts'
import { closeContextDatabase, openContextDatabase } from '../plaited-context.ts'

const SCRIPT_PATH = new URL('../module-flow.ts', import.meta.url).pathname

const tempDirs: string[] = []

const writeFixture = async ({ name, source }: { name: string; source: string }) => {
  const dir = await mkdtemp(join(tmpdir(), 'plaited-context-module-flow-'))
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

describe('module-flow', () => {
  test('extracts useful JSON graph facts', async () => {
    const file = await writeFixture({
      name: 'clean-json-facts.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = {
  start: 'start',
  started: 'started',
} as const
const createActorEvent = (eventName: string) => ({ eventName })

useExtension('credential-secret-runtime-actor', ({ trigger }: { trigger: (value: unknown) => void }) => ({
  [EVENTS.start](detail: unknown) {
    try {
      StartSchema.parse(detail)
    } catch {
      reportSnapshot({ kind: 'extension_error' })
      reportTransportError({ code: 'bad_payload' })
    }

    trigger(createActorEvent(EVENTS.started))
  },
}))
`,
    })

    const output = await renderModuleFlow({
      files: [file],
      format: 'json',
    })

    expect(output.ok).toBe(true)
    expect(output.mermaid).toBe('')
    expect(output.files.length).toBe(1)

    const extension = output.graph.files[0]?.extensions[0]
    const handler = extension?.handlers[0]

    expect(extension?.idExpression).toBe("'credential-secret-runtime-actor'")
    expect(handler?.parseCalls.some((call) => call.method === 'parse' && call.schema === 'StartSchema')).toBe(true)
    expect(handler?.triggerEventCalls.some((call) => call.eventName === 'started')).toBe(true)
    expect(handler?.reportSnapshotCalls.some((call) => call.callee.includes('reportSnapshot'))).toBe(true)
    expect(handler?.transportDiagnosticCalls.some((call) => call.callee.includes('reportTransportError'))).toBe(true)
  })

  test('extracts Mermaid output and helper call edges', async () => {
    const file = await writeFixture({
      name: 'helper-flow.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start', client_error: 'client_error' } as const
const createActorEvent = (eventName: string, detail: unknown) => ({ eventName, detail })

useExtension('mod', ({ trigger }: { trigger: (detail: unknown) => void }) => {
  const emitClientError = (detail: unknown) => trigger(createActorEvent(EVENTS.client_error, detail))

  return {
    [EVENTS.start](detail: unknown) {
      StartSchema.parse(detail)
      emitClientError(detail)
    },
  }
})
`,
    })

    const output = await renderModuleFlow({
      files: [file],
      format: 'mermaid',
    })

    expect(output.ok).toBe(true)
    expect(output.mermaid).toContain('flowchart TD')
    expect(output.mermaid).toContain('helper emitClientError')
    expect(output.mermaid).toContain('calls emitClientError')
    expect(output.mermaid).toContain('client_error')
  })

  test('classifies only explicit transport/client diagnostic helper calls', async () => {
    const file = await writeFixture({
      name: 'diagnostic-call-classification.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start', client_error: 'client_error' } as const
const createActorEvent = (eventName: string, detail: unknown) => ({ eventName, detail })

useExtension('mod', ({ trigger }: { trigger: (detail: unknown) => void }) => {
  const emitClientError = (detail: unknown) => trigger(createActorEvent(EVENTS.client_error, detail))
  const parseClientError = (detail: unknown) => ClientErrorDetailSchema.parse(detail)
  const reportTransportError = (detail: unknown) => emitClientError(detail)

  return {
    [EVENTS.start](detail: unknown) {
      parseClientError(detail)
      reportTransportError(detail)
    },
  }
})
`,
    })

    const output = await renderModuleFlow({
      files: [file],
      format: 'json',
    })

    const extension = output.files[0]?.extensions[0]
    const emitHelper = extension?.helpers.find((helper) => helper.name === 'emitClientError')
    const parseHelper = extension?.helpers.find((helper) => helper.name === 'parseClientError')
    const reportTransportHelper = extension?.helpers.find((helper) => helper.name === 'reportTransportError')

    expect(emitHelper).toBeDefined()
    expect(emitHelper?.transportDiagnosticCalls).toEqual([])
    expect(emitHelper?.triggerEventCalls.some((call) => call.eventName === 'client_error')).toBe(true)

    expect(parseHelper).toBeDefined()
    expect(parseHelper?.parseCalls.some((call) => call.schema === 'ClientErrorDetailSchema')).toBe(true)
    expect(parseHelper?.transportDiagnosticCalls).toEqual([])

    expect(reportTransportHelper).toBeDefined()
    expect(
      reportTransportHelper?.transportDiagnosticCalls.some((call) => call.callee.includes('emitClientError')),
    ).toBe(true)
  })

  test('records candidate review evidence when record is true', async () => {
    const file = await writeFixture({
      name: 'record-flow.ts',
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

    const dbPath = join(dirname(file), '.plaited/context.sqlite')
    await initDb({
      cwd: dirname(file),
      dbPath,
    })

    const output = await renderModuleFlow({
      cwd: dirname(file),
      dbPath,
      files: [file],
      format: 'json',
      record: true,
    })

    expect(output.ok).toBe(true)

    const db = await openContextDatabase({ dbPath })
    try {
      const rows = db
        .query(
          `SELECT kind, status, summary
           FROM findings
           WHERE summary LIKE 'module-flow evidence for %'`,
        )
        .all() as Array<{ kind: string; status: string; summary: string }>

      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0]?.kind).toBe('pattern')
      expect(rows[0]?.status).toBe('candidate')
    } finally {
      closeContextDatabase(db)
    }
  })

  test('record:true is idempotent for the same file and format', async () => {
    const file = await writeFixture({
      name: 'record-flow-idempotent.ts',
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

    const dbPath = join(dirname(file), '.plaited/context.sqlite')
    await initDb({
      cwd: dirname(file),
      dbPath,
    })

    await renderModuleFlow({
      cwd: dirname(file),
      dbPath,
      files: [file],
      format: 'json',
      record: true,
    })
    await renderModuleFlow({
      cwd: dirname(file),
      dbPath,
      files: [file],
      format: 'json',
      record: true,
    })

    const db = await openContextDatabase({ dbPath })
    try {
      const candidateRows = db
        .query(
          `SELECT id, details
           FROM findings
           WHERE kind = 'pattern' AND status = 'candidate'`,
        )
        .all() as Array<{ id: number; details: string | null }>

      const matchingRows = candidateRows.filter((row) => {
        if (!row.details) {
          return false
        }

        const details = JSON.parse(row.details) as {
          source?: string
          file?: string
          format?: string
        }
        return details.source === 'module-flow' && details.file === file && details.format === 'json'
      })

      expect(matchingRows).toHaveLength(1)
      const matchingFindingId = matchingRows[0]?.id
      expect(matchingFindingId).toBeDefined()

      const evidenceRows = db
        .query(
          `SELECT id
           FROM finding_evidence
           WHERE finding_id = ?`,
        )
        .all(matchingFindingId as number) as Array<{ id: number }>

      expect(evidenceRows).toHaveLength(1)
    } finally {
      closeContextDatabase(db)
    }
  })

  test('cli exits 2 for missing file and invalid input', async () => {
    const missingPath = join(tmpdir(), 'does-not-exist-module-flow.ts')

    const missingResult = await runCli([JSON.stringify({ files: [missingPath], format: 'json' })])
    expect(missingResult.exitCode).toBe(2)
    expect(missingResult.stderr).toContain('Missing file')

    const invalidResult = await runCli(['{"files":42,"format":"json"}'])
    expect(invalidResult.exitCode).toBe(2)
    expect(invalidResult.stderr.length).toBeGreaterThan(0)
  })

  test('cli emits JSON contract for json and mermaid formats', async () => {
    const file = await writeFixture({
      name: 'cli-output-shape.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('shape-actor', (_ctx) => ({
  [EVENTS.start](detail: unknown) {
    StartSchema.parse(detail)
  },
}))
`,
    })

    const jsonResult = await runCli([JSON.stringify({ files: [file], format: 'json' })])
    expect(jsonResult.exitCode).toBe(0)
    const jsonOutput = ModuleFlowRenderOutputSchema.parse(JSON.parse(jsonResult.stdout))
    expect(jsonOutput.ok).toBe(true)
    expect(jsonOutput.mermaid).toBe('')

    const mermaidResult = await runCli([JSON.stringify({ files: [file], format: 'mermaid' })])
    expect(mermaidResult.exitCode).toBe(0)
    const mermaidOutput = ModuleFlowRenderOutputSchema.parse(JSON.parse(mermaidResult.stdout))
    expect(mermaidOutput.ok).toBe(true)
    expect(mermaidOutput.mermaid).toContain('flowchart TD')
  })
})
