/**
 * MSS classification runner — Phase 1 calibration tool.
 *
 * @remarks
 * Loads the mss-vocabulary SKILL.md as context, runs 20 natural language
 * descriptions through a model, and grades classification accuracy using
 * deterministic exact-match on all 5 MSS fields.
 *
 * Supports two backends via `--backend`:
 * - `anthropic` (default): Uses Claude Agent SDK with claude-haiku-4-5 (subscription-based)
 * - `falcon`: Uses local MLX server at FALCON_BASE_URL (OpenAI-compatible)
 *
 * Usage:
 * ```bash
 * bun scripts/mss-classify.ts                    # Run with Anthropic Haiku
 * bun scripts/mss-classify.ts --backend falcon   # Run with local Falcon
 * bun scripts/mss-classify.ts --filter health    # Run only health-domain prompts
 * bun scripts/mss-classify.ts --verbose          # Show per-prompt details
 * ```
 *
 * @packageDocumentation
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { grade } from './mss-grader.ts'

// ============================================================================
// Configuration
// ============================================================================

const SKILL_PATH = `${import.meta.dir}/../skills/mss-vocabulary/SKILL.md`
const PROMPTS_PATH = `${import.meta.dir}/../skills/mss-vocabulary/assets/mss-classify-prompts.jsonl`
const RESULTS_DIR = `${import.meta.dir}/../.memory/evals`

// Parse CLI args
const args = process.argv.slice(2)
const backendIdx = args.indexOf('--backend')
const backend = backendIdx !== -1 ? (args[backendIdx + 1] ?? 'anthropic') : 'anthropic'
const filterIdx = args.indexOf('--filter')
const filter = filterIdx !== -1 ? args[filterIdx + 1] : undefined
const verbose = args.includes('--verbose')

// API config
const FALCON_BASE_URL = process.env.FALCON_BASE_URL ?? 'http://localhost:8080'
const FALCON_MODEL = process.env.FALCON_MODEL ?? 'mlx-community/Falcon-H1R-7B-4bit'

// ============================================================================
// Types
// ============================================================================

type MssTags = {
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
    mss: MssTags
  }
}

type ClassifyResult = {
  id: string
  domain: string
  difficulty: string
  pass: boolean
  score: number
  reasoning: string
  expected: MssTags
  actual: string
  durationMs: number
}

// ============================================================================
// Load skill content
// ============================================================================

const loadSkillContent = async (): Promise<string> => {
  const skillFile = Bun.file(SKILL_PATH)
  if (!(await skillFile.exists())) {
    throw new Error(`SKILL.md not found at ${SKILL_PATH}`)
  }
  return skillFile.text()
}

// ============================================================================
// Load prompts
// ============================================================================

const loadPrompts = async (): Promise<PromptEntry[]> => {
  const file = Bun.file(PROMPTS_PATH)
  if (!(await file.exists())) {
    throw new Error(`Prompts file not found at ${PROMPTS_PATH}`)
  }
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
// Classification system prompt
// ============================================================================

const buildSystemPrompt = (
  skillContent: string,
): string => `You are an MSS (Modnet Structural Standard) composition engine. Given a description of a module being created, composed with existing modules, evolving its sharing model, or joining a network — output the correct MSS bridge-code tags.

MSS is a composition grammar, not a classification system. Each tag answers a question about how the module participates in networks. Read the vocabulary reference below carefully, then reason about the correct tags.

<mss-vocabulary>
${skillContent}
</mss-vocabulary>

RULES:
1. contentType defaults are listed in the vocabulary — use them unless the module clearly needs a different grouping
2. Use valid structure values for the appropriate scale level
3. mechanics is always an array (empty [] if no mechanics apply)
4. boundary must be one of: "all", "none", "ask", "paid"
5. scale must be a number 1-8
6. When existing module context is provided, reason about composition: same contentType auto-groups, different contentType prevents grouping, scale follows nesting rules

Your ENTIRE response must be a single JSON object with exactly these 5 fields. Do not write any explanation, reasoning, markdown fences, or other text before or after the JSON:
{"contentType":"...","structure":"...","mechanics":[...],"boundary":"...","scale":...}`

// ============================================================================
// API calls
// ============================================================================

const classifyAnthropic = async (
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
    if ('result' in message) {
      output = message.result
    }
  }

  return { output, durationMs: Date.now() - start }
}

const classifyFalcon = async (
  systemPrompt: string,
  description: string,
): Promise<{ output: string; durationMs: number }> => {
  const start = Date.now()
  const response = await fetch(`${FALCON_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: FALCON_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description },
      ],
      max_tokens: 256,
      temperature: 0.1,
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Falcon API error (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  const output = data.choices[0]?.message.content ?? ''
  return { output, durationMs: Date.now() - start }
}

const classify = backend === 'falcon' ? classifyFalcon : classifyAnthropic

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  console.log(`\n━━━ MSS Classification — Phase 1 Calibration ━━━`)

  console.log(`Backend: ${backend}`)

  const skillContent = await loadSkillContent()
  const prompts = await loadPrompts()

  console.log(`Prompts: ${prompts.length}${filter ? ` (filtered: ${filter})` : ''}`)

  console.log()

  const systemPrompt = buildSystemPrompt(skillContent)
  const results: ClassifyResult[] = []

  for (const prompt of prompts) {
    process.stdout.write(`  ${prompt.id.padEnd(25)}`)

    try {
      const { output, durationMs } = await classify(systemPrompt, prompt.input)

      const gradeResult = await grade({
        input: prompt.input,
        output,
        metadata: prompt.metadata,
      })

      const result: ClassifyResult = {
        id: prompt.id,
        domain: prompt.metadata.domain,
        difficulty: prompt.metadata.difficulty,
        pass: gradeResult.pass,
        score: gradeResult.score,
        reasoning: gradeResult.reasoning ?? '',
        expected: prompt.metadata.mss,
        actual: output.trim(),
        durationMs,
      }
      results.push(result)

      console.log(
        `${gradeResult.pass ? '✓' : '✗'} ${(gradeResult.score * 100).toFixed(0)}%  ${durationMs}ms${gradeResult.pass ? '' : `  — ${gradeResult.reasoning}`}`,
      )

      if (verbose && !gradeResult.pass) {
        console.log(`    expected: ${JSON.stringify(prompt.metadata.mss)}`)

        console.log(`    actual:   ${output.trim().slice(0, 200)}`)
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
        expected: prompt.metadata.mss,
        actual: '',
        durationMs: 0,
      })
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════

  const totalPass = results.filter((r) => r.pass).length
  const totalScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0)

  console.log(`\n━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  console.log(`  Pass rate:    ${totalPass}/${results.length} (${((totalPass / results.length) * 100).toFixed(1)}%)`)

  console.log(`  Avg score:    ${(totalScore * 100).toFixed(1)}% (per-field accuracy)`)

  console.log(`  Total time:   ${(totalDuration / 1000).toFixed(1)}s`)

  // By difficulty
  const byDifficulty = new Map<string, ClassifyResult[]>()
  for (const r of results) {
    const arr = byDifficulty.get(r.difficulty) ?? []
    arr.push(r)
    byDifficulty.set(r.difficulty, arr)
  }

  console.log(`\n  By difficulty:`)
  for (const [diff, items] of [...byDifficulty.entries()].sort()) {
    const passCount = items.filter((r) => r.pass).length

    console.log(
      `    ${diff.padEnd(8)} ${passCount}/${items.length} (${((passCount / items.length) * 100).toFixed(0)}%)`,
    )
  }

  // Misclassified prompts
  const failures = results.filter((r) => !r.pass)
  if (failures.length > 0) {
    console.log(`\n  Misclassified:`)
    for (const f of failures) {
      console.log(`    ${f.id}: ${f.reasoning}`)
    }
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  // ══════════════════════════════════════════════════════════════════════════
  // Persist results
  // ══════════════════════════════════════════════════════════════════════════

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultsPath = `${RESULTS_DIR}/mss-classify-${timestamp}.jsonl`

  // Ensure directory exists
  const dir = Bun.file(`${RESULTS_DIR}/.gitkeep`)
  if (!(await dir.exists())) {
    await Bun.$`mkdir -p ${RESULTS_DIR}`.quiet()
  }

  const lines = `${results.map((r) => JSON.stringify(r)).join('\n')}\n`
  await Bun.write(resultsPath, lines)

  console.log(`Results saved: ${resultsPath}`)

  // Exit with non-zero if not 100%
  if (totalPass < results.length) {
    process.exit(1)
  }
}

await main()
