#!/usr/bin/env bun

/**
 * Dev autoresearch harness for improving Plaited itself.
 *
 * @remarks
 * This is developer tooling. It is not a shipped runtime feature of Plaited.
 * The harness runs one bounded slice in an isolated worktree, validates the
 * result, and logs keep/revise/discard output via the improve-layer utilities.
 */

import { join, dirname as pathDirname } from 'node:path'
import {
  checkImproveScope,
  createStageLogger,
  type ImprovementAttemptDecision,
  type ImprovementStageLogEntry,
  type ImprovementValidationResult,
  loadImprovementProtocolContext,
  resolveProgramPath,
} from '../src/improve/protocol.ts'
import {
  assessTrainingCapture,
  type GraderResult,
  loadAdapter,
  loadGrader,
  logExperiment,
  type TrainingCaptureAssessment,
} from '../src/improve.ts'

type CliInput = {
  adapterPath: string
  commit: boolean
  dryRun: boolean
  judge: boolean
  judgePath: string
  maxAttempts: number
  metaVerifierPath: string
  push: boolean
  programPath: string
  quiet: boolean
  resultJsonPath?: string
  slicePath: string
  strategyNote?: string
}

type ValidationResult = ImprovementValidationResult

type Checks = {
  typecheck: {
    passed: boolean
    notes: string
    command: string[]
  }
  targetedTests: {
    passed: boolean
    notes: string
    command: string[]
  }
  scope?: {
    passed: boolean
    notes: string
    allowedPaths: string[]
  }
  traceCapture?: TrainingCaptureAssessment
  fullSuite?: {
    passed: boolean
    notes: string
    command: string[]
    ran: boolean
  }
}

type JudgeBundle = {
  primary: GraderResult
  meta?: GraderResult
}

export type StageLogEntry = ImprovementStageLogEntry

export type RepoAutoresearchResult = {
  mode: 'repo-harness'
  sliceId: string
  slicePath: string
  programPath: string
  decision: ImprovementAttemptDecision
  changedFiles: string[]
  diffStat: string
  attempt: number
  passed: boolean
  strategyNote?: string
  commit?: string
  pushedBranch?: string
  capture: {
    eligible: boolean
    richness: string
    reasons: string[]
  }
  judges?: {
    fast?: { pass: boolean; score: number }
    fastMeta?: { pass: boolean; score: number }
    final?: { pass: boolean; score: number }
    finalMeta?: { pass: boolean; score: number }
  }
}

const PROJECT_ROOT = join(import.meta.dir, '..')
const WORKTREES_ROOT = join(PROJECT_ROOT, '.worktrees')
const TEST_FILE_PATTERN = /(\.spec\.ts|\.test\.ts|_spec\.ts|_test\.ts)$/
const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx)$/
const TEST_DIRECTORIES = ['src/', 'scripts/', 'skills/']
const BROWSER_TEST_FILES = ['src/ui/protocol/tests/controller-browser.spec.ts']
const UI_PATH_PREFIXES = ['src/ui/']
const DEFAULT_ALLOWED_PATHS = ['scripts/', 'src/runtime/', 'src/improve/']
const BOOLEAN_FLAGS = new Set(['--commit', '--dry-run', '--judge', '--push', '--no-push', '--quiet'])

const getArg = (args: string[], flag: string, fallback?: string): string | undefined => {
  const index = args.indexOf(flag)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag)

const getPositionalArgs = (args: string[]): string[] => {
  const positional: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) continue
    if (arg.startsWith('--')) {
      if (!BOOLEAN_FLAGS.has(arg)) index += 1
      continue
    }
    positional.push(arg)
  }
  return positional
}

export const parseInput = (args: string[]): CliInput => {
  const [slicePath] = getPositionalArgs(args)
  const resolvedSlicePath = slicePath ?? getArg(args, '--slice', './dev-research/runtime-taxonomy/slice-1.md')!
  return {
    adapterPath: getArg(args, '--adapter', './scripts/codex-cli-adapter.ts')!,
    commit: hasFlag(args, '--commit'),
    dryRun: hasFlag(args, '--dry-run'),
    judge: hasFlag(args, '--judge'),
    judgePath: getArg(args, '--judge-path', './scripts/repo-improvement-judge.ts')!,
    maxAttempts: Number(getArg(args, '--max-attempts', '1')),
    metaVerifierPath: getArg(args, '--meta-verifier-path', './scripts/repo-improvement-meta-verifier.ts')!,
    push: !hasFlag(args, '--no-push'),
    programPath: resolveProgramPath(resolvedSlicePath, getArg(args, '--program')),
    quiet: hasFlag(args, '--quiet'),
    resultJsonPath: getArg(args, '--result-json'),
    slicePath: resolvedSlicePath,
    strategyNote: getArg(args, '--strategy-note'),
  }
}

