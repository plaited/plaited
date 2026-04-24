import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  type BehavioralFrontierInput,
  BehavioralFrontierInputSchema,
  BehavioralFrontierOutputSchema,
} from '../behavioral-frontier.schemas.ts'
import { runBehavioralFrontier } from '../behavioral-frontier.ts'

const fixture = (name: string) => resolve(import.meta.dir, 'fixtures', name)

const temporaryDirs = new Set<string>()

const writeTempHistoryFile = async ({ content, ext }: { content: string; ext: 'json' | 'jsonl' }) => {
  const dir = join(tmpdir(), `behavioral-frontier-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  temporaryDirs.add(dir)
  await mkdir(dir, { recursive: true })
  await Bun.write(join(dir, `history.${ext}`), content)
  return join(dir, `history.${ext}`)
}

afterEach(async () => {
  for (const dir of temporaryDirs) {
    await rm(dir, { recursive: true, force: true })
  }
  temporaryDirs.clear()
})

describe('behavioral-frontier CLI contract', () => {
  test('replay mode returns stable frontier and pending summaries', async () => {
    const output = await runBehavioralFrontier({
      mode: 'replay',
      modulePath: fixture('replay-safe-threads.ts'),
      history: [{ type: 'A', source: 'request' }],
    })

    expect(output.mode).toBe('replay')
    if (output.mode !== 'replay') {
      throw new Error('Expected replay output')
    }

    expect(output.frontier.status).toBe('deadlock')
    expect(output.pendingSummary.map((entry) => entry.label)).toContain('deadlockAfterA')
    expect(output.frontier.enabled).toEqual([])
    expect(() => BehavioralFrontierOutputSchema.parse(output)).not.toThrow()
  })

  test('replay mode supports historyPath with JSON arrays', async () => {
    const historyPath = await writeTempHistoryFile({
      ext: 'json',
      content: JSON.stringify([{ type: 'A', source: 'request' }]),
    })

    const output = await runBehavioralFrontier({
      mode: 'replay',
      modulePath: fixture('replay-safe-threads.ts'),
      historyPath,
    })

    expect(output.mode).toBe('replay')
    if (output.mode !== 'replay') {
      throw new Error('Expected replay output')
    }

    expect(output.history).toHaveLength(1)
    expect(output.frontier.status).toBe('deadlock')
  })

  test('replay mode supports historyPath with JSONL rows', async () => {
    const historyPath = await writeTempHistoryFile({
      ext: 'jsonl',
      content: `${JSON.stringify({ type: 'A', source: 'request' })}\n`,
    })

    const output = await runBehavioralFrontier({
      mode: 'replay',
      modulePath: fixture('replay-safe-threads.ts'),
      historyPath,
    })

    expect(output.mode).toBe('replay')
    if (output.mode !== 'replay') {
      throw new Error('Expected replay output')
    }

    expect(output.history).toEqual([{ type: 'A', source: 'request' }])
    expect(output.frontier.status).toBe('deadlock')
  })

  test('explore mode returns visited histories and findings', async () => {
    const output = await runBehavioralFrontier({
      mode: 'explore',
      modulePath: fixture('replay-safe-threads.ts'),
      strategy: 'bfs',
      includeFrontierSummaries: true,
    })

    expect(output.mode).toBe('explore')
    if (output.mode !== 'explore') {
      throw new Error('Expected explore output')
    }

    expect(output.report.strategy).toBe('bfs')
    expect(output.report.findingCount).toBeGreaterThan(0)
    expect(output.findings.some((finding) => finding.code === 'deadlock')).toBe(true)
    expect(output.frontierSummaries?.length).toBe(output.visitedHistories.length)
  })

  test('verify mode returns verification status and findings', async () => {
    const output = await runBehavioralFrontier({
      mode: 'verify',
      modulePath: fixture('replay-safe-threads.ts'),
      strategy: 'dfs',
    })

    expect(output.mode).toBe('verify')
    if (output.mode !== 'verify') {
      throw new Error('Expected verify output')
    }

    expect(output.status).toBe('failed')
    expect(output.report.findingCount).toBeGreaterThan(0)
  })

  test('verify mode includes frontier summaries when requested', async () => {
    const output = await runBehavioralFrontier({
      mode: 'verify',
      modulePath: fixture('replay-safe-threads.ts'),
      strategy: 'bfs',
      includeFrontierSummaries: true,
    })

    expect(output.mode).toBe('verify')
    if (output.mode !== 'verify') {
      throw new Error('Expected verify output')
    }

    expect(output.frontierSummaries).toBeDefined()
    expect(output.frontierSummaries?.length).toBeGreaterThan(0)
  })

  test('named export threads module is supported via exportName', async () => {
    const output = await runBehavioralFrontier({
      mode: 'replay',
      modulePath: fixture('named-threads.ts'),
      exportName: 'createThreads',
      history: [],
    })

    expect(output.mode).toBe('replay')
    if (output.mode !== 'replay') {
      throw new Error('Expected replay output')
    }

    expect(output.frontier.status).toBe('ready')
    expect(output.frontier.enabled.map((candidate) => candidate.type)).toEqual(['ping'])
  })

  test('invalid input rejects replay requests that provide both history and historyPath', () => {
    const parsed = BehavioralFrontierInputSchema.safeParse({
      mode: 'replay',
      modulePath: './fixtures/replay-safe-threads.ts',
      history: [{ type: 'A', source: 'request' }],
      historyPath: './fixtures/history.json',
    })

    expect(parsed.success).toBe(false)
  })

  test('invalid input rejects replay requests when history is an empty array and historyPath is also provided', () => {
    const parsed = BehavioralFrontierInputSchema.safeParse({
      mode: 'replay',
      modulePath: './fixtures/replay-safe-threads.ts',
      history: [],
      historyPath: './fixtures/history.json',
    })

    expect(parsed.success).toBe(false)
  })

  test('invalid module/error paths surface helpful failures', async () => {
    await expect(
      runBehavioralFrontier({
        mode: 'replay',
        modulePath: fixture('missing-module.ts'),
        history: [],
      }),
    ).rejects.toThrow(/Unable to load thread module/)

    await expect(
      runBehavioralFrontier({
        mode: 'replay',
        modulePath: fixture('invalid-threads-export.ts'),
        history: [],
      }),
    ).rejects.toThrow(/Expected an object mapping labels to thread factories/)

    const invalidHistoryPath = await writeTempHistoryFile({
      ext: 'jsonl',
      content: 'not-json\n',
    })

    const invalidHistoryInput: BehavioralFrontierInput = {
      mode: 'replay',
      modulePath: fixture('replay-safe-threads.ts'),
      historyPath: invalidHistoryPath,
    }

    await expect(runBehavioralFrontier(invalidHistoryInput)).rejects.toThrow(/Invalid JSON on historyPath line 1/)
  })
})
