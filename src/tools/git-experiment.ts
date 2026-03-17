#!/usr/bin/env bun

/**
 * Git experiment helpers — commit/revert/log for autonomous research loops.
 *
 * @remarks
 * Provides the keep/discard pattern from autoresearch:
 * - `commitExperiment(description)` — stages and commits, returns short SHA
 * - `discardExperiment()` — reverts the last commit (hard reset)
 * - `logExperiment(entry)` — appends a JSONL line to the experiments log
 * - `loadExperiments()` — reads the cumulative experiments log
 *
 * @public
 */

import { appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { $ } from 'bun'

// ============================================================================
// Types
// ============================================================================

/**
 * A single experiment result in the cumulative log.
 *
 * @public
 */
export type ExperimentEntry = {
  /** Short git commit SHA (7 chars) */
  commit: string
  /** Numeric grader scores per dimension — kept strictly numeric for comparison */
  scores: Record<string, number>
  /** Whether the experiment was kept, discarded, or crashed */
  status: 'keep' | 'discard' | 'crash'
  /** Short description of what was tried */
  description: string
  /** ISO timestamp */
  timestamp: string
  /** Which prompts were evaluated */
  prompts?: string[]
  /** Qualitative annotations — failure mode, notes, non-numeric context */
  metadata?: Record<string, unknown>
}

// ============================================================================
// Constants
// ============================================================================

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const EXPERIMENTS_LOG = join(PROJECT_ROOT, '.memory', 'evals', 'experiments.jsonl')

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Stage all changes and commit with a description.
 *
 * @returns Short SHA of the new commit
 *
 * @public
 */
export const commitExperiment = async (description: string): Promise<string> => {
  await $`git add -A`.cwd(PROJECT_ROOT).quiet()
  await $`git commit -m ${{ raw: `experiment: ${description}` }}`.cwd(PROJECT_ROOT).quiet()
  const result = await $`git rev-parse --short HEAD`.cwd(PROJECT_ROOT).quiet()
  const sha = result.text().trim()
  await $`git push`.cwd(PROJECT_ROOT).nothrow().quiet()
  return sha
}

/**
 * Discard the last commit (hard reset to HEAD~1).
 *
 * @remarks
 * Only call this after a failed experiment — it destroys the last commit.
 *
 * @public
 */
export const discardExperiment = async (): Promise<void> => {
  await $`git reset --hard HEAD~1`.cwd(PROJECT_ROOT).quiet()
  await $`git push --force-with-lease`.cwd(PROJECT_ROOT).nothrow().quiet()
}

// ============================================================================
// Experiment Log
// ============================================================================

/**
 * Append an experiment entry to the JSONL log.
 *
 * @remarks
 * Creates the log file and parent directories if they don't exist.
 * Uses `appendFileSync` for atomic single-line appends.
 *
 * @public
 */
export const logExperiment = async (entry: ExperimentEntry): Promise<void> => {
  const dir = dirname(EXPERIMENTS_LOG)
  await $`mkdir -p ${dir}`.quiet()
  const line = `${JSON.stringify(entry)}\n`
  appendFileSync(EXPERIMENTS_LOG, line)
  // Commit and push the log entry so the research record is durably checkpointed
  // after every experiment — even if the session ends unexpectedly mid-loop.
  const msg = `chore: log experiment — ${entry.description.slice(0, 72)}`
  await $`git add ${EXPERIMENTS_LOG}`.cwd(PROJECT_ROOT).quiet()
  await $`git commit -m ${msg}`.cwd(PROJECT_ROOT).nothrow().quiet()
  await $`git push`.cwd(PROJECT_ROOT).nothrow().quiet()
}

/**
 * Load all experiment entries from the JSONL log.
 *
 * @returns Array of experiment entries, empty if log doesn't exist
 *
 * @public
 */
export const loadExperiments = async (): Promise<ExperimentEntry[]> => {
  const file = Bun.file(EXPERIMENTS_LOG)
  if (!(await file.exists())) return []
  const content = await file.text()
  if (!content.trim()) return []
  return Bun.JSONL.parse(content) as ExperimentEntry[]
}

/**
 * Get the current baseline — the most recent 'keep' experiment.
 *
 * @returns The latest kept experiment, or null if none exist
 *
 * @public
 */
export const getBaseline = async (): Promise<ExperimentEntry | null> => {
  const experiments = await loadExperiments()
  for (let i = experiments.length - 1; i >= 0; i--) {
    if (experiments[i]!.status === 'keep') return experiments[i]!
  }
  return null
}