const ensureRequiredSecrets = ({ judge }: { judge: boolean }) => {
  if (judge && !process.env.OPENROUTER_API_KEY) {
    throw new Error(
      'Missing OPENROUTER_API_KEY. Resolve secrets before running judged autoresearch. ' +
        'For long-term setup, use Varlock + 1Password via .env.schema.',
    )
  }
}

const linkSharedToolchain = async (worktree: string) => {
  const nodeModulesSource = join(PROJECT_ROOT, 'node_modules')
  if (!(await Bun.file(nodeModulesSource).exists())) return
  await Bun.$`ln -sfn ${nodeModulesSource} ${join(worktree, 'node_modules')}`.nothrow().quiet()
}

const createWorktree = async (id: string): Promise<string> => {
  const safeId = id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  await Bun.$`mkdir -p ${WORKTREES_ROOT}`.quiet()
  const base = (await Bun.$`mktemp -d ${join(WORKTREES_ROOT, `plaited-dev-${safeId}-XXXXXX`)}`.quiet()).text().trim()
  const target = join(base, 'repo')
  const add = await Bun.$`git worktree add --detach ${target} HEAD`.cwd(PROJECT_ROOT).nothrow().quiet()
  if (add.exitCode !== 0) {
    throw new Error(`git worktree add failed: ${add.stderr.toString().trim()}`)
  }
  await linkSharedToolchain(target)
  return target
}

const removeWorktree = async (worktree: string) => {
  await Bun.$`git worktree remove --force ${worktree}`.cwd(PROJECT_ROOT).nothrow().quiet()
}

const ensureMainBranchReady = async () => {
  const status = (await Bun.$`git status --porcelain --untracked-files=no`.cwd(PROJECT_ROOT).quiet()).text().trim()
  if (status) {
    throw new Error('Main worktree has tracked changes. Clean dev before using --push.')
  }
}

const formatWorktreeChanges = async (cwd: string) => {
  const stagedOrModified = (await Bun.$`git diff --name-only HEAD`.cwd(cwd).quiet()).text().trim()
  const changedFiles = stagedOrModified
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)

  if (changedFiles.length === 0) return

  const formatTargets = changedFiles.filter((file) => /\.(js|cjs|jsx|ts|tsx)$/.test(file))
  if (formatTargets.length > 0) {
    const format = Bun.spawn(['bunx', 'biome', 'format', '--write', ...formatTargets], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env as Record<string, string>,
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(format.stdout).text(),
      new Response(format.stderr).text(),
      format.exited,
    ])
    if (exitCode !== 0) {
      throw new Error(`biome format failed: ${`${stdout}${stderr}`.trim()}`)
    }
  }

  if (changedFiles.includes('package.json')) {
    const formatPackage = Bun.spawn(['format-package', '-w'], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env as Record<string, string>,
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(formatPackage.stdout).text(),
      new Response(formatPackage.stderr).text(),
      formatPackage.exited,
    ])
    if (exitCode !== 0) {
      throw new Error(`format-package failed: ${`${stdout}${stderr}`.trim()}`)
    }
  }
}

const commitWorktreeExperiment = async (cwd: string, description: string): Promise<string> => {
  await formatWorktreeChanges(cwd)
  await Bun.$`git add -A`.cwd(cwd).quiet()
  const commit = Bun.spawn(['git', 'commit', '-m', `chore(experiment): ${description}`], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(commit.stdout).text(),
    new Response(commit.stderr).text(),
    commit.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`git commit failed: ${`${stdout}${stderr}`.trim()}`)
  }
  return (await Bun.$`git rev-parse --short HEAD`.cwd(cwd).quiet()).text().trim()
}

const cherryPickExperimentCommit = async (sha: string): Promise<void> => {
  const cherryPick = Bun.spawn(['git', 'cherry-pick', sha], {
    cwd: PROJECT_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(cherryPick.stdout).text(),
    new Response(cherryPick.stderr).text(),
    cherryPick.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`git cherry-pick failed: ${`${stdout}${stderr}`.trim()}`)
  }
}

