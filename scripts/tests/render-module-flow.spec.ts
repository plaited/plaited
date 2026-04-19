import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ModuleFlowRenderOutputSchema, renderModuleFlow } from '../render-module-flow.ts'

const SCRIPT_PATH = new URL('../render-module-flow.ts', import.meta.url).pathname

const tempDirs: string[] = []

const writeFixture = async ({ name, source }: { name: string; source: string }) => {
  const dir = await mkdtemp(join(tmpdir(), 'render-module-flow-'))
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

describe('render-module-flow', () => {
  test('clean module emits useful JSON graph facts', async () => {
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

    expect(output.format).toBe('json')
    expect(output.ok).toBe(true)

    const fileGraph = output.graph.files[0]
    expect(fileGraph?.extensions.length).toBe(1)

    const extension = fileGraph?.extensions[0]
    expect(extension?.idExpression).toBe("'credential-secret-runtime-actor'")
    expect(extension?.handlers.length).toBe(1)

    const handler = extension?.handlers[0]
    expect(handler?.name).toBe('[EVENTS.start]')
    expect(handler?.parseCalls.some((call) => call.method === 'parse' && call.schema === 'StartSchema')).toBe(true)
    expect(handler?.tryCatchBoundaries.length).toBe(1)
    expect(handler?.triggerEventCalls.some((call) => call.eventName === 'started')).toBe(true)
    expect(handler?.reportSnapshotCalls.some((call) => call.callee.includes('reportSnapshot'))).toBe(true)
    expect(handler?.transportDiagnosticCalls.some((call) => call.callee.includes('reportTransportError'))).toBe(true)
  })

  test('clean module emits Mermaid containing handler names and diagnostic surfaces', async () => {
    const file = await writeFixture({
      name: 'clean-mermaid.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = {
  start: 'start',
  started: 'started',
} as const
const createActorEvent = (eventName: string) => ({ eventName })

useExtension('credential-secret-runtime-actor', ({ trigger }: { trigger: (value: unknown) => void }) => ({
  [EVENTS.start](detail: unknown) {
    StartSchema.parse(detail)
    reportSnapshot({ kind: 'extension_error' })
    reportTransportError({ code: 'bad_payload' })
    trigger(createActorEvent(EVENTS.started))
  },
}))
`,
    })

    const output = await renderModuleFlow({
      files: [file],
      format: 'mermaid',
    })

    expect(output.format).toBe('mermaid')
    if (output.format !== 'mermaid') {
      throw new Error('Expected mermaid output format')
    }
    expect(output.mermaid).toContain('flowchart TD')
    expect(output.mermaid).toContain('handler [EVENTS.start]')
    expect(output.mermaid).toContain('reportSnapshot')
    expect(output.mermaid).toContain('reportTransportError')
  })

  test('return ({ ... }) handler extraction works', async () => {
    const file = await writeFixture({
      name: 'return-parenthesized-handler.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = {
  start: 'start',
} as const

useExtension('credential-secret-runtime-actor', (_ctx) => {
  return ({
    [EVENTS.start](detail: unknown) {
      StartSchema.safeParse(detail)
    },
  })
})
`,
    })

    const output = await renderModuleFlow({
      files: [file],
      format: 'json',
    })

    const fileGraph = output.graph.files[0]
    const extension = fileGraph?.extensions[0]
    const handler = extension?.handlers[0]

    expect(handler?.name).toBe('[EVENTS.start]')
    expect(handler?.parseCalls.some((call) => call.method === 'safeParse' && call.schema === 'StartSchema')).toBe(true)
  })

  test('graph includes source locations for trigger/reportSnapshot/reportTransportError facts', async () => {
    const file = await writeFixture({
      name: 'locations.ts',
      source: `const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start', started: 'started' } as const
const createActorEvent = (eventName: string) => ({ eventName })

useExtension('loc-actor', ({ trigger }: { trigger: (value: unknown) => void }) => ({
  [EVENTS.start](detail: unknown) {
    reportSnapshot({ kind: 'extension_error' })
    reportTransportError({ code: 'bad_payload' })
    trigger(createActorEvent(EVENTS.started))
    StartSchema.parse(detail)
  },
}))
`,
    })

    const output = await renderModuleFlow({
      files: [file],
      format: 'json',
    })

    const handler = output.graph.files[0]?.extensions[0]?.handlers[0]
    const triggerLocation = handler?.triggerEventCalls[0]?.location
    const snapshotLocation = handler?.reportSnapshotCalls[0]?.location
    const transportLocation = handler?.transportDiagnosticCalls[0]?.location

    expect(triggerLocation).toBeDefined()
    expect(snapshotLocation).toBeDefined()
    expect(transportLocation).toBeDefined()

    expect(triggerLocation?.line).toBeGreaterThan(0)
    expect(triggerLocation?.column).toBeGreaterThan(0)
    expect(snapshotLocation?.line).toBeGreaterThan(0)
    expect(snapshotLocation?.column).toBeGreaterThan(0)
    expect(transportLocation?.line).toBeGreaterThan(0)
    expect(transportLocation?.column).toBeGreaterThan(0)
  })

  test('captures helper-mediated actor diagnostics and handler-to-helper edges', async () => {
    const file = await writeFixture({
      name: 'helper-mediated-diagnostic.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('mod', ({ reportSnapshot }: { reportSnapshot: (detail: unknown) => void }) => {
  const reportActorDiagnostic = (message: string) => {
    reportSnapshot({ kind: 'extension_error', error: message })
  }

  return {
    [EVENTS.start](detail: unknown) {
      StartSchema.parse(detail)
      reportActorDiagnostic('bad')
    },
  }
})
`,
    })

    const jsonOutput = await renderModuleFlow({
      files: [file],
      format: 'json',
    })

    const extension = jsonOutput.graph.files[0]?.extensions[0]
    const handler = extension?.handlers[0]
    const helper = extension?.helpers.find((candidate) => candidate.name === 'reportActorDiagnostic')

    expect(handler?.reportSnapshotCalls).toEqual([])
    expect(handler?.helperCalls.some((call) => call.helperName === 'reportActorDiagnostic')).toBe(true)
    expect(helper?.reportSnapshotCalls.some((call) => call.callee.includes('reportSnapshot'))).toBe(true)

    const mermaidOutput = await renderModuleFlow({
      files: [file],
      format: 'mermaid',
    })
    if (mermaidOutput.format !== 'mermaid') {
      throw new Error('Expected mermaid output format')
    }

    expect(mermaidOutput.mermaid).toContain('helper reportActorDiagnostic')
    expect(mermaidOutput.mermaid).toContain('calls reportActorDiagnostic')
    expect(mermaidOutput.mermaid).toContain('reportSnapshot')
  })

  test('cli exits 2 for missing file and invalid input using shared parser behavior', async () => {
    const missingPath = join(tmpdir(), 'does-not-exist-render-module-flow.ts')

    const missingResult = await runCli([JSON.stringify({ files: [missingPath], format: 'json' })])
    expect(missingResult.exitCode).toBe(2)
    expect(missingResult.stderr).toContain('Missing file')

    const invalidInputResult = await runCli(['{"files":42,"format":"json"}'])
    expect(invalidInputResult.exitCode).toBe(2)
    expect(invalidInputResult.stderr.length).toBeGreaterThan(0)
  })

  test('cli emits JSON contract for both json and mermaid formats', async () => {
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
    expect(jsonOutput.format).toBe('json')

    const mermaidResult = await runCli([JSON.stringify({ files: [file], format: 'mermaid' })])
    expect(mermaidResult.exitCode).toBe(0)
    const mermaidOutput = ModuleFlowRenderOutputSchema.parse(JSON.parse(mermaidResult.stdout))
    expect(mermaidOutput.format).toBe('mermaid')
    if (mermaidOutput.format === 'mermaid') {
      expect(mermaidOutput.mermaid).toContain('flowchart TD')
    }
  })
})
