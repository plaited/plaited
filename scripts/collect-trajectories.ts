#!/usr/bin/env bun

/**
 * collect-trajectories.ts — Phase 6 SFT trajectory collection.
 *
 * @remarks
 * Runs all 20 module prompts k=1 with the Claude Code adapter, applies a
 * three-dimension quality gate, formats passing trajectories as SFT training
 * data, and logs the experiment to `.memory/evals/experiments.jsonl`.
 *
 * Quality gate thresholds:
 * - intention (outcome)  ≥ 0.8
 * - static   (process)   = 1.0  — all structural checks must pass
 * - dynamic  (efficiency) ≥ 0.7
 *
 * Output:
 * - SFT data  → trajectories/claude-code/sft-{timestamp}.jsonl  (gitignored)
 * - Trial log → .memory/evals/trial-{timestamp}.jsonl            (git-versioned)
 * - Experiment entry → .memory/evals/experiments.jsonl            (git-versioned)
 *
 * Usage:
 *   bun scripts/collect-trajectories.ts
 *
 * @packageDocumentation
 */

import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { $ } from 'bun'
import { adapt } from '../src/tools/adapters/claude-code.ts'
import { createModuleGrader } from '../src/tools/module-grader.ts'
import type { TrajectoryStep } from '../src/tools/trial.schemas.ts'
import { runTrial } from '../src/tools/trial.ts'
import { loadPrompts, persistTrialResults } from '../src/tools/trial.utils.ts'
import { logExperiment } from './git-experiment.ts'

// ============================================================================
// Constants
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const PROMPTS_PATH = join(PROJECT_ROOT, 'skills/modnet-modules/assets/prompts.jsonl')
const MEMORY_PATH = join(PROJECT_ROOT, '.memory')
const WORKSPACE = '/tmp/sft-collection'
const TRAJECTORIES_DIR = join(PROJECT_ROOT, 'trajectories/claude-code')
const TIMEOUT = 600_000 // 10 minutes per generation

// SFT quality gate thresholds
const GATE = {
  intention: 0.8, // outcome dimension
  static: 1.0, // process dimension — all structural checks must pass
  dynamic: 0.7, // efficiency dimension
}

// ============================================================================
// Types
// ============================================================================

type DimScores = { intention: number; static: number; dynamic: number }

// ============================================================================
// Quality Gate
// ============================================================================

const extractDimensions = (outcome: Record<string, unknown> | undefined): DimScores => {
  const intention = ((outcome?.intention as Record<string, unknown>)?.score as number) ?? 0
  const staticScore = ((outcome?.static as Record<string, unknown>)?.score as number) ?? 0
  const dynamic = ((outcome?.dynamic as Record<string, unknown>)?.score as number) ?? 0
  return { intention, static: staticScore, dynamic }
}

const passesQualityGate = (dims: DimScores): boolean =>
  dims.intention >= GATE.intention && dims.static >= GATE.static && dims.dynamic >= GATE.dynamic

// ============================================================================
// SFT Formatter
// ============================================================================

/**
 * Render a trajectory into a readable assistant-turn string for SFT.
 *
 * @remarks
 * Thoughts become `<thinking>` blocks, tool calls show name+input+output,
 * messages are emitted as-is. Falls back to raw output when no trajectory.
 */
const formatAssistantContent = (trajectory: TrajectoryStep[] | undefined, output: string): string => {
  if (!trajectory || trajectory.length === 0) return output

  const parts: string[] = []

  for (const step of trajectory) {
    if (step.type === 'thought') {
      parts.push(`<thinking>\n${step.content}\n</thinking>`)
    } else if (step.type === 'tool_call') {
      const inputStr = step.input ? JSON.stringify(step.input, null, 2) : '{}'
      const outputStr =
        step.output !== undefined
          ? `\nResult: ${typeof step.output === 'string' ? step.output.slice(0, 500) : JSON.stringify(step.output).slice(0, 500)}`
          : ''
      parts.push(`[Tool: ${step.name}]\nInput: ${inputStr}${outputStr}`)
    } else if (step.type === 'message') {
      parts.push(step.content)
    }
  }

  return parts.join('\n\n') || output
}

// ============================================================================
// Main
// ============================================================================