const pushCurrentBranch = async (): Promise<string> => {
  const branch = (await Bun.$`git rev-parse --abbrev-ref HEAD`.cwd(PROJECT_ROOT).quiet()).text().trim()
  if (!branch || branch === 'HEAD') {
    throw new Error('Cannot push detached HEAD from main worktree.')
  }
  const push = Bun.spawn(['git', 'push', 'origin', branch], {
    cwd: PROJECT_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(push.stdout).text(),
    new Response(push.stderr).text(),
    push.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`git push failed: ${`${stdout}${stderr}`.trim()}`)
  }
  return branch
}

const summarizeCommandFailure = (command: string[], stdout: string, stderr: string): string => {
  const output = `${stdout}${stderr}`.trim()
  if (!output) return `Command failed: ${command.join(' ')}`

  if (command[0] === 'bun' && command[1] === 'test') {
    const lines = output.split('\n')
    const failureLines = lines.filter((line) => {
      const trimmed = line.trim()
      return trimmed.startsWith('(fail)') || trimmed.startsWith('error:') || trimmed.startsWith('Expected:')
    })
    const tail = lines.slice(-40)
    const parts = [
      ...(failureLines.length > 0 ? ['Failures:', ...failureLines.slice(0, 8)] : []),
      ...(tail.length > 0 ? ['', 'Tail:', ...tail] : []),
    ]
    return parts.join('\n').trim().slice(0, 4000)
  }

  return output.length > 1500 ? output.slice(-1500) : output
}

const runCheck = async (cwd: string, command: string[]): Promise<ValidationResult> => {
  const result = await Bun.spawn(command, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
    result.exited,
  ])

  if (exitCode !== 0) {
    return {
      passed: false,
      notes: summarizeCommandFailure(command, stdout, stderr),
      command,
    }
  }

  return { passed: true, notes: 'ok', command }
}

const prepareDiffView = async (cwd: string) => {
  await Bun.$`git add -N .`.cwd(cwd).nothrow().quiet()
}

export const getChangedFiles = async (cwd: string): Promise<string[]> => {
  await prepareDiffView(cwd)
  const result = await Bun.$`git diff HEAD --name-only`.cwd(cwd).nothrow().quiet()
  return result.text().trim().split('\n').filter(Boolean).map(normalizePath)
}

export const getDiffStat = async (cwd: string): Promise<string> => {
  await prepareDiffView(cwd)
  return (await Bun.$`git diff HEAD --stat`.cwd(cwd).nothrow().quiet()).text().trim()
}

export const getPatch = async (cwd: string): Promise<string> => {
  await prepareDiffView(cwd)
  return (await Bun.$`git diff HEAD --no-ext-diff`.cwd(cwd).nothrow().quiet()).text().trim()
}

const normalizePath = (path: string): string => path.replace(/\\/g, '/')

const dirname = (path: string): string => {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  return index === -1 ? '.' : normalized.slice(0, index)
}

const basename = (path: string): string => {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  return index === -1 ? normalized : normalized.slice(index + 1)
}

const basenameWithoutExt = (path: string): string => basename(path).replace(/\.[^.]+$/, '')

export const resolveImportPath = async (cwd: string, fromFile: string, specifier: string): Promise<string | null> => {
  if (!specifier.startsWith('.')) return null

  const baseDir = dirname(fromFile)
  const candidates = [
    join(baseDir, specifier),
    join(baseDir, `${specifier}.ts`),
    join(baseDir, `${specifier}.tsx`),
    join(baseDir, `${specifier}.js`),
    join(baseDir, `${specifier}.jsx`),
    join(baseDir, specifier, 'index.ts'),
    join(baseDir, specifier, 'index.tsx'),
    join(baseDir, specifier, 'index.js'),
    join(baseDir, specifier, 'index.jsx'),
  ].map(normalizePath)

  for (const candidate of candidates) {
    if (await Bun.file(join(cwd, candidate)).exists()) return candidate
  }

  return candidates[0] ?? null
}

const listTestFiles = async (cwd: string): Promise<string[]> => {
  const roots: string[] = []
  for (const directory of TEST_DIRECTORIES) {
    const candidate = directory.replace(/\/$/, '')
    const exists = await Bun.$`test -d ${join(cwd, candidate)}`.nothrow().quiet()
    if (exists.exitCode === 0) roots.push(candidate)
  }

  if (roots.length === 0) return []

  const result = await Bun.$`rg --files ${roots}`.cwd(cwd).quiet()
  return result
    .text()
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((path) => TEST_FILE_PATTERN.test(path))
    .map(normalizePath)
}

