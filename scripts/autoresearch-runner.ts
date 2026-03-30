#!/usr/bin/env bun

import { isAbsolute, join, resolve } from 'node:path'
import { $ } from 'bun'
import type { AttemptPromotionDecision, Grader, GraderResult, Verifier } from '../src/improve.ts'
import {
  AttemptPromotionDecisionSchema,
  buildAttemptPromotionPrompt,
  loadGrader,
  loadVerifier,
} from '../src/improve.ts'
import { runStructuredLlmQuery } from './structured-llm-query.ts'

export type ResearchLaneConfig = {
  key: string
  scriptPath: string
  programPath: string
  validateCommand: string[]
  writableRoots: string[]
  readRoots?: string[]
  skills?: string[]
  optionalSkillsByTag?: Record<string, string[]>
  model?: string
  systemPrompt?: string
  taskPrompt: string
  defaultAttempts: number
  defaultParallelism: number
  strategyNotes?: string[]
  evaluation?: {
    graderPath: string
    verifierPath?: string
    useMetaVerification?: boolean
    hint?: string
  }
}

type AttemptStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped'

type AttemptStatusRecord = {
  attempt: number
  strategy: string
  worktreePath: string
  status: AttemptStatus
  startedAt?: string
  finishedAt?: string
  pid?: number
  piExitCode?: number
  validateExitCode?: number
  attemptCommit?: string
  error?: string
}

type RunManifest = {
  lane: string
  laneScriptPath: string
  createdAt: string
  attempts: number
  parallelism: number
  runDir: string
}

type AttemptResultRecord = {
  attempt: number
  strategy: string
  retryCount: number
  piExitCode: number
  validateExitCode: number
  diffStat: string
  patch?: string
  changedPaths: string[]
  disallowedPaths: string[]
  worktreePath: string
  attemptCommit?: string
}

type AttemptEvaluationRecord = {
  attempt: number
  pass: boolean
  score: number
  reasoning?: string
  outcome?: Record<string, unknown>
  dimensions?: Record<string, unknown>
}

type EvaluationSummary = {
  graderPath: string
  verifierPath?: string
  evaluatedAttempts: number
  passedAttempts: number
  averageScore: number
  bestAttempt?: number
}

type PromotionSummary = {
  model: string
  action: 'promote_one' | 'manual_review' | 'reject_all'
  selectedAttempt?: number
  selectedCommit?: string
  confidence: number
  reasoning: string
}

const isValidEvaluationRecord = (
  value: AttemptEvaluationRecord | null | undefined,
): value is AttemptEvaluationRecord & { pass: boolean; score: number } =>
  value != null && typeof value.pass === 'boolean' && typeof value.score === 'number' && Number.isFinite(value.score)

export const MAX_ATTEMPT_RETRIES = 2
export const PI_WORKTREE_GUARD_EXTENSION_PATH = 'scripts/pi-worktree-guard-extension.ts'
export const EVALUATION_STAGE_TIMEOUT_MS = 120_000
const MAX_EVALUATION_PROGRAM_CHARS = 12_000
const MAX_EVALUATION_FILE_CHARS = 6_000
const MAX_EVALUATION_CONTEXT_FILES = 6
const MAX_EVALUATION_SKILL_CHARS = 4_000
const RESEARCH_SKILL_TAGS_ENV = 'PLAITED_RESEARCH_SKILL_TAGS'

const logProgress = (message: string, details?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString()
  if (details) {
    console.log(`[autoresearch ${timestamp}] ${message} ${JSON.stringify(details)}`)
    return
  }
  console.log(`[autoresearch ${timestamp}] ${message}`)
}

const pathExists = async (path: string): Promise<boolean> => {
  const result = await $`test -e ${path}`.quiet().nothrow()
  return result.exitCode === 0
}

export const normalizeScriptPath = (path: string) => {
  const normalized = path.replaceAll('\\', '/')
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

export const resolveWorkspaceRoot = async ({ cwd = process.cwd() }: { cwd?: string } = {}) => {
  const override = process.env.PLAITED_WORKSPACE_ROOT?.trim()
  if (override) {
    return override
  }

  const gitTopLevel = await $`git rev-parse --show-toplevel`.cwd(cwd).quiet().nothrow()
  if (gitTopLevel.exitCode === 0) {
    const root = (await gitTopLevel.text()).trim()
    if (root.length > 0) {
      return root
    }
  }

  return cwd
}

const resolveWorkspacePath = ({ workspaceRoot, path }: { workspaceRoot: string; path: string }) =>
  isAbsolute(path) ? path : join(workspaceRoot, path)

const parseSkillTags = (value: string | undefined) =>
  (value ?? '')
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean)

export const resolveLaneSkills = (config: ResearchLaneConfig): string[] => {
  const resolved = new Set(config.skills ?? [])
  const enabledTags = parseSkillTags(process.env[RESEARCH_SKILL_TAGS_ENV])

  for (const tag of enabledTags) {
    for (const skill of config.optionalSkillsByTag?.[tag] ?? []) {
      resolved.add(skill)
    }
  }

  return [...resolved]
}

