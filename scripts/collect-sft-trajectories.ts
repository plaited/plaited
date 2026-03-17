#!/usr/bin/env bun

/**
 * Phase B: SFT trajectory collection for all 30 prompts (25 module + 5 proactive).
 *
 * @remarks
 * Runs k=1 with trajectory capture enabled. Grades each trial. Applies a
 * quality gate to identify passing trajectories suitable for SFT distillation.
 * Logs aggregate results to .memory/evals/experiments.jsonl.
 *
 * Quality gates:
 * - Module prompts: score >= 0.7 AND static score = 1.0 (typeCheck + modnet)
 * - Proactive prompts: score >= 0.7 AND parse = PASS
 *
 * Usage:
 *   bun scripts/collect-sft-trajectories.ts
 *   bun scripts/collect-sft-trajectories.ts --module-only
 *   bun scripts/collect-sft-trajectories.ts --proactive-only
 */

import { join, resolve } from 'node:path'
import { adapt as moduleAdapt } from '../src/tools/adapters/claude-code.ts'
import { adapt as proactiveAdapt } from '../src/tools/adapters/proactive.ts'
import { createJudge } from '../src/tools/judge.ts'
import { createModuleGrader } from '../src/tools/module-grader.ts'
import { createProactiveGrader } from '../src/tools/proactive-grader.ts'
import type { TrialResult } from '../src/tools/trial.schemas.ts'
import { runTrial } from '../src/tools/trial.ts'
import { loadPrompts } from '../src/tools/trial.utils.ts'
import { logExperiment } from './git-experiment.ts'

// ============================================================================
// Config
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const MODULE_PROMPTS_PATH = join(PROJECT_ROOT, 'skills/modnet-modules/assets/prompts.jsonl')
const PROACTIVE_PROMPTS_PATH = join(PROJECT_ROOT, 'skills/proactive-node/assets/prompts.jsonl')
const MODULE_WORKSPACE = '/private/tmp/module-eval'
const PROACTIVE_WORKSPACE = '/private/tmp/proactive-eval'

const cliArgs = Bun.argv.slice(2)
const moduleOnly = cliArgs.includes('--module-only')
const proactiveOnly = cliArgs.includes('--proactive-only')
const runModule = !proactiveOnly
const runProactive = !moduleOnly

// ============================================================================
// Quality Gates
// ============================================================================

/** Module quality gate: score >= 0.7 AND static checks all pass (S=1.0) */
const passesModuleGate = (result: TrialResult): boolean => {
  const trial = result.trials[0]
  if (!trial) return false
  const score = trial.score ?? 0
  if (score < 0.7) return false
  // Static score must be 1.0 (typeCheck + modnet field + SKILL.md)
  const outcome = trial.outcome as { static?: { score?: number } } | undefined
  const staticScore = outcome?.static?.score ?? 0
  return staticScore >= 1.0
}

/** Proactive quality gate: composite >= 0.7 AND contract parse passes */
const passesProactiveGate = (result: TrialResult): boolean => {
  const trial = result.trials[0]
  if (!trial) return false
  const score = trial.score ?? 0
  if (score < 0.7) return false
  // Contract must parse cleanly
  const outcome = trial.outcome as { contract?: { checks?: Array<{ name: string; pass: boolean }> } } | undefined
  const parseCheck = outcome?.contract?.checks?.find((c) => c.name === 'parse')
  return parseCheck?.pass !== false
}

// ============================================================================
// Reporting
// ============================================================================