const main = async (): Promise<void> => {
  console.error('=== SFT Trajectory Collection — Phase 6 ===')
  console.error('Agent:   Claude Code')
  console.error('Prompts: 20 module prompts, k=1')
  console.error(`Gate:    intention≥${GATE.intention}, static=${GATE.static}, dynamic≥${GATE.dynamic}`)
  console.error('')

  // Ensure output directories exist
  await mkdir(WORKSPACE, { recursive: true })
  await mkdir(TRAJECTORIES_DIR, { recursive: true })

  // Load all 20 module prompts
  const prompts = await loadPrompts(PROMPTS_PATH)
  console.error(`Loaded ${prompts.length} prompts`)
  console.error('')

  // Three-dimension module grader (keyword matching, no LLM judge)
  const grader = createModuleGrader({ typeCheck: true, projectRoot: PROJECT_ROOT })

  // Run k=1 trials with full trajectory capture
  console.error('Running trials (k=1, timeout=10min each)...')
  const results = await runTrial({
    adapter: adapt,
    prompts,
    grader,
    k: 1,
    timeout: TIMEOUT,
    concurrency: 1,
    workspaceDir: WORKSPACE,
    progress: true,
  })

  // Persist trial results to .memory/evals/ — this commits + pushes the JSONL file
  console.error('\nPersisting trial results to .memory/evals/...')
  const { path: trialPath } = await persistTrialResults(results, MEMORY_PATH)
  console.error(`Persisted: ${trialPath}`)

  // Capture the SHA of the trial commit — referenced in the experiment entry
  const trialSha = (await $`git rev-parse --short HEAD`.cwd(PROJECT_ROOT).quiet()).text().trim()

  // ── Quality Gate ──────────────────────────────────────────────────────────

  console.error('\n--- Quality Gate ---')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const sftPath = join(TRAJECTORIES_DIR, `sft-${timestamp}.jsonl`)

  const passed: string[] = []
  const failed: string[] = []
  const sftLines: string[] = []
  const allDims: DimScores[] = []

  for (const result of results) {
    const trial = result.trials[0]
    if (!trial) continue

    const outcome = trial.outcome as Record<string, unknown> | undefined
    const dims = extractDimensions(outcome)
    allDims.push(dims)

    const gatePass = passesQualityGate(dims)
    const statusTag = gatePass ? 'KEEP' : 'DROP'

    console.error(
      `  ${result.id.padEnd(26)} I:${dims.intention.toFixed(2)} S:${dims.static.toFixed(2)} D:${dims.dynamic.toFixed(2)} → ${statusTag}`,
    )

    if (gatePass) {
      passed.push(result.id)

      // Format as SFT training example
      const userPrompt = Array.isArray(result.input) ? result.input.join('\n') : result.input
      const assistantContent = formatAssistantContent(trial.trajectory, trial.output)

      sftLines.push(
        JSON.stringify({
          messages: [
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: assistantContent },
          ],
          grading: {
            intention: dims.intention,
            static: dims.static,
            dynamic: dims.dynamic,
            composite: trial.score ?? 0,
          },
          metadata: {
            promptId: result.id,
            agent: 'claude-code',
            timestamp: new Date().toISOString(),
            duration: trial.duration,
            inputTokens: trial.timing?.inputTokens,
            outputTokens: trial.timing?.outputTokens,
          },
        }),
      )
    } else {
      failed.push(result.id)
    }
  }

  // Write SFT data to gitignored trajectories/ directory
  if (sftLines.length > 0) {
    await Bun.write(sftPath, `${sftLines.join('\n')}\n`)
    console.error(`\nSFT data: ${sftPath} (${sftLines.length} trajectories)`)
  } else {
    console.error('\nNo trajectories passed the quality gate.')
  }

  // ── Aggregate Scores ──────────────────────────────────────────────────────

  const n = allDims.length || 1
  const avgI = allDims.reduce((s, d) => s + d.intention, 0) / n
  const avgS = allDims.reduce((s, d) => s + d.static, 0) / n
  const avgD = allDims.reduce((s, d) => s + d.dynamic, 0) / n
  const avgComposite = allDims.reduce((s, d) => s + Math.cbrt(d.intention * d.static * d.dynamic), 0) / n
  const gatePassRate = passed.length / (results.length || 1)

  console.error('\n=== Summary ===')
  console.error(`Passed gate: ${passed.length}/${results.length} (${(gatePassRate * 100).toFixed(0)}%)`)
  console.error(`Avg scores — I:${avgI.toFixed(3)} S:${avgS.toFixed(3)} D:${avgD.toFixed(3)} composite:${avgComposite.toFixed(3)}`)
  if (passed.length > 0) console.error(`Kept:    ${passed.join(', ')}`)
  if (failed.length > 0) console.error(`Dropped: ${failed.join(', ')}`)

  // ── Log Experiment ────────────────────────────────────────────────────────

  // logExperiment writes to experiments.jsonl (unstaged).
  // We then commit that change as the experiment record.
  const description = `phase-6 SFT trajectory collection — claude-code k=1, ${passed.length}/${results.length} pass gate (I≥0.8 S=1.0 D≥0.7)`

  await logExperiment({
    commit: trialSha,
    scores: {
      intention: avgI,
      static: avgS,
      dynamic: avgD,
      composite: avgComposite,
      qualityGatePass: gatePassRate,
      passedCount: passed.length,
      totalCount: results.length,
    },
    status: 'keep',
    description,
    timestamp: new Date().toISOString(),
    prompts: results.map((r) => r.id),
  })

  // Stage and commit the experiments.jsonl update
  await $`git add .memory/evals/experiments.jsonl`.cwd(PROJECT_ROOT).quiet()
  const commitResult =
    await $`git commit -m ${{ raw: `experiment: ${description}` }}`.cwd(PROJECT_ROOT).nothrow().quiet()

  if (commitResult.exitCode === 0) {
    const experimentSha = (await $`git rev-parse --short HEAD`.cwd(PROJECT_ROOT).quiet()).text().trim()
    await $`git push`.cwd(PROJECT_ROOT).nothrow().quiet()
    console.error(`\nExperiment committed (${experimentSha}) and pushed.`)
  } else {
    console.error('\nExperiment logged to experiments.jsonl (commit skipped — no changes or error).')
  }

  console.error('Done.')
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