export const buildStrategyNotes = (attempts: number): string[] => {
  const base = [
    'minimal-diff-first: prefer the smallest coherent edit set that improves the lane contract.',
    'coverage-first: close the most obvious gaps in the lane output before broadening scope.',
    'validation-first: strengthen deterministically checkable outcomes before speculative expansion.',
    'structure-first: improve artifact organization and internal coherence before adding breadth.',
    'boundary-first: stay within the lane writable roots and avoid support-surface drift.',
    'traceability-first: preserve clear links between inputs, outputs, and validation evidence.',
    'reviewability-first: favor changes that are easy to inspect, compare, and promote.',
    'cleanup-first: remove stale or redundant lane output before introducing new complexity.',
  ]

  return Array.from({ length: attempts }, (_, index) => base[index % base.length]!)
}

export const getLaneConfig = async (scriptPath: string): Promise<ResearchLaneConfig> => {
  const normalizedScriptPath = normalizeScriptPath(scriptPath)
  if (!(await pathExists(normalizedScriptPath))) {
    throw new Error(`Missing lane script: ${normalizedScriptPath}`)
  }

  const imported = (await import(resolve(normalizedScriptPath))) as {
    RESEARCH_LANE_CONFIG?: ResearchLaneConfig
  }
  const config = imported.RESEARCH_LANE_CONFIG

  if (!config) {
    throw new Error(`Lane script does not export RESEARCH_LANE_CONFIG: ${normalizedScriptPath}`)
  }

  return config
}

export const parseRunArgs = async (args: string[]) => {
  const laneScriptPath = args[0]
  const command = (args[1] ?? 'run') as 'run' | 'status' | 'evaluate'
  const defaults = laneScriptPath ? await getLaneConfig(laneScriptPath).catch(() => null) : null
  let attempts = defaults?.defaultAttempts ?? 20
  let parallelism = defaults?.defaultParallelism ?? 3
  let runDir: string | null = null

  for (let i = 2; i < args.length; i += 1) {
    const arg = args[i]
    const next = args[i + 1]
    if ((arg === '--attempts' || arg === '--budget') && next) {
      attempts = Number(next)
      i += 1
      continue
    }
    if ((arg === '--parallel' || arg === '--concurrency') && next) {
      parallelism = Number(next)
      i += 1
      continue
    }
    if (arg === '--run-dir' && next) {
      runDir = next
      i += 1
    }
  }

  return { laneScriptPath, command, attempts, parallelism, runDir }
}

const formatTimestamp = () => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
export const buildRunDir = ({ workspaceRoot, lane }: { workspaceRoot: string; lane: string }) =>
  join(workspaceRoot, '.prompts', 'autoresearch-runner', lane, formatTimestamp())
const runAttemptDir = (runDir: string, attempt: number) =>
  join(runDir, `attempt-${attempt.toString().padStart(2, '0')}`)
const attemptStatusPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'status.json')
const attemptResultPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'result.json')
const attemptStdoutPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'stdout.log')
const attemptStderrPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'stderr.log')
const attemptWorktreePath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'repo')
const attemptPiStatePath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), '.pi-agent')
const attemptEvaluationPath = (runDir: string, attempt: number) =>
  join(runAttemptDir(runDir, attempt), 'evaluation.json')
const attemptEvaluationStatusPath = (runDir: string, attempt: number) =>
  join(runAttemptDir(runDir, attempt), 'evaluation.status.json')
const attemptEvaluationErrorPath = (runDir: string, attempt: number) =>
  join(runAttemptDir(runDir, attempt), 'evaluation.error.json')
const evaluationSummaryPath = (runDir: string) => join(runDir, 'evaluation-summary.json')
const promotionSummaryPath = (runDir: string) => join(runDir, 'promotion-summary.json')

const ensureDir = async (path: string) => {
  await $`mkdir -p ${path}`.quiet()
}

