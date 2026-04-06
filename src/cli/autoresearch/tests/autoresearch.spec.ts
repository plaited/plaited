import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import {
  AutoresearchOrchestratorInputSchema,
  AutoresearchOrchestratorOutputSchema,
} from '../../autoresearch-orchestrator/autoresearch-orchestrator.schemas.ts'
import { buildAutoresearchOrchestratorRunId } from '../../autoresearch-orchestrator/autoresearch-orchestrator.ts'
import {
  AutoresearchAcceptInputSchema,
  AutoresearchEvaluateInputSchema,
  AutoresearchEvaluateOutputSchema,
  AutoresearchInitInputSchema,
  AutoresearchLaneStateSchema,
  AutoresearchRevertInputSchema,
  AutoresearchStatusInputSchema,
} from '../autoresearch.schemas.ts'
import {
  acceptAutoresearchLane,
  evaluateAutoresearchLane,
  initAutoresearchLane,
  loadAutoresearchLaneStatus,
  revertAutoresearchLane,
} from '../autoresearch.ts'
import { buildAutoresearchRunId, createInitialLaneState } from '../autoresearch.utils.ts'

describe('autoresearch schemas', () => {
  test('accepts a minimal autoresearch init input', () => {
    const parsed = AutoresearchInitInputSchema.parse({
      programPath: 'dev-research/server-factory/program.md',
      target: { kind: 'factory', id: 'server-factory' },
    })

    expect(parsed.target.kind).toBe('factory')
  })

  test('accepts evaluate and status inputs', () => {
    const evaluate = AutoresearchEvaluateInputSchema.parse({
      laneDir: '/tmp/lane',
    })
    const status = AutoresearchStatusInputSchema.parse({
      laneDir: '/tmp/lane',
    })
    const accept = AutoresearchAcceptInputSchema.parse({
      laneDir: '/tmp/lane',
    })
    const revert = AutoresearchRevertInputSchema.parse({
      laneDir: '/tmp/lane',
    })

    expect(evaluate.laneDir).toBe('/tmp/lane')
    expect(status.laneDir).toBe('/tmp/lane')
    expect(accept.laneDir).toBe('/tmp/lane')
    expect(revert.laneDir).toBe('/tmp/lane')
  })

  test('accepts lane and evaluate outputs', () => {
    const lane = AutoresearchLaneStateSchema.parse({
      runId: 'factory-server-factory-run',
      laneDir: '/tmp/lane',
      programPath: 'dev-research/server-factory/program.md',
      target: { kind: 'factory', id: 'server-factory' },
      initializedAt: new Date().toISOString(),
      lastAcceptedIteration: 1,
      experiments: [],
    })
    const evaluate = AutoresearchEvaluateOutputSchema.parse({
      laneDir: '/tmp/lane',
      iteration: 1,
      programPath: 'dev-research/server-factory/program.md',
      target: { kind: 'factory', id: 'server-factory' },
      pass: true,
      summary: 'ok',
      changedPaths: [],
      artifactDir: '/tmp/lane/experiments/iteration-001',
    })

    expect(lane.experiments).toEqual([])
    expect(evaluate.pass).toBe(true)
  })

  test('accepts orchestrator input and output', () => {
    const input = AutoresearchOrchestratorInputSchema.parse({
      lanes: [
        {
          programPath: 'dev-research/server-factory/program.md',
          target: { kind: 'factory', id: 'server-factory' },
        },
      ],
      adapterCommand: ['bun', 'scripts/agent-adapter.ts', '{{lane_dir}}'],
    })
    const output = AutoresearchOrchestratorOutputSchema.parse({
      runId: 'autoresearch-orchestrator-run',
      baseRef: 'HEAD',
      parallel: 1,
      lanes: [
        {
          laneId: 'server-factory',
          status: 'succeeded',
          worktreePath: '/tmp/worktree',
          laneDir: '/tmp/lane',
          exitCode: 0,
          adapterExitCode: 0,
        },
      ],
    })

    expect(input.parallel).toBe(1)
    expect(input.adapterCommand).toEqual(['bun', 'scripts/agent-adapter.ts', '{{lane_dir}}'])
    expect(output.lanes[0]?.status).toBe('succeeded')
  })
})

