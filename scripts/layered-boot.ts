/**
 * Layered Boot eval — Phase 4 progressive gate verification.
 *
 * @remarks
 * Generates modnet modules via Claude Code adapter and validates them through
 * progressive deterministic gates (Layers 0–3) plus optional Gemini LLM judge
 * (Layer 4). Each layer's failure triggers targeted calibration:
 *
 * | Layer | Gate | Calibrate |
 * |-------|------|-----------|
 * | 0: MSS field presence | package.json has valid modnet field | modnet-node skill |
 * | 1: Schema validity | ModnetFieldSchema.safeParse passes | modnet-node skill |
 * | 2: TypeScript compile | tsc --noEmit in workspace | code patterns |
 * | 3: Required files | SKILL.md + data/ directory present | modnet-node skill |
 * | 4: Semantic quality | Gemini LLM-as-judge (Layer 4) | rubric |
 *
 * Usage:
 * ```bash
 * bun scripts/layered-boot.ts                   # Run all prompts, k=1
 * bun scripts/layered-boot.ts --k 3             # k=3 trials per prompt
 * bun scripts/layered-boot.ts --filter diet     # Run only matching prompts
 * bun scripts/layered-boot.ts --no-judge        # Skip Gemini Layer 4
 * bun scripts/layered-boot.ts --concurrency 4   # Parallel workers
 * ```
 *
 * @packageDocumentation
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ModnetFieldSchema } from '../src/modnet/modnet.schemas.ts'
import { grade as geminiGrade } from './gemini-judge.ts'
import { adapt as claudeAdapt } from './claude-code-adapter.ts'

// ============================================================================
// Configuration
// ============================================================================

const PROMPTS_PATH = `${import.meta.dir}/../skills/modnet-modules/assets/prompts.jsonl`
const RESULTS_DIR = `${import.meta.dir}/../.memory/evals`

const args = process.argv.slice(2)

const getArg = (flag: string, def: string): string => {
  const idx = args.indexOf(flag)
  return idx !== -1 ? (args[idx + 1] ?? def) : def
}

const k = parseInt(getArg('--k', '1'), 10)
const concurrency = parseInt(getArg('--concurrency', '2'), 10)
const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : undefined
const useJudge = !args.includes('--no-judge')
const verbose = args.includes('--verbose')

// ============================================================================
// Types
// ============================================================================

type EvalRef = {
  intention?: string[]
  static?: string[]
  dynamic?: string[]
}

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
  hint?: string
  metadata: {
    domain: string
    difficulty: string
    eval_ref: EvalRef
    mss: MssTags
  }
}

type LayerResult = {
  passed: boolean
  score: number
  notes: string
}

type TrialLayerResult = {
  trialNum: number
  workspace: string
  output: string
  durationMs: number
  exitCode?: number
  layers: {
    layer0_mss_present: LayerResult
    layer1_schema_valid: LayerResult
    layer2_tsc: LayerResult
    layer3_files: LayerResult
    layer4_semantic?: LayerResult
  }
  gatesPassed: number  // 0–4
  gateFailed?: string  // first failing gate name
}

type PromptResult = {
  id: string
  domain: string
  difficulty: string
  mss: MssTags
  trials: TrialLayerResult[]
  passRate: number  // fraction of trials passing all gates
  avgGatesPassed: number
}

// ============================================================================
// Load prompts
// ============================================================================

const loadPrompts = async (): Promise<PromptEntry[]> => {
  const file = Bun.file(PROMPTS_PATH)
  if (!(await file.exists())) throw new Error(`Prompts not found: ${PROMPTS_PATH}`)

  const text = await file.text()
  const entries: PromptEntry[] = []
  for (const line of text.trim().split('\n')) {
    if (!line.trim()) continue
    const entry = JSON.parse(line) as PromptEntry
    if (filter && entry.id !== filter && entry.metadata.domain !== filter) continue
    entries.push(entry)
  }
  return entries
}

// ============================================================================
// Layer gates
// ============================================================================

/**
 * Layer 0: Verify package.json exists and has a `modnet` field.
 */