export const scanImports = async (cwd: string, filePath: string): Promise<string[]> => {
  if (!SOURCE_FILE_PATTERN.test(filePath)) return []

  const file = Bun.file(join(cwd, filePath))
  if (!(await file.exists())) return []

  const text = await file.text()
  const loader = filePath.endsWith('.tsx')
    ? 'tsx'
    : filePath.endsWith('.ts')
      ? 'ts'
      : filePath.endsWith('.jsx')
        ? 'jsx'
        : 'js'

  const transpiler = new Bun.Transpiler({ loader })
  const { imports } = transpiler.scan(text)
  const importSpecifiers = imports
    .map((entry) => (entry && typeof entry.path === 'string' ? entry.path : null))
    .filter((entry): entry is string => entry !== null)

  const resolved = await Promise.all(importSpecifiers.map((entry) => resolveImportPath(cwd, filePath, entry)))
  return resolved.filter((candidate): candidate is string => candidate !== null)
}

const buildConventionalTestCandidates = (changedFile: string, allTests: string[]): string[] => {
  if (TEST_FILE_PATTERN.test(changedFile)) {
    return allTests.includes(changedFile) ? [changedFile] : []
  }

  const fileName = basenameWithoutExt(changedFile)
  const parentDir = dirname(changedFile)
  const parentName = basename(parentDir)
  const moduleDir = parentName === 'tests' ? dirname(parentDir) : parentDir

  return allTests.filter((testPath) => {
    if (!testPath.startsWith(moduleDir)) return false
    const testBase = basenameWithoutExt(testPath)
    return (
      testBase === fileName ||
      testBase === parentName ||
      dirname(testPath) === join(moduleDir, 'tests') ||
      dirname(testPath).startsWith(join(moduleDir, 'tests'))
    )
  })
}

export const resolveImpactedTests = async (cwd: string, changedFiles: string[]): Promise<string[]> => {
  const allTests = await listTestFiles(cwd)
  const selected = new Set<string>()

  for (const changedFile of changedFiles.map(normalizePath)) {
    for (const candidate of buildConventionalTestCandidates(changedFile, allTests)) {
      selected.add(candidate)
    }
  }

  if (selected.size === 0) {
    const importGraph = new Map<string, string[]>()
    for (const testFile of allTests) {
      importGraph.set(testFile, await scanImports(cwd, testFile))
    }

    for (const changedFile of changedFiles.map(normalizePath)) {
      for (const [testFile, imports] of importGraph.entries()) {
        if (
          imports.some(
            (entry) =>
              typeof entry === 'string' &&
              (entry.includes(changedFile.replace(/\.[^.]+$/, '')) || entry === changedFile),
          )
        ) {
          selected.add(testFile)
        }
      }
    }
  }

  return [...selected].sort()
}

export const shouldRunBrowserTests = ({
  changedFiles,
  impactedTests,
}: {
  changedFiles: string[]
  impactedTests: string[]
}) => {
  const allSignals = [...changedFiles, ...impactedTests].map(normalizePath)
  return allSignals.some(
    (path) => BROWSER_TEST_FILES.includes(path) || UI_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)),
  )
}

const buildFullSuiteCommand = async ({
  cwd,
  changedFiles,
  impactedTests,
}: {
  cwd: string
  changedFiles: string[]
  impactedTests: string[]
}) => {
  if (shouldRunBrowserTests({ changedFiles, impactedTests })) {
    return ['bun', 'test', ...TEST_DIRECTORIES]
  }

  const filteredTests = (await listTestFiles(cwd)).filter((path) => !BROWSER_TEST_FILES.includes(path))
  return filteredTests.length > 0 ? ['bun', 'test', ...filteredTests] : ['bun', 'test', ...TEST_DIRECTORIES]
}

export const shouldSkipRepoTests = ({
  changedFiles,
  impactedTests,
}: {
  changedFiles: string[]
  impactedTests: string[]
}) =>
  impactedTests.length === 0 &&
  changedFiles.length > 0 &&
  changedFiles.every((path) => path.startsWith('dev-research/') && /\.(md|jsonl)$/.test(path))

const buildChecks = (typecheck: ValidationResult, tests: ValidationResult): Checks => ({
  typecheck: {
    passed: typecheck.passed,
    notes: typecheck.notes,
    command: typecheck.command,
  },
  targetedTests: {
    passed: tests.passed,
    notes: tests.notes,
    command: tests.command,
  },
})