describe('autoresearch utils', () => {
  test('builds a target-prefixed run id', () => {
    const runId = buildAutoresearchRunId({ kind: 'factory', id: 'server-factory' })

    expect(runId.startsWith('factory-server-factory-')).toBe(true)
  })

  test('builds initial lane state', () => {
    const state = createInitialLaneState({
      laneDir: '/tmp/lane',
      programPath: 'dev-research/server-factory/program.md',
      runId: 'factory-server-factory-run',
      target: { kind: 'factory', id: 'server-factory' },
    })

    expect(AutoresearchLaneStateSchema.parse(state).experiments).toEqual([])
  })

  test('builds an orchestrator run id', () => {
    expect(buildAutoresearchOrchestratorRunId().startsWith('autoresearch-orchestrator-')).toBe(true)
  })
})

describe('autoresearch lane flow', () => {
  let tempDir: string | undefined
  let tempRoot: string | undefined

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true })
      tempRoot = undefined
    }
  })

  test('initializes, evaluates, and loads lane status', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'plaited-autoresearch-lane-'))
    tempRoot = mkdtempSync(join(process.cwd(), '.tmp-autoresearch-'))
    const mutableRoot = relative(process.cwd(), tempRoot).replaceAll('\\', '/')
    const mutableFile = join(tempRoot, 'candidate.txt')

    const lane = await initAutoresearchLane({
      programPath: 'dev-research/server-factory/program.md',
      target: { kind: 'factory', id: 'server-factory', writableRoots: [mutableRoot] },
      outputDir: tempDir,
    })

    expect(await Bun.file(join(tempDir, 'lane.json')).exists()).toBe(true)
    expect(await Bun.file(join(tempDir, 'baseline-snapshot.json')).exists()).toBe(true)

    await Bun.write(mutableFile, 'candidate')

    const evaluation = await evaluateAutoresearchLane({
      laneDir: lane.laneDir,
    })

    expect(evaluation.iteration).toBe(1)
    expect(evaluation.changedPaths).toEqual([`${mutableRoot}/candidate.txt`])
    expect(await Bun.file(join(evaluation.artifactDir, 'trace.jsonl')).exists()).toBe(true)
    expect(await Bun.file(join(evaluation.artifactDir, 'invariants.json')).exists()).toBe(true)

    const status = await loadAutoresearchLaneStatus({
      laneDir: lane.laneDir,
    })

    expect(status.experiments).toHaveLength(1)
    expect(status.experiments[0]?.changedPaths).toEqual([`${mutableRoot}/candidate.txt`])
  })

  test('accept updates the baseline and revert restores it', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'plaited-autoresearch-lane-'))
    tempRoot = mkdtempSync(join(process.cwd(), '.tmp-autoresearch-'))
    const mutableRoot = relative(process.cwd(), tempRoot).replaceAll('\\', '/')
    const mutableFile = join(tempRoot, 'candidate.txt')

    const lane = await initAutoresearchLane({
      programPath: 'dev-research/server-factory/program.md',
      target: { kind: 'factory', id: 'server-factory', writableRoots: [mutableRoot] },
      outputDir: tempDir,
    })

    await Bun.write(mutableFile, 'accepted')
    await evaluateAutoresearchLane({
      laneDir: lane.laneDir,
    })
    const acceptedState = await acceptAutoresearchLane({
      laneDir: lane.laneDir,
    })

    expect(acceptedState.lastAcceptedIteration).toBe(1)

    await Bun.write(mutableFile, 'unaccepted')
    await revertAutoresearchLane({
      laneDir: lane.laneDir,
    })

    expect(await Bun.file(mutableFile).text()).toBe('accepted')
  })
})
