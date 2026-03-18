/**
 * Layered boot — bounded autoresearch loop for the personal modnet agent.
 *
 * @remarks
 * Creates isolated git worktrees, lets an adapter attempt a focused
 * improvement task, then evaluates the result with deterministic gates:
 *
 * 1. Scope gate — only expected paths changed
 * 2. Type gate — `bun --bun tsc --noEmit`
 * 3. Test gate — `bun test src/ skills/ scripts/`
 * 4. Focus gate — diff is non-empty and bounded
 * 5. Optional semantic gate — Claude Sonnet judge on task + diff + check output
 *
 * This is intentionally closer to autoresearch than the old module-generation
 * evals: small tasks, bounded edits, real checks, no archive of stale prompt
 * families.
 */

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { assessTrainingCapture, type TrainingCaptureAssessment } from '../src/improve.ts'
import { grade as claudeJudge } from './claude-code-judge.ts'
import { adapt as claudeAdapt } from './claude-code-adapter.ts'
type AdapterName = 'claude'

type PromptCase = {
  id: string
  goal: string
  allowedPaths: string[]
  focus: string[]
}

type CheckResult = {
  passed: boolean
  notes: string
}

type TrialResult = {
  id: string
  adapter: AdapterName
  worktree: string
  output: string
  changedFiles: string[]
  diffStat: string
  patch: string
  captureAssessment: TrainingCaptureAssessment
  layers: {
    scope: CheckResult
    types: CheckResult
    tests: CheckResult
    focus: CheckResult
    semantic?: CheckResult & { score?: number }
  }
  passed: boolean
}

const PROJECT_ROOT = `${import.meta.dir}/..`
const PROMPTS_PATH = `${import.meta.dir}/assets/autoresearch-prompts.jsonl`
const RESULTS_DIR = `${PROJECT_ROOT}/.memory/evals`
const DEFAULT_ALLOWED_PREFIXES = ['scripts/', 'src/agent/', 'src/improve/', 'src/modnet/', 'src/a2a/', 'src/events/']

const args = process.argv.slice(2)

const getArg = (flag: string, fallback: string): string => {
  const index = args.indexOf(flag)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const adapterName = 'claude'
const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : undefined
const useJudge = !args.includes('--no-judge')

const loadPrompts = async (): Promise<PromptCase[]> => {
  const file = Bun.file(PROMPTS_PATH)
  if (!(await file.exists())) {
    throw new Error(`Prompt file not found: ${PROMPTS_PATH}`)
  }

  const entries = (await file.text())
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PromptCase)

  return filter ? entries.filter((entry) => entry.id === filter) : entries
}

const createWorktree = async (id: string): Promise<string> => {
  const safeId = id.replace(/[^a-z0-9-]/gi, '-')
  const base = (await Bun.$`mktemp -d ${join(tmpdir(), `plaited-${safeId}-XXXXXX`)}`.quiet()).text().trim()
  const target = join(base, 'repo')
  const add = await Bun.$`git worktree add --detach ${target} HEAD`.cwd(PROJECT_ROOT).nothrow().quiet()
  if (add.exitCode !== 0) {
    throw new Error(`git worktree add failed: ${add.stderr.toString().trim()}`)
  }
  return target
}

const removeWorktree = async (worktree: string) => {
  await Bun.$`git worktree remove --force ${worktree}`.cwd(PROJECT_ROOT).nothrow().quiet()
}

const selectAdapter = () => claudeAdapt

const getChangedFiles = async (cwd: string): Promise<string[]> => {
  const result = await Bun.$`git diff --name-only`.cwd(cwd).quiet()
  return result
    .text()
    .trim()
    .split('\n')
    .filter(Boolean)
}

const getDiffStat = async (cwd: string): Promise<string> => {
  const result = await Bun.$`git diff --stat`.cwd(cwd).quiet()
  return result.text().trim()
}

const getPatch = async (cwd: string): Promise<string> => {
  const result = await Bun.$`git diff -- src scripts`.cwd(cwd).quiet()
  return result.text()
}

const checkScope = (changedFiles: string[], allowedPaths: string[]): CheckResult => {
  if (changedFiles.length === 0) {
    return { passed: false, notes: 'No files changed' }
  }

  const allowed = allowedPaths.length > 0 ? allowedPaths : DEFAULT_ALLOWED_PREFIXES
  const invalid = changedFiles.filter((file) => !allowed.some((prefix) => file.startsWith(prefix)))
  if (invalid.length > 0) {
    return {
      passed: false,
      notes: `Out-of-scope files changed: ${invalid.join(', ')}`,
    }
  }

  return { passed: true, notes: `${changedFiles.length} in-scope file(s) changed` }
}

const checkTypes = async (cwd: string): Promise<CheckResult> => {
  const result = await Bun.$`bun --bun tsc --noEmit`.cwd(cwd).nothrow().quiet()
  if (result.exitCode !== 0) {
    const output = `${result.stdout.toString()}${result.stderr.toString()}`.trim().slice(0, 500)
    return { passed: false, notes: output || 'TypeScript failed' }
  }
  return { passed: true, notes: 'TypeScript passed' }
}