const printSummary = (results: TrialResult[], gateCheck: (r: TrialResult) => boolean, label: string) => {
  const passing = results.filter(gateCheck)
  const avgScore = results.reduce((s, r) => s + (r.trials[0]?.score ?? 0), 0) / results.length

  console.log(`\n${label}: ${passing.length}/${results.length} pass quality gate (avg score ${avgScore.toFixed(3)})`)

  for (const result of results) {
    const trial = result.trials[0]
    const score = trial?.score ?? 0
    const passed = gateCheck(result)
    const status = passed ? '✓' : '✗'
    const traj = trial?.trajectory?.length ?? 0
    console.log(`  ${status} ${result.id}: ${score.toFixed(3)} (${traj} trajectory steps)`)
  }

  return { passing: passing.length, total: results.length, avgScore }
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const moduleOutputPath = join(PROJECT_ROOT, `.memory/evals/sft-module-${timestamp}.jsonl`)
  const proactiveOutputPath = join(PROJECT_ROOT, `.memory/evals/sft-proactive-${timestamp}.jsonl`)

  let moduleResults: TrialResult[] = []
  let proactiveResults: TrialResult[] = []

  // ── Module collection ────────────────────────────────────────────────────
  if (runModule) {
    console.log('\n=== MODULE COLLECTION (25 prompts) ===')
    const modulePrompts = await loadPrompts(MODULE_PROMPTS_PATH)
    console.log(`Loaded ${modulePrompts.length} module prompts. Running k=1...`)

    moduleResults = await runTrial({
      adapter: moduleAdapt,
      prompts: modulePrompts,
      grader: createModuleGrader({ judge: createJudge() }),
      k: 1,
      outputPath: moduleOutputPath,
      progress: true,
      timeout: 600_000,
      concurrency: 1,
      workspaceDir: MODULE_WORKSPACE,
    })
  }

  // ── Proactive collection ─────────────────────────────────────────────────
  if (runProactive) {
    console.log('\n=== PROACTIVE COLLECTION (5 prompts) ===')
    const proactivePrompts = await loadPrompts(PROACTIVE_PROMPTS_PATH)
    console.log(`Loaded ${proactivePrompts.length} proactive prompts. Running k=1...`)

    proactiveResults = await runTrial({
      adapter: proactiveAdapt,
      prompts: proactivePrompts,
      grader: createProactiveGrader({ projectRoot: PROJECT_ROOT }),
      k: 1,
      outputPath: proactiveOutputPath,
      progress: true,
      timeout: 300_000,
      concurrency: 1,
      workspaceDir: PROACTIVE_WORKSPACE,
    })
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n=== PHASE B SUMMARY ===')

  const moduleSummary = runModule
    ? printSummary(moduleResults, passesModuleGate, 'Module')
    : { passing: 0, total: 0, avgScore: 0 }

  const proactiveSummary = runProactive
    ? printSummary(proactiveResults, passesProactiveGate, 'Proactive')
    : { passing: 0, total: 0, avgScore: 0 }

  const totalPassing = moduleSummary.passing + proactiveSummary.passing
  const totalPrompts = moduleSummary.total + proactiveSummary.total
  const overallAvg =
    totalPrompts > 0
      ? (moduleSummary.avgScore * moduleSummary.total + proactiveSummary.avgScore * proactiveSummary.total) /
        totalPrompts
      : 0

  console.log(`\nTotal: ${totalPassing}/${totalPrompts} pass quality gate`)
  console.log(`Overall avg score: ${overallAvg.toFixed(3)}`)

  if (runModule) console.log(`Module output: ${moduleOutputPath}`)
  if (runProactive) console.log(`Proactive output: ${proactiveOutputPath}`)

  // ── Log experiment ────────────────────────────────────────────────────────
  const sha = (await Bun.$`git rev-parse --short HEAD`.cwd(PROJECT_ROOT).quiet()).text().trim()

  await logExperiment({
    commit: sha,
    scores: {
      modulePass: moduleSummary.passing,
      moduleTotal: moduleSummary.total,
      moduleAvg: moduleSummary.avgScore,
      proactivePass: proactiveSummary.passing,
      proactiveTotal: proactiveSummary.total,
      proactiveAvg: proactiveSummary.avgScore,
      totalPass: totalPassing,
      totalPrompts,
      qualityGateRate: totalPrompts > 0 ? totalPassing / totalPrompts : 0,
    },
    status: 'keep',
    description: `phase-B SFT collection: ${totalPassing}/${totalPrompts} pass quality gate (module=${moduleSummary.passing}/${moduleSummary.total}, proactive=${proactiveSummary.passing}/${proactiveSummary.total})`,
    timestamp: new Date().toISOString(),
    prompts: ['all-module-25', 'all-proactive-5'],
  })

  console.log('\nExperiment logged to .memory/evals/experiments.jsonl')
}

main().catch(console.error)
