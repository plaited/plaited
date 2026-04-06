import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { AutoresearchEvaluateOutputSchema, AutoresearchLaneStateSchema } from './autoresearch.schemas.ts'
import type {
  AutoresearchAcceptConfig,
  AutoresearchEvaluateOutput,
  AutoresearchExperiment,
  AutoresearchLaneState,
  AutoresearchRevertConfig,
  AutoresearchStatusConfig,
  EvaluateAutoresearchLaneConfig,
  InitAutoresearchLaneConfig,
} from './autoresearch.types.ts'
import { buildAutoresearchRunId, createInitialLaneState, resolveAutoresearchLaneDir } from './autoresearch.utils.ts'
import { evaluateFactoryScenarios } from './evaluation/check-invariants.ts'
import { runFactoryScenarios } from './evaluation/run-factory-scenarios.ts'
import {
  captureWritableSnapshot,
  diffWritableSnapshot,
  readWritableSnapshotFile,
  revertWritableSnapshot,
  writeWritableSnapshotFile,
} from './state/apply-or-revert-candidate.ts'

const toJson = (value: unknown): string => JSON.stringify(value, null, 2)
const BASELINE_SNAPSHOT_FILE = 'baseline-snapshot.json'

const writeLaneState = async (laneState: AutoresearchLaneState): Promise<void> => {
  await Bun.write(join(laneState.laneDir, 'lane.json'), toJson(AutoresearchLaneStateSchema.parse(laneState)))
  await Bun.write(
    join(laneState.laneDir, 'experiments.jsonl'),
    laneState.experiments.map((row) => JSON.stringify(row)).join('\n'),
  )
}

const readLaneState = async (laneDir: string): Promise<AutoresearchLaneState> => {
  const path = join(laneDir, 'lane.json')
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new Error(`Missing autoresearch lane state: ${path}`)
  }

  return AutoresearchLaneStateSchema.parse(await file.json())
}

/**
 * Initializes a new autoresearch lane and captures the baseline writable-root
 * snapshot used for later evaluation diffs.
 *
 * @public
 */
export const initAutoresearchLane = async (config: InitAutoresearchLaneConfig): Promise<AutoresearchLaneState> => {
  const { outputDir, programPath, target } = config
  const runId = buildAutoresearchRunId(target)
  const laneDir = resolveAutoresearchLaneDir({
    outputDir,
    runId,
  })

  await mkdir(join(laneDir, 'experiments'), { recursive: true })

  const laneState = createInitialLaneState({
    laneDir,
    programPath,
    runId,
    target,
  })

  const baselineSnapshot = await captureWritableSnapshot({
    writableRoots: target.writableRoots ?? [],
    workspaceRoot: process.cwd(),
  })
  await writeWritableSnapshotFile(join(laneDir, BASELINE_SNAPSHOT_FILE), baselineSnapshot)
  await writeLaneState(laneState)
  return laneState
}

/**
 * Evaluates the current workspace state for an autoresearch lane by running the
 * built-in factory scenario suite and diffing the writable roots against the
 * lane's baseline snapshot.
 *
 * @public
 */
export const evaluateAutoresearchLane = async (
  config: EvaluateAutoresearchLaneConfig,
): Promise<AutoresearchEvaluateOutput> => {
  const laneState = await readLaneState(config.laneDir)
  const iteration = laneState.experiments.length + 1
  const artifactDir = join(laneState.laneDir, 'experiments', `iteration-${String(iteration).padStart(3, '0')}`)
  await mkdir(artifactDir, { recursive: true })

  const baselineSnapshot = await readWritableSnapshotFile(join(laneState.laneDir, BASELINE_SNAPSHOT_FILE))
  const changedPaths = await diffWritableSnapshot({
    snapshot: baselineSnapshot,
    writableRoots: laneState.target.writableRoots ?? [],
    workspaceRoot: process.cwd(),
  })

  const scenarios = await runFactoryScenarios({
    targetId: laneState.target.id,
  })
  const evaluation = evaluateFactoryScenarios({
    scenarios,
  })

  await Bun.write(join(artifactDir, 'evaluation.json'), toJson(evaluation))
  await Bun.write(join(artifactDir, 'changed-paths.json'), toJson(changedPaths))
  await Bun.write(join(artifactDir, 'trace.jsonl'), evaluation.snapshots.map((row) => JSON.stringify(row)).join('\n'))
  await Bun.write(join(artifactDir, 'invariants.json'), toJson(evaluation.invariants))
  await Bun.write(
    join(artifactDir, 'transport.json'),
    toJson(
      scenarios.map((scenario) => ({
        id: scenario.id,
        pass: scenario.pass,
        transport: scenario.transport,
      })),
    ),
  )
  await Bun.write(
    join(artifactDir, 'scenario.json'),
    toJson(
      scenarios.map((scenario) => ({
        id: scenario.id,
        summary: scenario.summary,
        invariantIds: scenario.invariants.map((invariant) => invariant.id),
      })),
    ),
  )

  const experiment: AutoresearchExperiment = {
    iteration,
    pass: evaluation.pass,
    summary: evaluation.summary,
    score: evaluation.score,
    changedPaths,
    artifactDir,
  }

  laneState.experiments.push(experiment)
  await writeLaneState(laneState)

  return AutoresearchEvaluateOutputSchema.parse({
    laneDir: laneState.laneDir,
    iteration,
    programPath: laneState.programPath,
    target: laneState.target,
    pass: evaluation.pass,
    summary: evaluation.summary,
    score: evaluation.score,
    changedPaths,
    artifactDir,
  })
}

/**
 * Loads the current state for an autoresearch lane.
 *
 * @public
 */
export const loadAutoresearchLaneStatus = async (config: AutoresearchStatusConfig): Promise<AutoresearchLaneState> =>
  readLaneState(config.laneDir)

/**
 * Promotes the current workspace state into the lane baseline snapshot so later
 * evaluations diff against the newly accepted state.
 *
 * @public
 */
export const acceptAutoresearchLane = async (config: AutoresearchAcceptConfig): Promise<AutoresearchLaneState> => {
  const laneState = await readLaneState(config.laneDir)
  const snapshot = await captureWritableSnapshot({
    writableRoots: laneState.target.writableRoots ?? [],
    workspaceRoot: process.cwd(),
  })
  await writeWritableSnapshotFile(join(laneState.laneDir, BASELINE_SNAPSHOT_FILE), snapshot)
  laneState.lastAcceptedIteration = laneState.experiments.at(-1)?.iteration
  await writeLaneState(laneState)
  return laneState
}

/**
 * Restores the lane baseline snapshot into the current workspace.
 *
 * @public
 */
export const revertAutoresearchLane = async (config: AutoresearchRevertConfig): Promise<AutoresearchLaneState> => {
  const laneState = await readLaneState(config.laneDir)
  const snapshot = await readWritableSnapshotFile(join(laneState.laneDir, BASELINE_SNAPSHOT_FILE))
  const changedPaths = await diffWritableSnapshot({
    snapshot,
    writableRoots: laneState.target.writableRoots ?? [],
    workspaceRoot: process.cwd(),
  })
  await revertWritableSnapshot({
    changedPaths,
    snapshot,
    workspaceRoot: process.cwd(),
  })
  return laneState
}
