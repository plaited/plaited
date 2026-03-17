#!/usr/bin/env bun

/**
 * Targeted re-eval for module prompts that failed Phase B quality gate.
 *
 * @remarks
 * Runs the 4 failing prompts (diet-tracker, chart-generator, physics-simulator,
 * periodic-table) with the calibrated MODULE_SYSTEM_PROMPT and 600s timeout.
 * Logs results to .memory/evals/experiments.jsonl.
 *
 * Usage:
 *   bun scripts/calibrate-module-failures.ts
 */

import { join, resolve } from 'node:path'
import { adapt } from '../src/tools/adapters/claude-code.ts'
import { createModuleGrader } from '../src/tools/module-grader.ts'
import type { TrialResult } from '../src/tools/trial.schemas.ts'
import { runTrial } from '../src/tools/trial.ts'
import { loadPrompts } from '../src/tools/trial.utils.ts'
import { logExperiment } from './git-experiment.ts'

// ============================================================================
// Config
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const MODULE_PROMPTS_PATH = join(PROJECT_ROOT, 'skills/modnet-modules/assets/prompts.jsonl')
const MODULE_WORKSPACE = '/private/tmp/module-eval-calibrate'
const FAILING_IDS = new Set(['diet-tracker', 'chart-generator', 'physics-simulator', 'periodic-table'])

// ============================================================================
// Quality Gate
// ============================================================================

/** Module quality gate: score >= 0.7 AND static checks all pass (S=1.0) */
const passesModuleGate = (result: TrialResult): boolean => {
  const trial = result.trials[0]
  if (!trial) return false
  const score = trial.score ?? 0
  if (score < 0.7) return false
  const outcome = trial.outcome as { static?: { score?: number } } | undefined
  const staticScore = outcome?.static?.score ?? 0
  return staticScore >= 1.0
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  const allPrompts = await loadPrompts(MODULE_PROMPTS_PATH)
  const prompts = allPrompts.filter((p) => FAILING_IDS.has(p.id))
  console.log(`Re-evaluating ${prompts.length} failing prompts: ${prompts.map((p) => p.id).join(', ')}`)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = join(PROJECT_ROOT, `.memory/evals/calibrate-module-${timestamp}.jsonl`)

  const results = await runTrial({
    adapter: adapt,
    prompts,
    grader: createModuleGrader(),
    k: 1,
    outputPath,
    progress: true,
    timeout: 600_000,
    concurrency: 1,
    workspaceDir: MODULE_WORKSPACE,
  })

  console.log('\n=== CALIBRATION RESULTS ===')

  const passing: TrialResult[] = []
  const scores: Record<string, number> = {}

  for (const result of results) {
    const trial = result.trials[0]
    const score = trial?.score ?? 0
    const pass = passesModuleGate(result)
    const traj = trial?.trajectory?.length ?? 0
    const status = pass ? '✓' : '✗'
    const timedOut = trial?.timedOut ? ' [TIMEOUT]' : ''
    const outcome = trial?.outcome as { static?: { score?: number } } | undefined
    const staticScore = outcome?.static?.score ?? 0
    console.log(
      `  ${status} ${result.id}: composite=${score.toFixed(3)} static=${staticScore.toFixed(3)} (${traj} steps)${timedOut}`,
    )
    if (trial?.reasoning) {
      console.log(`      ${trial.reasoning.slice(0, 200)}`)
    }
    if (pass) passing.push(result)
    scores[result.id] = score
  }

  const sha = (await Bun.$`git rev-parse --short HEAD`.cwd(PROJECT_ROOT).quiet()).text().trim()
  const passCount = passing.length

  console.log(`\nResult: ${passCount}/${results.length} pass quality gate`)
  console.log(`Output: ${outputPath}`)

  await logExperiment({
    commit: sha,
    scores: {
      passing: passCount,
      total: results.length,
      qualityGateRate: results.length > 0 ? passCount / results.length : 0,
      ...scores,
    },
    status: passCount === results.length ? 'keep' : 'keep',
    description: `module calibration (list/steps fix + 600s timeout): ${passCount}/${results.length} pass gate (${prompts.map((p) => p.id).join(', ')})`,
    timestamp: new Date().toISOString(),
    prompts: prompts.map((p) => p.id),
  })

  console.log('\nExperiment logged to .memory/evals/experiments.jsonl')
}

main().catch(console.error)
