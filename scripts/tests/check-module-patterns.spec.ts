import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkModulePatterns, ModulePatternCheckOutputSchema } from '../check-module-patterns.ts'

const SCRIPT_PATH = new URL('../check-module-patterns.ts', import.meta.url).pathname

const tempDirs: string[] = []

const writeFixture = async ({ name, source }: { name: string; source: string }) => {
  const dir = await mkdtemp(join(tmpdir(), 'check-module-patterns-'))
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

describe('check-module-patterns', () => {
  test('flags zod recovery in websocket-style internal handler', async () => {
    const file = await writeFixture({
      name: 'bad-zod-recovery.ts',
      source: `
import * as z from 'zod'

const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('mod', (_ctx) => {
  return {
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
  }
})
`,
    })

    const output = await checkModulePatterns({ files: [file] })
    expect(output.ok).toBe(false)
    expect(output.findings.some((finding) => finding.ruleId === 'module/no-internal-zod-recovery')).toBe(true)
  })

  test('flags zod recovery in non-server internal handler', async () => {
    const file = await writeFixture({
      name: 'bad-credential-recovery.ts',
      source: `
import * as z from 'zod'

const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { grant: 'grant' } as const

useExtension('credential-secret-runtime-actor', (_ctx) => ({
  [EVENTS.grant](detail: unknown) {
    try {
      CredentialGrantSchema.parse(detail)
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

  test('flags safeParse usage in internal handlers', async () => {
    const file = await writeFixture({
      name: 'bad-safe-parse.ts',
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

    const output = await checkModulePatterns({ files: [file] })
    expect(output.ok).toBe(false)
    expect(output.findings.some((finding) => finding.ruleId === 'module/no-safeparse-in-internal-handler')).toBe(true)
  })

  test('flags transport diagnostics from internal handlers', async () => {
    const file = await writeFixture({
      name: 'bad-transport-internal.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

useExtension('mod', (_ctx) => ({
  [EVENTS.start](detail: unknown) {
    reportTransportError({
      code: 'invalid',
      detail,
    })
  },
}))
`,
    })

    const output = await checkModulePatterns({ files: [file] })
    expect(output.ok).toBe(false)
    expect(
      output.findings.some((finding) => finding.ruleId === 'module/no-transport-diagnostic-from-internal-handler'),
    ).toBe(true)
  })

  test('flags helper diagnostic events and missing reportSnapshot preference', async () => {
    const file = await writeFixture({
      name: 'bad-triggered-diagnostic.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = {
  start: 'start',
  credential_error: 'credential_error',
} as const

const createActorEvent = (eventName: string) => ({ eventName })

useExtension('credential-secret-runtime-actor', ({ trigger }: { trigger: (value: unknown) => void }) => {
  const emitCredentialError = (message: string) => {
    trigger(createActorEvent(EVENTS.credential_error, { message }))
  }

  return {
    [EVENTS.start](detail: unknown) {
      if (detail) {
        emitCredentialError('invalid detail')
      }
    },
  }
})
`,
    })

    const output = await checkModulePatterns({ files: [file] })
    expect(output.ok).toBe(false)
    expect(output.findings.some((finding) => finding.ruleId === 'module/no-triggered-diagnostic-event')).toBe(true)
    expect(
      output.findings.some((finding) => finding.ruleId === 'module/prefer-report-snapshot-for-actor-diagnostics'),
    ).toBe(true)
  })

  test('accepts clean internal parse without local recovery', async () => {
    const file = await writeFixture({
      name: 'clean-internal-handler.ts',
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

  test('does not flag external boundary parsing outside useExtension handlers', async () => {
    const file = await writeFixture({
      name: 'clean-external-boundary.ts',
      source: `
const useExtension = (_id: string, fn: (ctx: unknown) => unknown) => fn
const EVENTS = { start: 'start' } as const

const onWebsocketMessage = (message: string) => {
  try {
    const payload = JSON.parse(message)
    IncomingMessageSchema.parse(payload)
  } catch (_error) {
    reportTransportError({ code: 'invalid_websocket_message' })
  }
}

useExtension('mod', (_ctx) => ({
  [EVENTS.start](detail: unknown) {
    StartSchema.parse(detail)
  },
}))

onWebsocketMessage('{"hello":"world"}')
`,
    })

    const output = await checkModulePatterns({ files: [file] })
    expect(output.ok).toBe(true)
    expect(output.findings).toEqual([])
  })

  test('exits 2 for missing files and invalid input', async () => {
    const missingPath = join(tmpdir(), 'does-not-exist-check-module-patterns.ts')

    const missingResult = await runCli([JSON.stringify({ files: [missingPath] })])
    expect(missingResult.exitCode).toBe(2)
    expect(missingResult.stderr).toContain('Missing file')

    const invalidInputResult = await runCli(['{"files":42}'])
    expect(invalidInputResult.exitCode).toBe(2)
    expect(invalidInputResult.stderr.length).toBeGreaterThan(0)
  })

  test('prints stable JSON output shape with expected ok/findings contract', async () => {
    const file = await writeFixture({
      name: 'json-shape.ts',
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

    const result = await runCli([JSON.stringify({ files: [file] })])
    expect(result.exitCode).toBe(1)

    const parsed = JSON.parse(result.stdout)
    const output = ModulePatternCheckOutputSchema.parse(parsed)
    expect(output.ok).toBe(false)
    expect(output.findings.length).toBeGreaterThan(0)
    expect(output.findings[0]).toMatchObject({
      severity: expect.stringMatching(/P1|P2/),
      ruleId: expect.any(String),
      file,
      line: expect.any(Number),
      column: expect.any(Number),
      message: expect.any(String),
      why: expect.any(String),
      fix: expect.any(String),
    })
  })

  test('renders --human output', async () => {
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