const writeJson = async (path: string, value: unknown) => {
  await ensureDir(join(path, '..'))
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`)
}

const runCommand = async ({
  cmd,
  cwd,
  stdoutPath,
  stderrPath,
  env,
}: {
  cmd: string[]
  cwd: string
  stdoutPath: string
  stderrPath: string
  env?: Record<string, string>
}) => {
  const proc = Bun.spawn({
    cmd,
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdoutText = proc.stdout ? await new Response(proc.stdout).text() : ''
  const stderrText = proc.stderr ? await new Response(proc.stderr).text() : ''

  await Promise.all([Bun.write(stdoutPath, stdoutText), Bun.write(stderrPath, stderrText)])

  const exitCode = await proc.exited
  return { proc, exitCode }
}

const writeAttemptStatus = async (runDir: string, attempt: number, status: AttemptStatusRecord) => {
  await writeJson(attemptStatusPath(runDir, attempt), status)
}

const createWorktree = async ({
  workspaceRoot,
  runDir,
  attempt,
}: {
  workspaceRoot: string
  runDir: string
  attempt: number
}) => {
  const worktreePath = attemptWorktreePath(runDir, attempt)
  await ensureDir(runAttemptDir(runDir, attempt))
  await $`git worktree add --detach ${worktreePath} HEAD`.cwd(workspaceRoot).quiet()
  return worktreePath
}

const buildSystemPrompt = async ({ config, workspaceRoot }: { config: ResearchLaneConfig; workspaceRoot: string }) => {
  const programText = (await Bun.file(resolveWorkspacePath({ workspaceRoot, path: config.programPath })).text()).trim()
  const laneSystemPrompt = config.systemPrompt?.trim()
  const writableRoots = config.writableRoots.map((path) => `- ${path}`).join('\n')
  return `${laneSystemPrompt ? `${laneSystemPrompt}\n\n` : ''}${programText}

Execution contract:
- Work only within the selected lane surfaces.
- Keep the main repo untouched during attempts; treat promotion as a separate step.
- Prefer deterministic, reviewable edits over broad speculative rewrites.
- Run the lane validator before finishing.

Writable roots:
${writableRoots}`
}

export const buildPiCommand = async ({
  config,
  strategy,
  repoRoot,
  workspaceRoot,
}: {
  config: ResearchLaneConfig
  strategy: string
  repoRoot: string
  workspaceRoot: string
}) => {
  const systemPrompt = await buildSystemPrompt({ config, workspaceRoot })
  const cmd = [
    'bunx',
    'varlock',
    'run',
    '--path',
    repoRoot,
    '--',
    'bunx',
    'pi',
    '--model',
    config.model ?? 'openrouter/minimax/minimax-m2.7',
    '--no-skills',
    '--extension',
    resolveWorkspacePath({ workspaceRoot: repoRoot, path: PI_WORKTREE_GUARD_EXTENSION_PATH }),
  ]

  for (const skill of resolveLaneSkills(config)) {
    cmd.push('--skill', resolveWorkspacePath({ workspaceRoot: repoRoot, path: skill }))
  }

  cmd.push(
    '--append-system-prompt',
    systemPrompt,
    '-p',
    `${config.taskPrompt}

Attempt strategy:
${strategy}`,
  )

  return cmd
}

export const summarizeDiff = async (worktreePath: string) => {
  const diff = await $`git diff --stat`.cwd(worktreePath).quiet().nothrow()
  const untracked = await $`git ls-files --others --exclude-standard`.cwd(worktreePath).quiet().nothrow()
  const trackedSummary = (await diff.text()).trim()
  const untrackedPaths = (await untracked.text())
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (trackedSummary.length > 0 && untrackedPaths.length === 0) {
    return trackedSummary
  }

  if (trackedSummary.length === 0 && untrackedPaths.length === 0) {
    return ''
  }

  const lines = []
  if (trackedSummary.length > 0) {
    lines.push(trackedSummary)
  }
  if (untrackedPaths.length > 0) {
    lines.push(`untracked files:\n${untrackedPaths.map((path) => `- ${path}`).join('\n')}`)
  }

  return lines.join('\n\n')
}

const readPatch = async ({ worktreePath, attemptCommit }: { worktreePath: string; attemptCommit?: string }) => {
  if (attemptCommit) {
    const shown = await $`git show --format=medium --stat --patch ${attemptCommit}`.cwd(worktreePath).quiet().nothrow()
    return (await shown.text()).trim()
  }

  const diff = await $`git diff --stat --patch`.cwd(worktreePath).quiet().nothrow()
  return (await diff.text()).trim()
}

export const commitAttempt = async ({
  worktreePath,
  laneKey,
  attempt,
}: {
  worktreePath: string
  laneKey: string
  attempt: number
}) => {
  const addResult = await $`git add -A`.cwd(worktreePath).quiet().nothrow()
  if (addResult.exitCode !== 0) {
    throw new Error(`git add failed with exit code ${addResult.exitCode}`)
  }

  const message = `chore(research): capture ${laneKey} attempt ${attempt.toString().padStart(2, '0')}`
  const commitResult = await $`git commit -m ${message}`.cwd(worktreePath).quiet().nothrow()
  if (commitResult.exitCode !== 0) {
    throw new Error(`git commit failed with exit code ${commitResult.exitCode}`)
  }

  const revParse = await $`git rev-parse HEAD`.cwd(worktreePath).quiet().nothrow()
  if (revParse.exitCode !== 0) {
    throw new Error(`git rev-parse failed with exit code ${revParse.exitCode}`)
  }

  return (await revParse.text()).trim()
}

export const normalizeRepoPath = (path: string) =>
  path
    .replaceAll('\\', '/')
    .replace(/^\.\/+/u, '')
    .replace(/\/+$/u, '')

export const isAllowedPath = ({ path, writableRoots }: { path: string; writableRoots: string[] }) => {
  const normalizedPath = normalizeRepoPath(path)
  return writableRoots.some((root) => {
    const normalizedRoot = normalizeRepoPath(root)
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
  })
}

export const buildScopeViolationMessage = ({
  disallowedPaths,
  writableRoots,
}: {
  disallowedPaths: string[]
  writableRoots: string[]
}) => `Your previous attempt modified files outside the allowed lane surface.

Disallowed paths:
${disallowedPaths.map((path) => `- ${path}`).join('\n')}

Allowed writable roots:
${writableRoots.map((path) => `- ${path}`).join('\n')}

Retry with a narrower edit set. Only modify files inside the allowed writable roots.`

export const readChangedPaths = async (worktreePath: string) => {
  const diff = await $`git diff --name-only`.cwd(worktreePath).quiet().nothrow()
  const untracked = await $`git ls-files --others --exclude-standard`.cwd(worktreePath).quiet().nothrow()

  return [...(await diff.text()).split('\n'), ...(await untracked.text()).split('\n')]
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path, index, paths) => paths.indexOf(path) === index)
}

const readAttemptStatuses = async (runDir: string, attempts: number) => {
  const rows: AttemptStatusRecord[] = []
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const file = Bun.file(attemptStatusPath(runDir, attempt))
    if (await file.exists()) {
      rows.push((await file.json()) as AttemptStatusRecord)
    }
  }
  return rows
}

const readAttemptResult = async (runDir: string, attempt: number): Promise<AttemptResultRecord | null> => {
  const file = Bun.file(attemptResultPath(runDir, attempt))
  if (!(await file.exists())) {
    return null
  }

  return (await file.json()) as AttemptResultRecord
}

const readAttemptEvaluation = async (runDir: string, attempt: number): Promise<AttemptEvaluationRecord | null> => {
  const file = Bun.file(attemptEvaluationPath(runDir, attempt))
  if (!(await file.exists())) {
    return null
  }

  return (await file.json()) as AttemptEvaluationRecord
}

const readContextText = async ({
  worktreePath,
  path,
  maxChars,
}: {
  worktreePath: string
  path: string
  maxChars: number
}) => {
  const file = Bun.file(resolveWorkspacePath({ workspaceRoot: worktreePath, path }))
  if (!(await file.exists())) {
    return null
  }

  try {
    const text = await file.text()
    if (text.length <= maxChars) {
      return text
    }
    return `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars]`
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return `[unreadable file: ${reason}]`
  }
}

const extractSkillDescription = (text: string) => {
  const withoutFrontmatter = text.startsWith('---') ? text.replace(/^---[\s\S]*?---\s*/u, '') : text
  const lines = withoutFrontmatter
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
  return (lines[0] ?? 'No description available.').slice(0, 240)
}

const buildEvaluationInput = async ({
  config,
  status,
  result,
  stdout,
  patch,
}: {
  config: ResearchLaneConfig
  status: AttemptStatusRecord
  result: AttemptResultRecord
  stdout: string
  patch: string
}) => {
  const programText =
    (await readContextText({
      worktreePath: status.worktreePath,
      path: config.programPath,
      maxChars: MAX_EVALUATION_PROGRAM_CHARS,
    })) ?? ''
  const contextFiles = await Promise.all(
    result.changedPaths.slice(0, MAX_EVALUATION_CONTEXT_FILES).map(async (path) => ({
      path,
      content:
        (await readContextText({
          worktreePath: status.worktreePath,
          path,
          maxChars: MAX_EVALUATION_FILE_CHARS,
        })) ?? '[missing file]',
    })),
  )
  const skillCatalog = await Promise.all(
    resolveLaneSkills(config).map(async (skillPath) => {
      const skillText =
        (await readContextText({
          worktreePath: status.worktreePath,
          path: join(skillPath, 'SKILL.md'),
          maxChars: MAX_EVALUATION_SKILL_CHARS,
        })) ?? ''
      return {
        path: skillPath,
        description: extractSkillDescription(skillText),
      }
    }),
  )

  return {
    input: `${config.taskPrompt}\n\nAttempt strategy:\n${status.strategy}`,
    output: stdout,
    hint:
      config.evaluation?.hint ??
      `Evaluate this autoresearch attempt for lane ${config.key}. Reward valid, bounded, reviewable lane-local improvements.`,
    metadata: {
      lane: config.key,
      attempt: status.attempt,
      changedPaths: result.changedPaths,
      diffStat: result.diffStat || patch,
      retryCount: result.retryCount,
      piExitCode: result.piExitCode,
      validateExitCode: result.validateExitCode,
      cwd: status.worktreePath,
      patch,
      programText,
      contextFiles,
      skillCatalog,
    },
    cwd: status.worktreePath,
    patch,
  }
}

const toEvaluationRecord = (attempt: number, result: GraderResult): AttemptEvaluationRecord => ({
  attempt,
  pass: result.pass,
  score: result.score,
  ...(result.reasoning ? { reasoning: result.reasoning } : {}),
  ...(result.outcome ? { outcome: result.outcome } : {}),
  ...(result.dimensions ? { dimensions: result.dimensions } : {}),
})

const withTimeout = async <T>({
  promise,
  timeoutMs,
  phase,
  attempt,
}: {
  promise: Promise<T>
  timeoutMs: number
  phase: string
  attempt: number
}) =>
  await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Evaluation ${phase} timed out for attempt ${attempt} after ${timeoutMs}ms`))
      }, timeoutMs)
      void timer
    }),
  ])

