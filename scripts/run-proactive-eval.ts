#!/usr/bin/env bun

/**
 * Proactive node eval — run 5 proactive prompts through the proactive-grader.
 *
 * @remarks
 * Phase A baseline script for the auto-research loop. Loads prompts from
 * skills/proactive-node/assets/prompts.jsonl, runs each through the proactive
 * adapter (which loads SKILL.md as system prompt), grades with createProactiveGrader,
 * saves results to .memory/evals/, and prints per-prompt dimension breakdown.
 *
 * Usage:
 *   bun scripts/run-proactive-eval.ts
 *   bun scripts/run-proactive-eval.ts --k 3      # run each prompt 3 times
 */

import { join, resolve } from 'node:path'
import { adapt } from '../src/tools/adapters/proactive.ts'
import { createProactiveGrader } from '../src/tools/proactive-grader.ts'
import type { TrialResult } from '../src/tools/trial.schemas.ts'
import { runTrial } from '../src/tools/trial.ts'
import { loadPrompts } from '../src/tools/trial.utils.ts'

// ============================================================================
// Config
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const PROMPTS_PATH = join(PROJECT_ROOT, 'skills/proactive-node/assets/prompts.jsonl')
const WORKSPACE_BASE = '/private/tmp/proactive-eval'

// Parse CLI args
const args = Bun.argv.slice(2)
const k = parseInt(args.find((_a, i) => args[i - 1] === '--k') ?? '1', 10) || 1

// ============================================================================
// Analysis
// ============================================================================

type DimScores = { outcome: number; process: number; efficiency: number }

const extractDims = (result: TrialResult): DimScores => {
  const dims: DimScores = { outcome: 0, process: 0, efficiency: 0 }
  for (const trial of result.trials) {
    const d = trial.outcome as
      | { contract?: { score?: number }; behavioral?: { score?: number }; integration?: { score?: number } }
      | undefined
    if (!d) continue
    dims.outcome += d.contract?.score ?? 0
    dims.process += d.behavioral?.score ?? 0
    dims.efficiency += d.integration?.score ?? 0
  }
  const n = result.trials.length
  if (n > 0) {
    dims.outcome /= n
    dims.process /= n
    dims.efficiency /= n
  }
  return dims
}

const printResult = (result: TrialResult) => {
  const passCount = result.trials.filter((t) => t.pass).length
  const avgScore = result.trials.reduce((s, t) => s + (t.score ?? 0), 0) / result.trials.length
  const dims = extractDims(result)
  const status = passCount === result.trials.length ? '✓' : passCount === 0 ? '✗' : '~'

  console.log(`${status} ${result.id} (${passCount}/${result.trials.length} pass, composite=${avgScore.toFixed(3)})`)
  console.log(
    `    contract=${dims.outcome.toFixed(3)}  behavioral=${dims.process.toFixed(3)}  integration=${dims.efficiency.toFixed(3)}`,
  )

  // Print failing checks from first trial
  const trial = result.trials.find((t) => !t.pass)
  if (trial?.reasoning) {
    const short = trial.reasoning.slice(0, 400)
    console.log(`    → ${short}`)
  }
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  console.log(`Loading proactive prompts from ${PROMPTS_PATH}...`)
  const prompts = await loadPrompts(PROMPTS_PATH)
  console.log(`Found ${prompts.length} prompts. Running k=${k}...\n`)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = join(PROJECT_ROOT, `.memory/evals/proactive-${timestamp}.jsonl`)

  const config = {
    adapter: adapt,
    prompts,
    grader: createProactiveGrader({ projectRoot: PROJECT_ROOT }),
    k,
    outputPath,
    progress: true,
    timeout: 300_000, // 5 min per prompt — workspace isolation keeps scope clean
    concurrency: 1,
    workspaceDir: WORKSPACE_BASE, // always isolate — avoids codebase exploration
  }

  const results = await runTrial(config)

  console.log('\n=== RESULTS ===\n')

  let totalPass = 0
  let totalTrials = 0
  const domainSums: DimScores = { outcome: 0, process: 0, efficiency: 0 }

  for (const result of results) {
    printResult(result)
    const passCount = result.trials.filter((t) => t.pass).length
    totalPass += passCount
    totalTrials += result.trials.length
    const dims = extractDims(result)
    domainSums.outcome += dims.outcome
    domainSums.process += dims.process
    domainSums.efficiency += dims.efficiency
  }

  const n = results.length
  const passRate = totalTrials > 0 ? totalPass / totalTrials : 0

  console.log('\n=== SUMMARY ===')
  console.log(`Pass rate: ${totalPass}/${totalTrials} (${(passRate * 100).toFixed(1)}%)`)
  console.log(`Avg contract  (outcome):    ${(domainSums.outcome / n).toFixed(3)}`)
  console.log(`Avg behavioral (process):   ${(domainSums.process / n).toFixed(3)}`)
  console.log(`Avg integration (efficiency): ${(domainSums.efficiency / n).toFixed(3)}`)
  console.log(`\nOutput: ${outputPath}`)

  // Identify weakest prompts (for calibration focus)
  const sorted = [...results].sort((a, b) => {
    const scoreA = a.trials.reduce((s, t) => s + (t.score ?? 0), 0) / a.trials.length
    const scoreB = b.trials.reduce((s, t) => s + (t.score ?? 0), 0) / b.trials.length
    return scoreA - scoreB
  })

  if (sorted[0]?.trials.some((t) => !t.pass)) {
    console.log('\n=== WEAKEST PROMPTS (calibration targets) ===')
    for (const r of sorted.slice(0, 3)) {
      const avgScore = r.trials.reduce((s, t) => s + (t.score ?? 0), 0) / r.trials.length
      if (avgScore < 1) console.log(`  - ${r.id}: ${avgScore.toFixed(3)}`)
    }
  }
}

main().catch(console.error)
