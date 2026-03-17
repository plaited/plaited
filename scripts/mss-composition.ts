/**
 * MSS composition generation runner — Phase 3 calibration tool.
 *
 * @remarks
 * Loads modnet-node and mss-vocabulary SKILL.md files as context, runs 12
 * composition descriptions through a model, and grades two-module composition
 * accuracy using deterministic rules: scale nesting, boundary cascade, and
 * exact MSS field match.
 *
 * Usage:
 * ```bash
 * bun scripts/mss-composition.ts                    # Run with Anthropic Haiku
 * bun scripts/mss-composition.ts --verbose          # Show per-prompt details
 * bun scripts/mss-composition.ts --filter health    # Run only health prompts
 * ```
 *
 * @packageDocumentation
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { grade } from './composition-grader.ts'

// ============================================================================
// Configuration
// ============================================================================

const MODNET_SKILL_PATH = `${import.meta.dir}/../skills/modnet-node/SKILL.md`
const MSS_SKILL_PATH = `${import.meta.dir}/../skills/mss-vocabulary/SKILL.md`
const PROMPTS_PATH = `${import.meta.dir}/../skills/modnet-node/assets/composition-prompts.jsonl`
const RESULTS_DIR = `${import.meta.dir}/../.memory/evals`

const args = process.argv.slice(2)
const filterIdx = args.indexOf('--filter')
const filter = filterIdx !== -1 ? args[filterIdx + 1] : undefined
const verbose = args.includes('--verbose')

// ============================================================================
// Types
// ============================================================================

type SkeletonRef = {
  contentType: string
  structure: string
  mechanics: string[]
  boundary: string
  scale: number
}

type PromptEntry = {
  id: string
  input: string
  metadata: {
    domain: string
    difficulty: string
    relationship: string
    inner: SkeletonRef
    outer: SkeletonRef
    effectiveBoundary: string
  }
}

type CompositionResult = {
  id: string
  domain: string
  difficulty: string
  pass: boolean
  score: number
  reasoning: string
  expectedInner: SkeletonRef
  expectedOuter: SkeletonRef
  expectedEffectiveBoundary: string
  actual: string
  durationMs: number
}

// ============================================================================
// Load skills and prompts
// ============================================================================

const loadSkillContent = async (path: string): Promise<string> => {
  const file = Bun.file(path)
  if (!(await file.exists())) throw new Error(`SKILL.md not found at ${path}`)
  return file.text()
}

const loadPrompts = async (): Promise<PromptEntry[]> => {
  const file = Bun.file(PROMPTS_PATH)
  if (!(await file.exists())) throw new Error(`Prompts not found at ${PROMPTS_PATH}`)
  const text = await file.text()
  const entries: PromptEntry[] = []
  for (const line of text.trim().split('\n')) {
    if (!line.trim()) continue
    const entry = JSON.parse(line) as PromptEntry
    if (filter && entry.metadata.domain !== filter && entry.id !== filter) continue
    entries.push(entry)
  }
  return entries
}

// ============================================================================
// System prompt
// ============================================================================

const buildSystemPrompt = (modnetContent: string, mssContent: string): string =>
  `You are a module composition generator for modnet nodes. Given a description of two connected modules, output MSS bridge-code tags for both.

Read both skill references below, then reason about the correct composition.

<modnet-node-skill>
${modnetContent}
</modnet-node-skill>

<mss-vocabulary>
${mssContent}
</mss-vocabulary>

COMPOSITION RULES:
1. name — kebab-case for each module (lowercase, numbers, hyphens only)
2. inner.scale < outer.scale — the inner module is nested inside the outer. Scale increases with complexity.
3. boundary cascade — effective_boundary = min(inner.boundary, outer.boundary) using restriction order: none > paid > ask > all. A private inner module (none) inside a consent-required outer (ask) gives effective boundary: none.
4. contentType — same contentType = modules auto-group together. Different contentType = separate groups.
5. Use valid structure values for each scale level (S1: object/form; S2: object/list/collection/steps/form; S3: pool/stream/feed/wall/thread/form/collection/steps; S4: any of the above)
6. mechanics — only tag what the description explicitly mentions or directly implies

Your ENTIRE response must be a single JSON object. Do not write any explanation, markdown, or other text:
{"inner":{"name":"...","contentType":"...","structure":"...","mechanics":[...],"boundary":"...","scale":N},"outer":{"name":"...","contentType":"...","structure":"...","mechanics":[...],"boundary":"...","scale":N}}`

// ============================================================================
// API call
// ============================================================================

const classify = async (
  systemPrompt: string,
  description: string,
): Promise<{ output: string; durationMs: number }> => {
  const start = Date.now()
  let output = ''

  for await (const message of query({
    prompt: description,
    options: {
      systemPrompt,
      model: 'claude-haiku-4-5',
      allowedTools: [],
      maxTurns: 1,
      permissionMode: 'dontAsk',
    },
  })) {
    if ('result' in message) output = message.result
  }

  return { output, durationMs: Date.now() - start }
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  console.log(`\n━━━ MSS Composition Generation — Phase 3 Calibration ━━━`)

  const modnetContent = await loadSkillContent(MODNET_SKILL_PATH)
  const mssContent = await loadSkillContent(MSS_SKILL_PATH)
  const prompts = await loadPrompts()

  console.log(`Prompts: ${prompts.length}${filter ? ` (filtered: ${filter})` : ''}\n`)

  const systemPrompt = buildSystemPrompt(modnetContent, mssContent)
  const results: CompositionResult[] = []

  for (const prompt of prompts) {
    process.stdout.write(`  ${prompt.id.padEnd(36)}`)

    try {
      const { output, durationMs } = await classify(systemPrompt, prompt.input)
      const gradeResult = await grade({ input: prompt.input, output, metadata: prompt.metadata })

      const result: CompositionResult = {
        id: prompt.id,
        domain: prompt.metadata.domain,
        difficulty: prompt.metadata.difficulty,
        pass: gradeResult.pass,
        score: gradeResult.score,
        reasoning: gradeResult.reasoning ?? '',
        expectedInner: prompt.metadata.inner,
        expectedOuter: prompt.metadata.outer,
        expectedEffectiveBoundary: prompt.metadata.effectiveBoundary,
        actual: output.trim(),
        durationMs,
      }
      results.push(result)

      console.log(
        `${gradeResult.pass ? '✓' : '✗'} ${(gradeResult.score * 100).toFixed(0)}%  ${durationMs}ms${gradeResult.pass ? '' : `  — ${gradeResult.reasoning}`}`,
      )

      if (verbose && !gradeResult.pass) {
        console.log(`    expected inner: ${JSON.stringify(prompt.metadata.inner)}`)
        console.log(`    expected outer: ${JSON.stringify(prompt.metadata.outer)}`)
        console.log(`    actual:         ${output.trim().slice(0, 300)}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.log(`ERROR: ${msg}`)
      results.push({
        id: prompt.id,
        domain: prompt.metadata.domain,
        difficulty: prompt.metadata.difficulty,
        pass: false,
        score: 0,
        reasoning: `Error: ${msg}`,
        expectedInner: prompt.metadata.inner,
        expectedOuter: prompt.metadata.outer,
        expectedEffectiveBoundary: prompt.metadata.effectiveBoundary,
        actual: '',
        durationMs: 0,
      })
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const totalPass = results.filter((r) => r.pass).length
  const totalScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0)

  console.log(`\n━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Pass rate:    ${totalPass}/${results.length} (${((totalPass / results.length) * 100).toFixed(1)}%)`)
  console.log(`  Avg score:    ${(totalScore * 100).toFixed(1)}% (per-point accuracy)`)
  console.log(`  Total time:   ${(totalDuration / 1000).toFixed(1)}s`)

  const byDifficulty = new Map<string, CompositionResult[]>()
  for (const r of results) {
    const arr = byDifficulty.get(r.difficulty) ?? []
    arr.push(r)
    byDifficulty.set(r.difficulty, arr)
  }

  console.log(`\n  By difficulty:`)
  for (const [diff, items] of [...byDifficulty.entries()].sort()) {
    const passCount = items.filter((r) => r.pass).length
    console.log(`    ${diff.padEnd(8)} ${passCount}/${items.length} (${((passCount / items.length) * 100).toFixed(0)}%)`)
  }

  const failures = results.filter((r) => !r.pass)
  if (failures.length > 0) {
    console.log(`\n  Failures:`)
    for (const f of failures) {
      console.log(`    ${f.id}: ${f.reasoning}`)
    }
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  // ── Persist ────────────────────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultsPath = `${RESULTS_DIR}/mss-composition-${timestamp}.jsonl`

  const dir = Bun.file(`${RESULTS_DIR}/.gitkeep`)
  if (!(await dir.exists())) {
    await Bun.$`mkdir -p ${RESULTS_DIR}`.quiet()
  }

  await Bun.write(resultsPath, `${results.map((r) => JSON.stringify(r)).join('\n')}\n`)
  console.log(`Results saved: ${resultsPath}`)

  if (totalPass < results.length) process.exit(1)
}

await main()