export const createLogger = createStageLogger

const summarizeReasoning = (reasoning?: string): string => {
  if (!reasoning) return ''
  const firstLine = reasoning.split('\n').find((line) => line.trim().length > 0) ?? ''
  return firstLine.slice(0, 220)
}

const getJudgeCostUsd = (result?: GraderResult, key?: string): number | undefined => {
  const outcome = result?.outcome
  if (!outcome || !key) return undefined
  const sdk = outcome[key]
  if (!sdk || typeof sdk !== 'object') return undefined
  const totalCostUsd = (sdk as { totalCostUsd?: unknown }).totalCostUsd
  return typeof totalCostUsd === 'number' ? totalCostUsd : undefined
}

const runJudges = async ({
  enabled,
  judgePath,
  metaVerifierPath,
  task,
  candidateOutput,
  program,
  slice,
  changedFiles,
  diffStat,
  patch,
  checks,
}: {
  enabled: boolean
  judgePath: string
  metaVerifierPath: string
  task: string
  candidateOutput: string
  program: string
  slice: string
  changedFiles: string[]
  diffStat: string
  patch: string
  checks: ReturnType<typeof buildChecks>
}): Promise<JudgeBundle | undefined> => {
  if (!enabled) return undefined

  const judge = await loadGrader(judgePath)
  const metadata = {
    changedFiles,
    diffStat,
    patch,
    checks,
    program,
    slice,
  }

  const primary = await judge({
    input: task,
    output: candidateOutput,
    metadata,
  })

  const metaVerifier = await loadGrader(metaVerifierPath)
  const meta = await metaVerifier({
    input: task,
    output: JSON.stringify(primary, null, 2),
    metadata: {
      ...metadata,
      candidateOutput,
    },
  })

  return { primary, meta }
}

const printAttemptSummary = ({
  attempt,
  decision,
  changedFiles,
  diffStat,
  captureAssessment,
  judges,
  finalJudges,
  fullTests,
}: {
  attempt: number
  decision: ImprovementAttemptDecision
  changedFiles: string[]
  diffStat: string
  captureAssessment: TrainingCaptureAssessment
  judges?: JudgeBundle
  finalJudges?: JudgeBundle
  fullTests: ValidationResult
}) => {
  console.log(`attempt=${attempt} decision=${decision}`)
  console.log(`changed=${changedFiles.length} diff="${diffStat || 'no diff'}"`)
  if (!fullTests.passed && fullTests.notes !== 'Skipped: fast validation failed') {
    console.log(`full-tests-failure="${summarizeReasoning(fullTests.notes)}"`)
  }
  console.log(
    captureAssessment.eligible
      ? `capture=${captureAssessment.richness}`
      : `capture=skip:${captureAssessment.reasons.join('+') || 'unknown'}`,
  )
  if (judges?.primary) {
    console.log(`fast-judge=${judges.primary.pass ? 'pass' : 'fail'} score=${judges.primary.score.toFixed(2)}`)
    const fastJudgeCost = getJudgeCostUsd(judges.primary, 'judgeSdk')
    if (fastJudgeCost !== undefined) {
      console.log(`fast-judge-cost=$${fastJudgeCost.toFixed(4)}`)
    }
    if (judges.primary.reasoning) {
      console.log(`fast-judge-reason="${summarizeReasoning(judges.primary.reasoning)}"`)
    }
  }
  if (judges?.meta) {
    console.log(`fast-meta=${judges.meta.pass ? 'pass' : 'fail'} score=${judges.meta.score.toFixed(2)}`)
    const fastMetaCost = getJudgeCostUsd(judges.meta, 'metaVerificationSdk')
    if (fastMetaCost !== undefined) {
      console.log(`fast-meta-cost=$${fastMetaCost.toFixed(4)}`)
    }
    if (judges.meta.reasoning) {
      console.log(`fast-meta-reason="${summarizeReasoning(judges.meta.reasoning)}"`)
    }
  }
  if (finalJudges) {
    console.log(`judge=${finalJudges.primary.pass ? 'pass' : 'fail'} score=${finalJudges.primary.score.toFixed(2)}`)
    const judgeCost = getJudgeCostUsd(finalJudges.primary, 'judgeSdk')
    if (judgeCost !== undefined) {
      console.log(`judge-cost=$${judgeCost.toFixed(4)}`)
    }
    if (finalJudges.primary.reasoning) {
      console.log(`judge-reason="${summarizeReasoning(finalJudges.primary.reasoning)}"`)
    }
    if (finalJudges.meta) {
      console.log(`meta=${finalJudges.meta.pass ? 'pass' : 'fail'} score=${finalJudges.meta.score.toFixed(2)}`)
      const metaCost = getJudgeCostUsd(finalJudges.meta, 'metaVerificationSdk')
      if (metaCost !== undefined) {
        console.log(`meta-cost=$${metaCost.toFixed(4)}`)
      }
      if (finalJudges.meta.reasoning) {
        console.log(`meta-reason="${summarizeReasoning(finalJudges.meta.reasoning)}"`)
      }
    }
  }
}