const evaluateAttempts = async ({
  runDir,
  attempts,
  config,
}: {
  runDir: string
  attempts: number
  config: ResearchLaneConfig
}): Promise<EvaluationSummary | null> => {
  const evaluationConfig = config.evaluation
  if (!evaluationConfig?.graderPath) {
    return null
  }

  const grader: Grader = await loadGrader(evaluationConfig.graderPath)
  const verifier: Verifier | null =
    evaluationConfig.useMetaVerification && evaluationConfig.verifierPath
      ? await loadVerifier(evaluationConfig.verifierPath)
      : null

  const statuses = await readAttemptStatuses(runDir, attempts)
  const completedStatuses = statuses.filter((status) => status.status === 'completed')
  const evaluations: AttemptEvaluationRecord[] = []

  for (const status of completedStatuses) {
    const existing = await readAttemptEvaluation(runDir, status.attempt)
    if (isValidEvaluationRecord(existing)) {
      logProgress('evaluation reused', {
        lane: config.key,
        attempt: status.attempt,
        score: existing.score,
        pass: existing.pass,
      })
      evaluations.push(existing)
      continue
    }

    const result = await readAttemptResult(runDir, status.attempt)
    if (!result) continue

    const stdoutFile = Bun.file(attemptStdoutPath(runDir, status.attempt))
    const stdout = (await stdoutFile.exists()) ? await stdoutFile.text() : ''
    const patch =
      result.patch ?? (await readPatch({ worktreePath: status.worktreePath, attemptCommit: result.attemptCommit }))

    try {
      logProgress('evaluation start', {
        lane: config.key,
        attempt: status.attempt,
      })
      await writeJson(attemptEvaluationStatusPath(runDir, status.attempt), {
        attempt: status.attempt,
        phase: 'judge',
        startedAt: new Date().toISOString(),
      })

      let graded = await withTimeout({
        promise: buildEvaluationInput({ config, status, result, stdout, patch }).then((input) => grader(input)),
        timeoutMs: EVALUATION_STAGE_TIMEOUT_MS,
        phase: 'judge',
        attempt: status.attempt,
      })

      if (typeof graded.pass !== 'boolean' || typeof graded.score !== 'number' || !Number.isFinite(graded.score)) {
        throw new Error('Grader returned an invalid result shape (missing pass or score).')
      }

      if (verifier) {
        logProgress('evaluation verify', {
          lane: config.key,
          attempt: status.attempt,
        })
        await writeJson(attemptEvaluationStatusPath(runDir, status.attempt), {
          attempt: status.attempt,
          phase: 'verify',
          startedAt: new Date().toISOString(),
        })

        const verification = await withTimeout({
          promise: verifier(graded),
          timeoutMs: EVALUATION_STAGE_TIMEOUT_MS,
          phase: 'verify',
          attempt: status.attempt,
        })

        graded = {
          ...graded,
          outcome: {
            ...graded.outcome,
            _metaVerification: verification,
          },
        }
      }

      const record = toEvaluationRecord(status.attempt, graded)
      evaluations.push(record)
      await writeJson(attemptEvaluationPath(runDir, status.attempt), record)
      logProgress('evaluation complete', {
        lane: config.key,
        attempt: status.attempt,
        pass: record.pass,
        score: record.score,
      })
      await writeJson(attemptEvaluationStatusPath(runDir, status.attempt), {
        attempt: status.attempt,
        phase: verifier ? 'verified' : 'graded',
        finishedAt: new Date().toISOString(),
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const record: AttemptEvaluationRecord = {
        attempt: status.attempt,
        pass: false,
        score: 0,
        reasoning: reason,
      }
      evaluations.push(record)
      await writeJson(attemptEvaluationPath(runDir, status.attempt), record)
      logProgress('evaluation failed', {
        lane: config.key,
        attempt: status.attempt,
        reason,
      })
      await writeJson(attemptEvaluationErrorPath(runDir, status.attempt), {
        attempt: status.attempt,
        error: reason,
        finishedAt: new Date().toISOString(),
      })
      await writeJson(attemptEvaluationStatusPath(runDir, status.attempt), {
        attempt: status.attempt,
        phase: 'failed',
        finishedAt: new Date().toISOString(),
      })
    }
  }

  const validEvaluations = evaluations.filter(isValidEvaluationRecord)
  const averageScore =
    validEvaluations.length === 0
      ? 0
      : validEvaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / validEvaluations.length
  const bestAttempt = validEvaluations.slice().sort((left, right) => right.score - left.score)[0]?.attempt
  const summary: EvaluationSummary = {
    graderPath: evaluationConfig.graderPath,
    ...(evaluationConfig.useMetaVerification && evaluationConfig.verifierPath
      ? { verifierPath: evaluationConfig.verifierPath }
      : {}),
    evaluatedAttempts: evaluations.length,
    passedAttempts: validEvaluations.filter((evaluation) => evaluation.pass).length,
    averageScore,
    ...(bestAttempt ? { bestAttempt } : {}),
  }

  await writeJson(evaluationSummaryPath(runDir), summary)
  logProgress('evaluation summary', {
    lane: config.key,
    evaluatedAttempts: summary.evaluatedAttempts,
    passedAttempts: summary.passedAttempts,
    averageScore: summary.averageScore,
    bestAttempt: summary.bestAttempt ?? null,
  })
  return summary
}

export const selectPromotionDecision = async ({
  repoRoot,
  runDir,
  attempts,
  config,
}: {
  repoRoot: string
  runDir: string
  attempts: number
  config: ResearchLaneConfig
}): Promise<PromotionSummary | null> => {
  const statuses = await readAttemptStatuses(runDir, attempts)
  const candidates: Array<{
    attempt: number
    commit?: string
    pass: boolean
    score: number
    confidence?: number
    changedFiles: string[]
    diffStat: string
    reasoning?: string
    worktreePath: string
  }> = []

  for (const status of statuses) {
    if (status.status !== 'completed') continue
    const result = await readAttemptResult(runDir, status.attempt)
    const evaluation = await readAttemptEvaluation(runDir, status.attempt)
    if (!result || !evaluation) continue
    candidates.push({
      attempt: status.attempt,
      commit: result.attemptCommit,
      pass: evaluation.pass,
      score: evaluation.score,
      confidence:
        typeof evaluation.outcome?.metaVerification === 'object' &&
        evaluation.outcome?.metaVerification &&
        'confidence' in evaluation.outcome.metaVerification &&
        typeof evaluation.outcome.metaVerification.confidence === 'number'
          ? evaluation.outcome.metaVerification.confidence
          : undefined,
      changedFiles: result.changedPaths,
      diffStat: result.diffStat,
      reasoning: evaluation.reasoning,
      worktreePath: status.worktreePath,
    })
  }

  if (candidates.length === 0) {
    return null
  }

  const model = process.env.PLAITED_PROMOTION_MODEL?.trim() || 'z-ai/glm-5'
  const prompt = buildAttemptPromotionPrompt({
    lane: config.key,
    program: config.programPath,
    attempts: candidates.map(({ worktreePath: _, ...candidate }) => candidate),
  })

  const result = await runStructuredLlmQuery<AttemptPromotionDecision>({
    model,
    prompt,
    schema: AttemptPromotionDecisionSchema,
    systemPrompt:
      'You are selecting a promotion decision across validated workspace-improvement attempts. Be conservative. Prefer manual_review unless one attempt is clearly the best supported choice.',
    workspaceReadAccess: {
      workspaceRoot: repoRoot,
      allowedRoots: [
        runDir,
        config.programPath,
        ...config.writableRoots,
        ...resolveLaneSkills(config),
        ...candidates.map((candidate) => candidate.worktreePath),
      ],
      maxToolRounds: 6,
    },
  })

  if (!result.ok) {
    const summary: PromotionSummary = {
      model,
      action: 'manual_review',
      confidence: 0,
      reasoning: result.reason,
    }
    await writeJson(promotionSummaryPath(runDir), summary)
    logProgress('promotion fallback', {
      lane: config.key,
      action: summary.action,
      confidence: summary.confidence,
      reason: summary.reasoning,
    })
    return summary
  }

  const summary: PromotionSummary = {
    model,
    action: result.value.action,
    ...(result.value.selectedAttempt ? { selectedAttempt: result.value.selectedAttempt } : {}),
    ...(result.value.selectedCommit ? { selectedCommit: result.value.selectedCommit } : {}),
    confidence: result.value.confidence,
    reasoning: result.value.reasoning,
  }
  await writeJson(promotionSummaryPath(runDir), summary)
  logProgress('promotion decision', {
    lane: config.key,
    action: summary.action,
    selectedAttempt: summary.selectedAttempt ?? null,
    selectedCommit: summary.selectedCommit ?? null,
    confidence: summary.confidence,
  })
  return summary
}

const runAttempt = async ({
  repoRoot,
  workspaceRoot,
  runDir,
  attempt,
  config,
  strategy,
}: {
  repoRoot: string
  workspaceRoot: string
  runDir: string
  attempt: number
  config: ResearchLaneConfig
  strategy: string
}) => {
  const worktreePath = await createWorktree({ workspaceRoot, runDir, attempt })
  const startedAt = new Date().toISOString()
  await writeAttemptStatus(runDir, attempt, {
    attempt,
    strategy,
    worktreePath,
    status: 'running',
    startedAt,
  })
  logProgress('attempt start', {
    lane: config.key,
    attempt,
    runDir,
  })

  let retryCount = 0
  let currentStrategy = strategy
  let piExitCode = 1
  let validateExitCode = 1
  let diffStat = ''
  let patch = ''
  let changedPaths: string[] = []
  let disallowedPaths: string[] = []
  let attemptCommit: string | undefined
  let errorMessage = ''
  let pid: number | undefined

  while (retryCount <= MAX_ATTEMPT_RETRIES) {
    const piCommand = await buildPiCommand({
      config,
      strategy: currentStrategy,
      repoRoot,
      workspaceRoot: worktreePath,
    })
    const { proc, exitCode } = await runCommand({
      cmd: piCommand,
      cwd: worktreePath,
      stdoutPath: attemptStdoutPath(runDir, attempt),
      stderrPath: attemptStderrPath(runDir, attempt),
      env: {
        PI_CODING_AGENT_DIR: attemptPiStatePath(runDir, attempt),
        PLAITED_WORKSPACE_ROOT: worktreePath,
        PLAITED_REPO_ROOT: repoRoot,
        PLAITED_ALLOWED_WRITABLE_ROOTS: config.writableRoots.join('\n'),
        PLAITED_ALLOWED_READ_ROOTS: (config.readRoots ?? []).join('\n'),
      },
    })
    pid = proc.pid
    piExitCode = exitCode
    changedPaths = await readChangedPaths(worktreePath)
    disallowedPaths = changedPaths.filter((path) => !isAllowedPath({ path, writableRoots: config.writableRoots }))

    if (disallowedPaths.length > 0) {
      errorMessage = buildScopeViolationMessage({
        disallowedPaths,
        writableRoots: config.writableRoots,
      })

      await Bun.write(join(runAttemptDir(runDir, attempt), `retry-${retryCount + 1}.txt`), `${errorMessage}\n`)

      if (retryCount < MAX_ATTEMPT_RETRIES) {
        logProgress('attempt retry', {
          lane: config.key,
          attempt,
          retry: retryCount + 1,
          reason: 'scope-violation',
        })
        currentStrategy = `${strategy}

Retry guidance:
${errorMessage}`
        retryCount += 1
        continue
      }

      validateExitCode = 1
      diffStat = await summarizeDiff(worktreePath)
      break
    }

    const validate = await Bun.spawn({
      cmd: config.validateCommand,
      cwd: worktreePath,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        PLAITED_WORKSPACE_ROOT: worktreePath,
        PLAITED_REPO_ROOT: repoRoot,
      },
    })

    const validateStdout = validate.stdout ? await new Response(validate.stdout).text() : ''
    const validateStderr = validate.stderr ? await new Response(validate.stderr).text() : ''

    await Promise.all([
      Bun.write(join(runAttemptDir(runDir, attempt), 'validate.stdout.log'), validateStdout),
      Bun.write(join(runAttemptDir(runDir, attempt), 'validate.stderr.log'), validateStderr),
    ])

    validateExitCode = await validate.exited
    diffStat = await summarizeDiff(worktreePath)
    patch = await readPatch({ worktreePath })
    if (piExitCode === 0 && validateExitCode === 0 && disallowedPaths.length === 0 && changedPaths.length > 0) {
      try {
        attemptCommit = await commitAttempt({
          worktreePath,
          laneKey: config.key,
          attempt,
        })
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        validateExitCode = 1
        errorMessage = `commit=${reason}`
        break
      }
    }
    errorMessage = piExitCode === 0 && validateExitCode === 0 ? '' : `pi=${piExitCode}, validate=${validateExitCode}`
    break
  }

  const finishedAt = new Date().toISOString()
  const status: AttemptStatusRecord = {
    attempt,
    strategy,
    worktreePath,
    status: piExitCode === 0 && validateExitCode === 0 && disallowedPaths.length === 0 ? 'completed' : 'failed',
    startedAt,
    finishedAt,
    pid,
    piExitCode,
    validateExitCode,
    ...(attemptCommit ? { attemptCommit } : {}),
    ...(piExitCode === 0 && validateExitCode === 0 && disallowedPaths.length === 0 ? {} : { error: errorMessage }),
  }

  await writeAttemptStatus(runDir, attempt, status)
  await writeJson(attemptResultPath(runDir, attempt), {
    attempt,
    strategy,
    retryCount,
    piExitCode,
    validateExitCode,
    diffStat,
    patch,
    changedPaths,
    disallowedPaths,
    worktreePath,
    ...(attemptCommit ? { attemptCommit } : {}),
  })
  logProgress('attempt complete', {
    lane: config.key,
    attempt,
    status: status.status,
    piExitCode,
    validateExitCode,
    changedPaths: changedPaths.length,
    attemptCommit: attemptCommit ?? null,
  })
}

const runWithParallelism = async ({
  attempts,
  parallelism,
  task,
}: {
  attempts: number
  parallelism: number
  task: (attempt: number) => Promise<void>
}) => {
  let next = 1
  const workers = Array.from({ length: parallelism }, async () => {
    while (next <= attempts) {
      const current = next
      next += 1
      await task(current)
    }
  })
  await Promise.all(workers)
}

const main = async () => {
  const workspaceRoot = await resolveWorkspaceRoot()
  const { laneScriptPath, command, attempts, parallelism, runDir } = await parseRunArgs(Bun.argv.slice(2))
  if (!laneScriptPath) {
    console.error(
      'Usage: bun scripts/autoresearch-runner.ts <lane-script-path> [run|status|evaluate] [--attempts N] [--parallel N] [--run-dir PATH]',
    )
    process.exit(1)
  }

  const config = await getLaneConfig(laneScriptPath)

  if (command === 'status') {
    const effectiveRunDir = runDir
    if (!effectiveRunDir) {
      console.error('status requires --run-dir PATH')
      process.exit(1)
    }

    const manifestFile = Bun.file(join(effectiveRunDir, 'manifest.json'))
    if (!(await manifestFile.exists())) {
      console.error(`No manifest found at ${effectiveRunDir}`)
      process.exit(1)
    }

    const manifest = (await manifestFile.json()) as RunManifest
    const statuses = await readAttemptStatuses(effectiveRunDir, manifest.attempts)
    const evaluationFile = Bun.file(evaluationSummaryPath(effectiveRunDir))
    const promotionFile = Bun.file(promotionSummaryPath(effectiveRunDir))
    console.log(
      JSON.stringify(
        {
          manifest,
          attempts: statuses,
          evaluation: (await evaluationFile.exists()) ? await evaluationFile.json() : null,
          promotion: (await promotionFile.exists()) ? await promotionFile.json() : null,
        },
        null,
        2,
      ),
    )
    return
  }

  if (command === 'evaluate') {
    const effectiveRunDir = runDir
    if (!effectiveRunDir) {
      console.error('evaluate requires --run-dir PATH')
      process.exit(1)
    }

    const manifestFile = Bun.file(join(effectiveRunDir, 'manifest.json'))
    if (!(await manifestFile.exists())) {
      console.error(`No manifest found at ${effectiveRunDir}`)
      process.exit(1)
    }

    const manifest = (await manifestFile.json()) as RunManifest
    const evaluation = await evaluateAttempts({
      runDir: effectiveRunDir,
      attempts: manifest.attempts,
      config,
    })
    const promotion = await selectPromotionDecision({
      repoRoot: workspaceRoot,
      runDir: effectiveRunDir,
      attempts: manifest.attempts,
      config,
    })
    console.log(
      JSON.stringify(
        {
          runDir: effectiveRunDir,
          lane: config.key,
          ...(evaluation ? { evaluation } : {}),
          ...(promotion ? { promotion } : {}),
        },
        null,
        2,
      ),
    )
    return
  }

  const effectiveRunDir = runDir ?? buildRunDir({ workspaceRoot, lane: config.key })
  await ensureDir(effectiveRunDir)
  await writeJson(join(effectiveRunDir, 'manifest.json'), {
    lane: config.key,
    laneScriptPath: normalizeScriptPath(laneScriptPath),
    createdAt: new Date().toISOString(),
    attempts,
    parallelism,
    runDir: effectiveRunDir,
  } satisfies RunManifest)
  logProgress('run start', {
    lane: config.key,
    runDir: effectiveRunDir,
    attempts,
    parallelism,
    skillTags: process.env[RESEARCH_SKILL_TAGS_ENV] ?? '',
  })

  const strategyNotes =
    config.strategyNotes && config.strategyNotes.length > 0
      ? Array.from(
          { length: attempts },
          (_, index) => config.strategyNotes?.[index % config.strategyNotes.length] ?? '',
        )
      : buildStrategyNotes(attempts)

  const stopHandler = async () => {
    const statuses = await readAttemptStatuses(effectiveRunDir, attempts)
    await Promise.all(
      statuses
        .filter((status) => status.status === 'running' && status.pid)
        .map(async (status) => {
          try {
            process.kill(status.pid!, 'SIGTERM')
          } catch {
            // ignore
          }
          await writeAttemptStatus(effectiveRunDir, status.attempt, {
            ...status,
            status: 'stopped',
            finishedAt: new Date().toISOString(),
            error: 'Stopped by operator',
          })
        }),
    )
    process.exit(1)
  }

  process.on('SIGINT', () => {
    void stopHandler()
  })

  await runWithParallelism({
    attempts,
    parallelism,
    task: async (attempt) => {
      const strategy = strategyNotes[attempt - 1]!
      await writeAttemptStatus(effectiveRunDir, attempt, {
        attempt,
        strategy,
        worktreePath: attemptWorktreePath(effectiveRunDir, attempt),
        status: 'queued',
      })
      await runAttempt({
        repoRoot: workspaceRoot,
        workspaceRoot,
        runDir: effectiveRunDir,
        attempt,
        config,
        strategy,
      })
    },
  })

  const statuses = await readAttemptStatuses(effectiveRunDir, attempts)
  logProgress('promotion start', {
    lane: config.key,
    runDir: effectiveRunDir,
    completed: statuses.filter((status) => status.status === 'completed').length,
    failed: statuses.filter((status) => status.status === 'failed').length,
  })
  const evaluation = await evaluateAttempts({
    runDir: effectiveRunDir,
    attempts,
    config,
  })
  const promotion = await selectPromotionDecision({
    repoRoot: workspaceRoot,
    runDir: effectiveRunDir,
    attempts,
    config,
  })
  console.log(
    JSON.stringify(
      {
        runDir: effectiveRunDir,
        lane: config.key,
        completed: statuses.filter((status) => status.status === 'completed').length,
        failed: statuses.filter((status) => status.status === 'failed').length,
        ...(evaluation ? { evaluation } : {}),
        ...(promotion ? { promotion } : {}),
      },
      null,
      2,
    ),
  )
}

if (import.meta.main) {
  await main()
}