const checkLayer0 = async (workspace: string): Promise<LayerResult & { modnet?: unknown }> => {
  const pkgPath = join(workspace, 'package.json')
  const pkgFile = Bun.file(pkgPath)
  if (!(await pkgFile.exists())) {
    return { passed: false, score: 0, notes: 'package.json not found' }
  }

  let pkg: Record<string, unknown>
  try {
    pkg = (await pkgFile.json()) as Record<string, unknown>
  } catch {
    return { passed: false, score: 0, notes: 'package.json is not valid JSON' }
  }

  if (!pkg.modnet) {
    return { passed: false, score: 0, notes: 'package.json missing "modnet" field' }
  }

  return { passed: true, score: 1, notes: 'package.json has modnet field', modnet: pkg.modnet }
}

/**
 * Layer 1: Validate `modnet` field against ModnetFieldSchema.
 */
const checkLayer1 = (modnet: unknown): LayerResult => {
  const result = ModnetFieldSchema.safeParse(modnet)
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    return { passed: false, score: 0, notes: `ModnetFieldSchema invalid: ${errors}` }
  }
  return { passed: true, score: 1, notes: 'ModnetFieldSchema valid' }
}

/**
 * Layer 2: Run `bun --bun tsc --noEmit --skipLibCheck` in the workspace.
 *
 * @remarks
 * `--skipLibCheck` avoids false failures from missing @types packages.
 * The eval expects TypeScript source to compile, not that all deps are installed.
 */
const checkLayer2 = async (workspace: string): Promise<LayerResult> => {
  // Check if there are any .ts files to compile
  const check = await Bun.$`find ${workspace} -name "*.ts" -not -path "*/node_modules/*" -not -name "*.spec.ts"`
    .cwd(workspace)
    .nothrow()
    .quiet()

  const tsFiles = check.stdout.toString().trim()
  if (!tsFiles) {
    return { passed: false, score: 0, notes: 'No TypeScript files found in workspace' }
  }

  // Run tsc if tsconfig.json exists; otherwise use basic type check
  const tsconfigFile = Bun.file(join(workspace, 'tsconfig.json'))
  const hasTsconfig = await tsconfigFile.exists()

  let tscResult: { exitCode: number; stderr: string }

  if (hasTsconfig) {
    const result = await Bun.$`bun --bun tsc --noEmit --skipLibCheck`
      .cwd(workspace)
      .nothrow()
      .quiet()
    tscResult = { exitCode: result.exitCode, stderr: result.stderr.toString() }
  } else {
    // No tsconfig — check with a minimal config
    const result = await Bun.$`bun --bun tsc --noEmit --skipLibCheck --target ESNext --moduleResolution bundler --strict --allowImportingTsExtensions ${tsFiles.split('\n').join(' ')}`
      .cwd(workspace)
      .nothrow()
      .quiet()
    tscResult = { exitCode: result.exitCode, stderr: result.stderr.toString() }
  }

  if (tscResult.exitCode !== 0) {
    const errors = tscResult.stderr.slice(0, 400)
    return { passed: false, score: 0, notes: `tsc errors: ${errors}` }
  }

  return { passed: true, score: 1, notes: 'TypeScript compiles without errors' }
}

/**
 * Layer 3: Verify required module files are present.
 *
 * @remarks
 * Checks for: skills/[name]/SKILL.md (seed skill) and data/ directory.
 */
const checkLayer3 = async (workspace: string): Promise<LayerResult> => {
  const issues: string[] = []

  // Check for a SKILL.md somewhere under skills/
  const skillCheck = await Bun.$`find ${workspace}/skills -name "SKILL.md" -maxdepth 3`
    .cwd(workspace)
    .nothrow()
    .quiet()

  if (!skillCheck.stdout.toString().trim()) {
    issues.push('skills/*/SKILL.md not found')
  }

  // Check for data/ directory
  const dataDir = Bun.file(join(workspace, 'data', '.gitkeep'))
  const dataCheck = await Bun.$`test -d ${workspace}/data`.nothrow().quiet()
  if (dataCheck.exitCode !== 0) {
    // data/ directory missing is a soft failure — note it but don't fail hard
    issues.push('data/ directory not present')
  }

  // Check for at least one .ts source file (not spec)
  const tsCheck = await Bun.$`find ${workspace} -name "*.ts" -not -path "*/node_modules/*" -not -name "*.spec.ts" -maxdepth 3`
    .cwd(workspace)
    .nothrow()
    .quiet()

  if (!tsCheck.stdout.toString().trim()) {
    issues.push('no TypeScript source files found')
  }

  if (issues.length > 0) {
    const isFatal = issues.some((i) => i.includes('SKILL.md') || i.includes('TypeScript'))
    return {
      passed: !isFatal,
      score: isFatal ? 0 : 0.5,
      notes: issues.join('; '),
    }
  }

  return { passed: true, score: 1, notes: 'All required files present' }
}