const persistResultJson = async ({ path, result }: { path?: string; result: RepoAutoresearchResult }) => {
  if (!path) return
  await Bun.$`mkdir -p ${pathDirname(path)}`.quiet()
  await Bun.write(path, `${JSON.stringify(result, null, 2)}\n`)
}

const main = async () => {
  const input = parseInput(process.argv.slice(2))
  const stageLog: StageLogEntry[] = []
  const logStatus = createLogger(input.quiet, stageLog)
  const protocol = await loadImprovementProtocolContext({
    defaultAllowedPaths: DEFAULT_ALLOWED_PATHS,
    programPath: input.programPath,
    slicePath: input.slicePath,
  })
  const { allowedPaths, prompt } = protocol
  const effectivePrompt = input.strategyNote ? `${prompt}\n\nStrategy note:\n- ${input.strategyNote}` : prompt
  const program = protocol.program.text
  const slice = protocol.slice.text
  const adapter = await loadAdapter(input.adapterPath)
  const sliceId = protocol.slice.id
  let lastAttemptResult: RepoAutoresearchResult | null = null

  console.log(`mode=repo-harness adapter=${input.adapterPath} slice=${sliceId} judge=${input.judge}`)
  if (input.dryRun) {
    console.log(`dry-run=true attempts=${input.maxAttempts} commit=${input.commit} push=${input.push}`)
    console.log(`program=${input.programPath}`)
    console.log(`slice=${input.slicePath}`)
    console.log(`allowedPaths=${allowedPaths.join(', ')}`)
    return
  }

  ensureRequiredSecrets({ judge: input.judge })

  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    logStatus('attempt:start', `${attempt}/${input.maxAttempts}`)
    const worktree = await createWorktree(`${sliceId}-${attempt}`)
    logStatus('worktree', worktree)

    try {
      logStatus('adapter:start', 'running implementation adapter')
      const result = await adapter({ prompt: effectivePrompt, cwd: worktree })
      logStatus('adapter:done', `timedOut=${result.timedOut} exitCode=${result.exitCode ?? 'none'}`)
      logStatus('diff:start', 'collecting changed files and patch')
      const changedFiles = await getChangedFiles(worktree)
      const diffStat = await getDiffStat(worktree)
      const patch = await getPatch(worktree)
      const scope = checkImproveScope(changedFiles, allowedPaths)
      logStatus(
        'scope',
        `${scope.passed ? 'pass' : 'fail'} changed=${changedFiles.length} allowed=${allowedPaths.join(', ')}`,
      )
      const captureAssessment: TrainingCaptureAssessment = assessTrainingCapture({
        trial: {
          trajectory: result.trajectory,
          timedOut: result.timedOut,
          exitCode: result.exitCode,
        },
      })
      logStatus(
        'capture',
        captureAssessment.eligible
          ? `eligible richness=${captureAssessment.richness}`
          : `skip reasons=${captureAssessment.reasons.join('+') || 'unknown'}`,
      )
      logStatus('typecheck:start', 'bun --bun tsc --noEmit')
      const typecheck = scope.passed
        ? await runCheck(worktree, ['bun', '--bun', 'tsc', '--noEmit'])
        : {
            passed: false,
            notes: 'Skipped: scope failed',
            command: ['bun', '--bun', 'tsc', '--noEmit'],
          }
      logStatus('typecheck', typecheck.passed ? 'pass' : `fail ${typecheck.notes}`)
      const impactedTests = scope.passed ? await resolveImpactedTests(worktree, changedFiles) : []
      const skipRepoTests = scope.passed && shouldSkipRepoTests({ changedFiles, impactedTests })
      logStatus(
        'tests:targeted',
        skipRepoTests
          ? 'skipping docs-only research slice'
          : impactedTests.length > 0
            ? `selected ${impactedTests.length} test file(s)`
            : 'falling back to default test roots',
      )
      const tests = skipRepoTests
        ? {
            passed: true,
            notes: 'Skipped: docs-only research slice',
            command: ['bun', 'test'],
          }
        : scope.passed && typecheck.passed
          ? await runCheck(
              worktree,
              impactedTests.length > 0 ? ['bun', 'test', ...impactedTests] : ['bun', 'test', ...TEST_DIRECTORIES],
            )
          : {
              passed: false,
              notes: 'Skipped: earlier validation failed',
              command:
                impactedTests.length > 0 ? ['bun', 'test', ...impactedTests] : ['bun', 'test', ...TEST_DIRECTORIES],
            }
      logStatus('tests', tests.passed ? 'pass' : `fail ${tests.notes}`)
      const checks = buildChecks(typecheck, tests)
      logStatus('judge:fast', input.judge && scope.passed ? 'running fast judge pass' : 'skipped')
      const judges = await runJudges({
        enabled: input.judge && scope.passed,
        judgePath: input.judgePath,
        metaVerifierPath: input.metaVerifierPath,
        task: slice,
        candidateOutput: result.output,
        program,
        slice,
        changedFiles,
        diffStat,
        patch,
        checks: {
          ...checks,
          scope: {
            passed: scope.passed,
            notes: scope.notes,
            allowedPaths: scope.allowedPaths,
          },
        },
      })

      const judgePassed = judges ? judges.primary.pass && (judges.meta?.pass ?? true) : true
      const fastPassed = scope.passed && typecheck.passed && tests.passed && judgePassed
      logStatus('validation:fast', fastPassed ? 'pass' : 'fail')
      const fullTestsCommand = skipRepoTests
        ? ['bun', 'test']
        : fastPassed
          ? await buildFullSuiteCommand({
              cwd: worktree,
              changedFiles,
              impactedTests,
            })
          : ['bun', 'test', ...TEST_DIRECTORIES]
      const fullTests = skipRepoTests
        ? {
            passed: true,
            notes: 'Skipped: docs-only research slice',
            command: fullTestsCommand,
          }
        : fastPassed
          ? await runCheck(worktree, fullTestsCommand)
          : {
              passed: false,
              notes: 'Skipped: fast validation failed',
              command: fullTestsCommand,
            }
      logStatus('tests:full', fastPassed ? (fullTests.passed ? 'pass' : `fail ${fullTests.notes}`) : 'skipped')
      const judgeChecks = {
        ...checks,
        fullSuite: {
          passed: fullTests.passed,
          notes: fullTests.notes,
          command: fullTests.command,
          ran: fastPassed,
        },
      }
      const finalJudges = await runJudges({
        enabled: input.judge && fastPassed,
        judgePath: input.judgePath,
        metaVerifierPath: input.metaVerifierPath,
        task: slice,
        candidateOutput: result.output,
        program,
        slice,
        changedFiles,
        diffStat,
        patch,
        checks: {
          ...judgeChecks,
          scope: {
            passed: scope.passed,
            notes: scope.notes,
            allowedPaths: scope.allowedPaths,
          },
          traceCapture: captureAssessment,
        },
      })
      logStatus('judge:final', input.judge && fastPassed ? 'completed' : 'skipped')
      const finalJudgePassed = finalJudges ? finalJudges.primary.pass && (finalJudges.meta?.pass ?? true) : fastPassed
      const passed = fastPassed && fullTests.passed && finalJudgePassed
      const decision: ImprovementAttemptDecision = passed ? 'keep' : changedFiles.length > 0 ? 'revise' : 'discard'

      let commit = ''
      if (passed && input.commit) {
        logStatus('commit:start', 'creating experiment commit')
        commit = await commitWorktreeExperiment(worktree, `dev-autoresearch ${sliceId} attempt ${attempt}`)
        logStatus('commit:done', commit)
      }

      let pushedBranch = ''
      if (passed && input.push) {
        logStatus('push:start', 'cherry-picking keep commit onto main branch')
        await ensureMainBranchReady()
        if (!commit) {
          throw new Error('Cannot push without a keep commit. Use --commit with --push.')
        }
        await cherryPickExperimentCommit(commit)
        logStatus('push:cherry-pick', commit)
        pushedBranch = await pushCurrentBranch()
        logStatus('push:done', pushedBranch)
      }

      logStatus('log:start', 'recording experiment result')
      await logExperiment({
        commit,
        description: `dev-autoresearch ${sliceId} attempt ${attempt}`,
        scores: {
          changed_files: changedFiles.length,
          typecheck: typecheck.passed ? 1 : 0,
          tests: tests.passed ? 1 : 0,
          full_tests: fullTests.passed ? 1 : 0,
          ...(getJudgeCostUsd(judges?.primary, 'judgeSdk') !== undefined
            ? { fast_judge_cost_usd: getJudgeCostUsd(judges?.primary, 'judgeSdk')! }
            : {}),
          ...(getJudgeCostUsd(judges?.meta, 'metaVerificationSdk') !== undefined
            ? { fast_meta_cost_usd: getJudgeCostUsd(judges?.meta, 'metaVerificationSdk')! }
            : {}),
          ...(getJudgeCostUsd(finalJudges?.primary, 'judgeSdk') !== undefined
            ? { judge_cost_usd: getJudgeCostUsd(finalJudges?.primary, 'judgeSdk')! }
            : {}),
          ...(getJudgeCostUsd(finalJudges?.meta, 'metaVerificationSdk') !== undefined
            ? { meta_cost_usd: getJudgeCostUsd(finalJudges?.meta, 'metaVerificationSdk')! }
            : {}),
        },
        status: decision === 'keep' ? 'keep' : 'discard',
        timestamp: new Date().toISOString(),
        prompts: [sliceId],
        metadata: {
          adapterPath: input.adapterPath,
          decision,
          diffStat,
          patch: patch.slice(0, 12000),
          output: result.output,
          changedFiles,
          scope,
          captureAssessment,
          checks: judgeChecks,
          impactedTests,
          fullTests: {
            passed: fullTests.passed,
            notes: fullTests.notes,
            command: fullTests.command,
          },
          fastJudge: judges?.primary,
          fastMetaVerification: judges?.meta,
          judge: finalJudges?.primary,
          metaVerification: finalJudges?.meta,
          stageLog,
        },
      })
      logStatus('log:done', decision)

      printAttemptSummary({
        attempt,
        decision,
        changedFiles,
        diffStat,
        captureAssessment,
        judges,
        finalJudges,
        fullTests,
      })

      const attemptResult: RepoAutoresearchResult = {
        mode: 'repo-harness',
        sliceId,
        slicePath: input.slicePath,
        programPath: input.programPath,
        decision,
        changedFiles,
        diffStat,
        attempt,
        passed,
        ...(input.strategyNote ? { strategyNote: input.strategyNote } : {}),
        ...(commit ? { commit } : {}),
        ...(pushedBranch ? { pushedBranch } : {}),
        capture: {
          eligible: captureAssessment.eligible,
          richness: captureAssessment.richness,
          reasons: captureAssessment.reasons,
        },
        judges: {
          ...(judges?.primary ? { fast: { pass: judges.primary.pass, score: judges.primary.score } } : {}),
          ...(judges?.meta ? { fastMeta: { pass: judges.meta.pass, score: judges.meta.score } } : {}),
          ...(finalJudges?.primary
            ? { final: { pass: finalJudges.primary.pass, score: finalJudges.primary.score } }
            : {}),
          ...(finalJudges?.meta ? { finalMeta: { pass: finalJudges.meta.pass, score: finalJudges.meta.score } } : {}),
        },
      }
      lastAttemptResult = attemptResult

      await persistResultJson({
        path: input.resultJsonPath,
        result: attemptResult,
      })

      if (decision === 'keep') {
        console.log(commit ? `commit=${commit}` : 'commit=skipped')
        if (pushedBranch) {
          console.log(`push=${pushedBranch}`)
        }
        return
      }
    } finally {
      logStatus('cleanup', `removing worktree ${worktree}`)
      await removeWorktree(worktree)
    }
  }

  await persistResultJson({
    path: input.resultJsonPath,
    result:
      lastAttemptResult ??
      ({
        mode: 'repo-harness',
        sliceId,
        slicePath: input.slicePath,
        programPath: input.programPath,
        decision: 'discard',
        changedFiles: [],
        diffStat: '',
        attempt: input.maxAttempts,
        passed: false,
        ...(input.strategyNote ? { strategyNote: input.strategyNote } : {}),
        capture: {
          eligible: false,
          richness: 'minimal',
          reasons: ['no-keep'],
        },
      } satisfies RepoAutoresearchResult),
  })
  console.log('result=no-keep')
}

if (import.meta.main) {
  await main()
}
