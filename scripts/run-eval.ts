#!/usr/bin/env bun

/**
 * Eval cycle orchestrator — runs module generation trials with Claude Code,
 * grades results with three-dimension module grader, persists to .memory/evals/.
 *
 * @remarks
 * Usage:
 *   bun scripts/run-eval.ts                          # Full run (20 prompts, k=3)
 *   bun scripts/run-eval.ts --pilot                  # Pilot (2 Easy prompts, k=1)
 *   bun scripts/run-eval.ts --filter reading-list    # Single prompt
 *   bun scripts/run-eval.ts --k 1 --concurrency 2   # Custom k and concurrency
 *   bun scripts/run-eval.ts --difficulty Easy         # Filter by difficulty
 */

import { resolve, join } from 'node:path'
import { adapt } from '../src/tools/adapters/claude-code.ts'
import { createModuleGrader } from '../src/tools/module-grader.ts'
import { runTrial } from '../src/tools/trial.ts'
import { loadPrompts, persistTrialResults } from '../src/tools/trial.utils.ts'
import type { PromptCase } from '../src/tools/trial.schemas.ts'

// ============================================================================
// Config
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const PROMPTS_PATH = join(PROJECT_ROOT, 'skills/modnet-modules/assets/prompts.jsonl')
const MEMORY_PATH = join(PROJECT_ROOT, '.memory')
const DEFAULT_WORKSPACE = '/tmp/module-eval'
const DEFAULT_K = 3
const DEFAULT_TIMEOUT = 600_000 // 10 minutes per generation
const PILOT_IDS = ['reading-list', 'unit-converter']

// ============================================================================
// Argument Parsing
// ============================================================================

type EvalArgs = {
	pilot: boolean
	filter?: string
	difficulty?: string
	k: number
	concurrency: number
	workspace: string
	timeout: number
	progress: boolean
}

const parseArgs = (): EvalArgs => {
	const args = process.argv.slice(2)
	const result: EvalArgs = {
		pilot: false,
		k: DEFAULT_K,
		concurrency: 1,
		workspace: DEFAULT_WORKSPACE,
		timeout: DEFAULT_TIMEOUT,
		progress: true,
	}

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--pilot':
				result.pilot = true
				result.k = 1
				break
			case '--filter':
				result.filter = args[++i]
				break
			case '--difficulty':
				result.difficulty = args[++i]
				break
			case '--k':
				result.k = Number(args[++i])
				break
			case '--concurrency':
				result.concurrency = Number(args[++i])
				break
			case '--workspace':
				result.workspace = args[++i]!
				break
			case '--timeout':
				result.timeout = Number(args[++i])
				break
			case '--quiet':
				result.progress = false
				break
			case '--help':
				console.log(`Usage: bun scripts/run-eval.ts [options]
  --pilot              Run 2 Easy prompts at k=1
  --filter <id>        Run only this prompt ID
  --difficulty <level> Filter by Easy|Medium|Hard
  --k <n>              Trials per prompt (default: 3)
  --concurrency <n>    Parallel workers (default: 1)
  --workspace <dir>    Workspace base dir (default: /tmp/module-eval)
  --timeout <ms>       Timeout per trial in ms (default: 600000)
  --quiet              Suppress progress output`)
				process.exit(0)
		}
	}

	return result
}

// ============================================================================
// Prompt Filtering
// ============================================================================