const checkTests = async (cwd: string): Promise<CheckResult> => {
  const result = await Bun.$`bun test src/ skills/ scripts/`.cwd(cwd).nothrow().quiet()
  if (result.exitCode !== 0) {
    const output = `${result.stdout.toString()}${result.stderr.toString()}`.trim().slice(0, 500)
    return { passed: false, notes: output || 'Tests failed' }
  }
  return { passed: true, notes: 'Tests passed' }
}

const checkFocus = (changedFiles: string[], prompt: PromptCase): CheckResult => {
  const hits = prompt.focus.filter((needle) => changedFiles.some((file) => file.includes(needle)))
  if (hits.length === 0) {
    return {
      passed: false,
      notes: `Diff missed focus areas: ${prompt.focus.join(', ')}`,
    }
  }
  return { passed: true, notes: `Touched focus areas: ${hits.join(', ')}` }
}

const runSingle = async (prompt: PromptCase): Promise<TrialResult> => {
  const worktree = await createWorktree(prompt.id)
  const adapter = selectAdapter()

  try {
    const taskPrompt = [
      `Goal: ${prompt.goal}`,
      `Allowed paths: ${prompt.allowedPaths.join(', ')}`,
      `Focus: ${prompt.focus.join(', ')}`,
      'Delete stale code instead of archiving it when removal is clearly safer.',
      'Do not widen the surface area.',
    ].join('\n')

    const adapterResult = await adapter({ prompt: taskPrompt, cwd: worktree })
    const changedFiles = await getChangedFiles(worktree)
    const diffStat = await getDiffStat(worktree)
    const patch = await getPatch(worktree)
    const captureAssessment = assessTrainingCapture({
      trial: {
        trajectory: adapterResult.trajectory,
        timedOut: adapterResult.timedOut,
        exitCode: adapterResult.exitCode,
      },
    })

    const scope = checkScope(changedFiles, prompt.allowedPaths)
    const types = scope.passed ? await checkTypes(worktree) : { passed: false, notes: 'Skipped: scope failed' }
    const tests = scope.passed && types.passed
      ? await checkTests(worktree)
      : { passed: false, notes: 'Skipped: earlier gate failed' }
    const focus = scope.passed ? checkFocus(changedFiles, prompt) : { passed: false, notes: 'Skipped: scope failed' }

    const result: TrialResult = {
      id: prompt.id,
      adapter: adapterName,
      worktree,
      output: adapterResult.output,
      changedFiles,
      diffStat,
      patch,
      captureAssessment,
      layers: { scope, types, tests, focus },
      passed: scope.passed && types.passed && tests.passed && focus.passed,
    }

    if (useJudge && result.passed) {
      const judge = await claudeJudge({
        input: prompt.goal,
        output: adapterResult.output,
        metadata: {
          changedFiles,
          diffStat,
          patch: patch.slice(0, 12000),
          checks: {
            scope: scope.notes,
            types: types.notes,
            tests: tests.notes,
            focus: focus.notes,
          },
        },
      })
      result.layers.semantic = {
        passed: judge.pass,
        notes: judge.reasoning ?? '',
        score: judge.score,
      }
      result.passed = result.passed && judge.pass
    }

    return result
  } finally {
    await removeWorktree(worktree)
  }
}

const main = async () => {
  const prompts = await loadPrompts()
  if (prompts.length === 0) {
    console.log('No prompts matched.')
    return
  }

  console.log(`\n━━━ Layered Boot — Agent Improvement Eval ━━━`)
  console.log(`adapter=${adapterName} judge=${useJudge} prompts=${prompts.length}`)

  const results: TrialResult[] = []
  for (const prompt of prompts) {
    process.stdout.write(`  ${prompt.id.padEnd(28)}`)
    const result = await runSingle(prompt)
    results.push(result)
    const failures = Object.entries(result.layers)
      .filter(([, layer]) => layer && !layer.passed)
      .map(([name]) => name)
    if (result.passed) {
      const captureLabel = result.captureAssessment.eligible
        ? `capture=${result.captureAssessment.richness}`
        : `capture=skip:${result.captureAssessment.reasons.join('+')}`
      console.log(`✓ ${result.changedFiles.length} file(s) changed ${captureLabel}`)
    } else {
      console.log(`✗ ${failures.join(', ') || 'unknown failure'}`)
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await Bun.$`mkdir -p ${RESULTS_DIR}`.quiet()
  const outPath = `${RESULTS_DIR}/layered-boot-${timestamp}.jsonl`
  await Bun.write(outPath, results.map((result) => JSON.stringify(result)).join('\n') + '\n')

  const passes = results.filter((result) => result.passed).length
  const captureEligible = results.filter((result) => result.captureAssessment.eligible).length
  console.log(`\nSummary: ${passes}/${results.length} passed`)
  console.log(`Training capture: ${captureEligible}/${results.length} usable traces`)
  console.log(`Results saved: ${outPath}`)

  if (passes !== results.length) process.exit(1)
}

await main()
