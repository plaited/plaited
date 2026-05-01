import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as z from 'zod'

import type { JsonObject, SnapshotMessage, Spec } from '../../behavioral.ts'
import { BehavioralFrontierInputSchema, BehavioralFrontierOutputSchema } from '../behavioral-frontier.schemas.ts'
import { runBehavioralFrontier } from '../behavioral-frontier.ts'

const temporaryDirs = new Set<string>()

const writeTempSpecFile = async ({ content }: { content: string }) => {
  const dir = join(tmpdir(), `behavioral-frontier-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  temporaryDirs.add(dir)
  await mkdir(dir, { recursive: true })
  const specPath = join(dir, 'specs.jsonl')
  await Bun.write(specPath, content)
  return specPath
}

const selectionSnapshot = ({
  step = 0,
  type,
  detail,
  ingress,
}: {
  step?: number
  type: string
  detail?: JsonObject
  ingress?: true
}): SnapshotMessage => ({
  kind: 'selection',
  step,
  selected: {
    type,
    ...(detail === undefined ? {} : { detail }),
    ...(ingress === undefined ? {} : { ingress }),
  },
})

const replaySpecs: Spec[] = [
  {
    label: 'producer',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'task' } }],
    },
  },
  {
    label: 'consumer',
    thread: {
      once: true,
      syncPoints: [{ waitFor: [{ type: 'task' }] }, { request: { type: 'ack' } }],
    },
  },
]

const verifySpecs: Spec[] = [
  {
    label: 'chooseA',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'A' } }],
    },
  },
  {
    label: 'chooseB',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'B' } }],
    },
  },
  {
    label: 'deadlockAfterA',
    thread: {
      once: true,
      syncPoints: [{ waitFor: [{ type: 'A' }] }, { block: [{ type: 'B' }] }],
    },
  },
]

afterEach(async () => {
  for (const dir of temporaryDirs) {
    await rm(dir, { recursive: true, force: true })
  }
  temporaryDirs.clear()
})

describe('runBehavioralFrontier', () => {
  test('replay returns the direct simple shape', async () => {
    const output = await runBehavioralFrontier({
      mode: 'replay',
      specs: replaySpecs,
      snapshotMessages: [selectionSnapshot({ type: 'task' })],
    })

    expect(output).toEqual({
      mode: 'replay',
      snapshotMessages: [selectionSnapshot({ type: 'task' })],
      frontier: {
        kind: 'frontier',
        step: 1,
        status: 'ready',
        candidates: [{ priority: 2, type: 'ack' }],
        enabled: [{ priority: 2, type: 'ack' }],
      },
    })
    expect(() => BehavioralFrontierOutputSchema.parse(output)).not.toThrow()
  })

  test('explore returns the direct simple shape', async () => {
    const output = await runBehavioralFrontier({
      mode: 'explore',
      specs: verifySpecs,
      maxDepth: 0,
    })

    expect(output.mode).toBe('explore')
    if (output.mode !== 'explore') {
      throw new Error('Expected explore output')
    }
    expect(output.traces[0]?.snapshotMessages.at(-1)).toEqual(expect.objectContaining({ kind: 'frontier', step: 0 }))
    expect(output.report.selectionPolicy).toBe('all-enabled')
  })

  test('verify returns the direct simple shape', async () => {
    const output = await runBehavioralFrontier({
      mode: 'verify',
      specs: verifySpecs,
    })

    expect(output.mode).toBe('verify')
    if (output.mode !== 'verify') {
      throw new Error('Expected verify output')
    }
    expect(output.status).toBe('failed')
    expect(output.findings[0]?.code).toBe('deadlock')
  })

  test('invalid direct input throws', async () => {
    await expect(runBehavioralFrontier({ mode: 'replay' })).rejects.toThrow()
  })

  test('emitted input schema structurally shows inline-spec and specPath branches', () => {
    const schema = z.toJSONSchema(BehavioralFrontierInputSchema)
    const branches = (schema.anyOf ?? schema.oneOf ?? []) as Array<{
      properties?: Record<string, unknown>
      required?: string[]
    }>

    const hasInlineBranch = branches.some(
      (branch) => branch.required?.includes('specs') && branch.properties?.specPath === undefined,
    )
    const hasSpecPathBranch = branches.some(
      (branch) => branch.required?.includes('specPath') && branch.properties?.specs === undefined,
    )

    expect(hasInlineBranch).toBe(true)
    expect(hasSpecPathBranch).toBe(true)
  })

  test('supports specPath JSONL loading', async () => {
    const specPath = await writeTempSpecFile({
      content: `${JSON.stringify(replaySpecs[0])}\n`,
    })

    const output = await runBehavioralFrontier({
      mode: 'replay',
      specPath,
    })

    expect(output.mode).toBe('replay')
    if (output.mode !== 'replay') {
      throw new Error('Expected replay output')
    }
    expect(output.frontier.enabled).toEqual([{ priority: 1, type: 'task' }])
  })
})