const filterPrompts = (prompts: PromptCase[], config: EvalArgs): PromptCase[] => {
	let filtered = prompts

	if (config.pilot) {
		filtered = filtered.filter((p) => PILOT_IDS.includes(p.id))
	}

	if (config.filter) {
		filtered = filtered.filter((p) => p.id === config.filter)
	}

	if (config.difficulty) {
		filtered = filtered.filter((p) => {
			const meta = p.metadata as Record<string, unknown> | undefined
			return meta?.difficulty === config.difficulty
		})
	}

	return filtered
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
	const config = parseArgs()

	console.error('=== Module Generation Eval Cycle ===')
	console.error(`Mode: ${config.pilot ? 'PILOT' : 'FULL'}`)
	console.error(`k: ${config.k}, concurrency: ${config.concurrency}`)
	console.error(`Workspace: ${config.workspace}`)
	console.error(`Timeout: ${config.timeout}ms per trial`)
	console.error('')

	// Load prompts
	const allPrompts = await loadPrompts(PROMPTS_PATH)
	const prompts = filterPrompts(allPrompts, config)

	if (prompts.length === 0) {
		console.error('No prompts matched filters. Exiting.')
		process.exit(1)
	}

	console.error(`Prompts: ${prompts.length} (${prompts.map((p) => p.id).join(', ')})`)
	console.error(`Total executions: ${prompts.length * config.k}`)
	console.error('')

	// Create grader (keyword matching — no LLM judge for first cycle)
	const grader = createModuleGrader({
		typeCheck: true,
		projectRoot: PROJECT_ROOT,
	})

	// Timestamp for output file
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const outputPath = join(config.workspace, `results-${timestamp}.jsonl`)

	// Ensure workspace exists
	await Bun.$`mkdir -p ${config.workspace}`.quiet()

	// Run trials — adapter imported directly from TS module
	console.error('Starting trial run...')
	console.error('')

	const results = await runTrial({
		adapter: adapt,
		prompts,
		grader,
		k: config.k,
		outputPath,
		timeout: config.timeout,
		concurrency: config.concurrency,
		workspaceDir: config.workspace,
		progress: config.progress,
	})

	// Print summary
	console.error('')
	console.error('=== Results Summary ===')
	console.error('')

	let totalPass = 0
	let totalTrials = 0

	type DomainStats = { pass: number; total: number; scores: number[] }
	const byDomain: Record<string, DomainStats> = {}
	const byDifficulty: Record<string, DomainStats> = {}

	for (const result of results) {
		const meta = result.metadata as Record<string, unknown> | undefined
		const domain = (meta?.domain as string) ?? 'unknown'
		const difficulty = (meta?.difficulty as string) ?? 'unknown'

		const passes = result.trials.filter((t) => t.pass).length
		totalPass += passes
		totalTrials += result.trials.length

		if (!byDomain[domain]) byDomain[domain] = { pass: 0, total: 0, scores: [] }
		byDomain[domain]!.pass += passes
		byDomain[domain]!.total += result.trials.length
		byDomain[domain]!.scores.push(result.passRate ?? 0)

		if (!byDifficulty[difficulty]) byDifficulty[difficulty] = { pass: 0, total: 0, scores: [] }
		byDifficulty[difficulty]!.pass += passes
		byDifficulty[difficulty]!.total += result.trials.length
		byDifficulty[difficulty]!.scores.push(result.passRate ?? 0)

		// Dimension breakdown from outcome
		const dimSummary = result.trials.map((t) => {
			const outcome = t.outcome as Record<string, Record<string, unknown>> | undefined
			const i = (outcome?.intention as Record<string, unknown>)?.score ?? '?'
			const s = (outcome?.static as Record<string, unknown>)?.score ?? '?'
			const d = (outcome?.dynamic as Record<string, unknown>)?.score ?? '?'
			return `I:${typeof i === 'number' ? i.toFixed(2) : i} S:${typeof s === 'number' ? s.toFixed(2) : s} D:${typeof d === 'number' ? d.toFixed(2) : d}`
		}).join(' | ')

		console.error(
			`  ${result.id}: pass@${config.k}=${(result.passAtK ?? 0).toFixed(2)}` +
			` passRate=${(result.passRate ?? 0).toFixed(2)}` +
			` [${dimSummary}]`
		)
	}

	console.error('')
	console.error('--- By Domain ---')
	for (const [domain, stats] of Object.entries(byDomain)) {
		const avg = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
		console.error(`  ${domain}: ${stats.pass}/${stats.total} pass, avg passRate=${avg.toFixed(2)}`)
	}

	console.error('')
	console.error('--- By Difficulty ---')
	for (const [diff, stats] of Object.entries(byDifficulty)) {
		const avg = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
		console.error(`  ${diff}: ${stats.pass}/${stats.total} pass, avg passRate=${avg.toFixed(2)}`)
	}

	console.error('')
	console.error(`Overall: ${totalPass}/${totalTrials} pass (${((totalPass / totalTrials) * 100).toFixed(1)}%)`)
	console.error(`Results written to: ${outputPath}`)

	// Persist to .memory/evals/
	console.error('')
	console.error('Persisting to .memory/evals/...')
	const { path: persistedPath } = await persistTrialResults(results, MEMORY_PATH)
	console.error(`Persisted: ${persistedPath}`)
}

main().catch((error) => {
	console.error('Fatal error:', error)
	process.exit(1)
})