// ============================================================================
// Run a single trial
// ============================================================================

const runSingleTrial = async (
  prompt: PromptEntry,
  trialNum: number,
  workspaceBase: string,
  judgeEnabled: boolean,
): Promise<TrialLayerResult> => {
  // Create isolated workspace
  const workspace = await mkdtemp(join(workspaceBase, `trial-`))
  const start = Date.now()

  try {
    // Generate module via Claude Code adapter
    const adapterResult = await claudeAdapt({ prompt: prompt.input, cwd: workspace })
    const durationMs = Date.now() - start

    // Layer 0: MSS field presence
    const l0 = await checkLayer0(workspace)
    if (!l0.passed) {
      return {
        trialNum,
        workspace,
        output: adapterResult.output,
        durationMs,
        exitCode: adapterResult.exitCode ?? undefined,
        layers: {
          layer0_mss_present: { passed: false, score: 0, notes: l0.notes },
          layer1_schema_valid: { passed: false, score: 0, notes: 'skipped (layer 0 failed)' },
          layer2_tsc: { passed: false, score: 0, notes: 'skipped (layer 0 failed)' },
          layer3_files: { passed: false, score: 0, notes: 'skipped (layer 0 failed)' },
        },
        gatesPassed: 0,
        gateFailed: 'layer0_mss_present',
      }
    }

    // Layer 1: Schema validity
    const l1 = checkLayer1(l0.modnet)
    if (!l1.passed) {
      return {
        trialNum,
        workspace,
        output: adapterResult.output,
        durationMs,
        exitCode: adapterResult.exitCode ?? undefined,
        layers: {
          layer0_mss_present: { passed: true, score: 1, notes: l0.notes },
          layer1_schema_valid: l1,
          layer2_tsc: { passed: false, score: 0, notes: 'skipped (layer 1 failed)' },
          layer3_files: { passed: false, score: 0, notes: 'skipped (layer 1 failed)' },
        },
        gatesPassed: 1,
        gateFailed: 'layer1_schema_valid',
      }
    }

    // Layer 2: TypeScript compile
    const l2 = await checkLayer2(workspace)

    // Layer 3: Required files
    const l3 = await checkLayer3(workspace)

    const layers: TrialLayerResult['layers'] = {
      layer0_mss_present: { passed: true, score: 1, notes: l0.notes },
      layer1_schema_valid: l1,
      layer2_tsc: l2,
      layer3_files: l3,
    }

    let gatesPassed = [l0, l1, l2, l3].filter((l) => l.passed).length
    const gateFailed = !l2.passed ? 'layer2_tsc' : !l3.passed ? 'layer3_files' : undefined

    // Layer 4: Gemini judge (only if all deterministic layers pass)
    if (judgeEnabled && l2.passed && l3.passed) {
      const judgeResult = await geminiGrade({
        input: prompt.input,
        output: adapterResult.output,
        metadata: { eval_ref: prompt.metadata.eval_ref },
      })

      layers.layer4_semantic = {
        passed: judgeResult.pass,
        score: judgeResult.score,
        notes: judgeResult.reasoning ?? '',
      }

      if (judgeResult.pass) gatesPassed++
    }

    return {
      trialNum,
      workspace,
      output: adapterResult.output,
      durationMs,
      exitCode: adapterResult.exitCode ?? undefined,
      layers,
      gatesPassed,
      gateFailed,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      trialNum,
      workspace,
      output: '',
      durationMs: Date.now() - start,
      layers: {
        layer0_mss_present: { passed: false, score: 0, notes: `Error: ${msg}` },
        layer1_schema_valid: { passed: false, score: 0, notes: 'skipped' },
        layer2_tsc: { passed: false, score: 0, notes: 'skipped' },
        layer3_files: { passed: false, score: 0, notes: 'skipped' },
      },
      gatesPassed: 0,
      gateFailed: 'layer0_mss_present',
    }
  }
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  console.log(`\n━━━ Layered Boot Eval — Phase 4 ━━━`)
  console.log(`k=${k}  concurrency=${concurrency}  judge=${useJudge}${filter ? `  filter=${filter}` : ''}`)

  const prompts = await loadPrompts()
  console.log(`Prompts: ${prompts.length}\n`)

  if (prompts.length === 0) {
    console.log('No prompts matched. Exiting.')
    process.exit(0)
  }

  const workspaceBase = await mkdtemp(join(tmpdir(), 'layered-boot-'))
  const results: PromptResult[] = []

  // Semaphore for concurrency limiting
  let running = 0
  const queue: Array<() => Promise<void>> = []

  const runNext = async () => {
    if (queue.length === 0) return
    const task = queue.shift()!
    running++
    await task()
    running--
    if (queue.length > 0) runNext()
  }

  const enqueue = (fn: () => Promise<void>): Promise<void> => {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try { await fn(); resolve() } catch (e) { reject(e) }
      })
    })
  }

  for (const prompt of prompts) {
    process.stdout.write(`  ${prompt.id.padEnd(30)}`)

    const trials: TrialLayerResult[] = []

    for (let t = 1; t <= k; t++) {
      const trial = await runSingleTrial(prompt, t, workspaceBase, useJudge)
      trials.push(trial)
    }

    const allGatesPassed = trials.every((t) => t.gatesPassed >= (useJudge ? 4 : 3) && !t.gateFailed)
    const passRate = trials.filter((t) => !t.gateFailed && t.gatesPassed >= (useJudge ? 4 : 3)).length / k
    const avgGates = trials.reduce((sum, t) => sum + t.gatesPassed, 0) / k

    const result: PromptResult = {
      id: prompt.id,
      domain: prompt.metadata.domain,
      difficulty: prompt.metadata.difficulty,
      mss: prompt.metadata.mss,
      trials,
      passRate,
      avgGatesPassed: avgGates,
    }
    results.push(result)

    const statusChar = passRate === 1 ? '✓' : passRate > 0 ? '~' : '✗'
    const firstFailure = trials[0]?.gateFailed ?? ''
    console.log(
      `${statusChar} ${(avgGates).toFixed(1)}/4 gates  pass=${(passRate * 100).toFixed(0)}%${firstFailure ? `  fail=${firstFailure}` : ''}`,
    )

    if (verbose && trials[0]?.gateFailed) {
      const t = trials[0]
      const failedLayer = t.layers[t.gateFailed as keyof typeof t.layers]
      console.log(`    └─ ${failedLayer?.notes}`)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════

  const fullPass = results.filter((r) => r.passRate === 1).length
  const avgGates = results.reduce((sum, r) => sum + r.avgGatesPassed, 0) / results.length

  console.log(`\n━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Full pass:    ${fullPass}/${results.length} (${((fullPass / results.length) * 100).toFixed(1)}%)`)
  console.log(`  Avg gates:    ${avgGates.toFixed(2)}/4 passed`)

  // Gate failure analysis
  const failByGate: Record<string, number> = {}
  for (const r of results) {
    for (const trial of r.trials) {
      if (trial.gateFailed) {
        failByGate[trial.gateFailed] = (failByGate[trial.gateFailed] ?? 0) + 1
      }
    }
  }

  if (Object.keys(failByGate).length > 0) {
    console.log(`\n  Gate failures:`)
    for (const [gate, count] of Object.entries(failByGate).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${gate.padEnd(30)} ${count} trial(s)`)
    }
  }

  // By domain
  const byDomain = new Map<string, PromptResult[]>()
  for (const r of results) {
    const arr = byDomain.get(r.domain) ?? []
    arr.push(r)
    byDomain.set(r.domain, arr)
  }

  console.log(`\n  By domain:`)
  for (const [domain, items] of [...byDomain.entries()].sort()) {
    const domainPass = items.filter((r) => r.passRate === 1).length
    console.log(`    ${domain.padEnd(20)} ${domainPass}/${items.length} (${((domainPass / items.length) * 100).toFixed(0)}%)`)
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  // ══════════════════════════════════════════════════════════════════════════
  // Persist results
  // ══════════════════════════════════════════════════════════════════════════

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultsPath = `${RESULTS_DIR}/layered-boot-${timestamp}.jsonl`

  await Bun.$`mkdir -p ${RESULTS_DIR}`.quiet()
  await Bun.write(resultsPath, results.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(`Results saved: ${resultsPath}`)

  // Cleanup workspaces
  try { await rm(workspaceBase, { recursive: true, force: true }) } catch {}

  if (fullPass < results.length) process.exit(1)
}

await main()
