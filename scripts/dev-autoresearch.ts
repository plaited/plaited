#!/usr/bin/env bun

/**
 * Dev autoresearch harness for improving Plaited itself.
 *
 * @remarks
 * This is developer tooling. It is not a shipped runtime feature of Plaited.
 * The harness runs one bounded slice in an isolated worktree, validates the
 * result, and logs keep/revise/discard output via the improve-layer utilities.
 */

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  assessTrainingCapture,
  loadAdapter,
  loadGrader,
  logExperiment,
  type GraderResult,
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
  programPath: string
  quiet: boolean
  slicePath: string
}

type SliceDecision = 'keep' | 'revise' | 'discard'

type ValidationResult = {
  passed: boolean
  notes: string
  command: string[]
}

type ScopeCheckResult = {
  passed: boolean
  notes: string
  allowedPaths: string[]
}

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

const PROJECT_ROOT = join(import.meta.dir, '..')
const TEST_FILE_PATTERN = /(\.spec\.ts|\.test\.ts|_spec\.ts|_test\.ts)$/
const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx)$/
const TEST_DIRECTORIES = ['src/', 'scripts/', 'skills/']
const DEFAULT_ALLOWED_PATHS = ['scripts/', 'src/runtime/', 'src/improve/']
const BOOLEAN_FLAGS = new Set(['--commit', '--dry-run', '--judge', '--quiet'])

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
  return {
    adapterPath: getArg(args, '--adapter', './scripts/codex-cli-adapter.ts')!,
    commit: hasFlag(args, '--commit'),
    dryRun: hasFlag(args, '--dry-run'),
    judge: hasFlag(args, '--judge'),
    judgePath: getArg(args, '--judge-path', './scripts/claude-code-judge.ts')!,
    maxAttempts: Number(getArg(args, '--max-attempts', '1')),
    metaVerifierPath: getArg(args, '--meta-verifier-path', './scripts/claude-haiku-meta-verifier.ts')!,
    programPath: getArg(args, '--program', './dev-research/program.md')!,
    quiet: hasFlag(args, '--quiet'),
    slicePath: slicePath ?? getArg(args, '--slice', './dev-research/runtime-taxonomy/slice-1.md')!,
  }
}

const requireMarkdown = async (path: string, headings: string[]): Promise<string> => {
  const file = Bun.file(path)
  if (!(await file.exists())) throw new Error(`Missing file: ${path}`)
  const text = await file.text()
  for (const heading of headings) {
    if (!text.includes(heading)) throw new Error(`Missing heading "${heading}" in ${path}`)
  }
  return text
}

const createWorktree = async (id: string): Promise<string> => {
  const safeId = id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const base = (await Bun.$`mktemp -d ${join(tmpdir(), `plaited-dev-${safeId}-XXXXXX`)}`.quiet()).text().trim()
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

const commitWorktreeExperiment = async (cwd: string, description: string): Promise<string> => {
  await Bun.$`git add -A`.cwd(cwd).quiet()
  await Bun.$`git commit -m ${{ raw: `experiment: ${description}` }}`.cwd(cwd).quiet()
  return (await Bun.$`git rev-parse --short HEAD`.cwd(cwd).quiet()).text().trim()
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
      notes: `${stdout}${stderr}`.trim().slice(0, 1000) || `Command failed: ${command.join(' ')}`,
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
  return result
    .text()
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(normalizePath)
}

export const getDiffStat = async (cwd: string): Promise<string> => {
  await prepareDiffView(cwd)
  return (await Bun.$`git diff HEAD --stat`.cwd(cwd).nothrow().quiet()).text().trim()
}

export const getPatch = async (cwd: string): Promise<string> => {
  await prepareDiffView(cwd)
  return (await Bun.$`git diff HEAD --no-ext-diff`.cwd(cwd).nothrow().quiet()).text().trim()
}

export const parseSliceScope = (slice: string): string[] => {
  const match = slice.match(/## Scope\s*\n([\s\S]*?)(?:\n## |\s*$)/)
  if (!match) return []
  const section = match[1]
  if (!section) return []

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .flatMap((line) => {
      const spans = [...line.matchAll(/`([^`]+\/[^`]*)`/g)].map((match) => match[1] ?? '')
      if (spans.length > 0) return spans
      return line.includes('/') ? [line.replace(/`/g, '')] : []
    })
    .filter((line) => line.includes('/'))
    .map((line) => line.replace(/\*+$/, ''))
    .map((line) => line.replace(/^\.\//, ''))
    .map((line) => normalizePath(line))
    .filter(Boolean)
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

  const resolved = await Promise.all(imports.map((entry) => resolveImportPath(cwd, filePath, entry.path)))
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
      testBase === fileName
      || testBase === parentName
      || dirname(testPath) === join(moduleDir, 'tests')
      || dirname(testPath).startsWith(join(moduleDir, 'tests'))
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
        if (imports.some((entry) => entry.includes(changedFile.replace(/\.[^.]+$/, '')) || entry === changedFile)) {
          selected.add(testFile)
        }
      }
    }
  }

  return [...selected].sort()
}

const checkScope = (changedFiles: string[], allowedPaths: string[]): ScopeCheckResult => {
  if (changedFiles.length === 0) {
    return {
      passed: false,
      notes: 'No files changed',
      allowedPaths,
    }
  }

  const invalid = changedFiles.filter((file) => !allowedPaths.some((prefix) => file.startsWith(prefix)))
  if (invalid.length > 0) {
    return {
      passed: false,
      notes: `Out-of-scope files changed: ${invalid.join(', ')}`,
      allowedPaths,
    }
  }

  return {
    passed: true,
    notes: `${changedFiles.length} in-scope file(s) changed`,
    allowedPaths,
  }
}

const buildPrompt = (program: string, slice: string) => {
  return [
    'Execution mode:',
    '- Use an autoresearch-style workflow for this bounded development slice.',
    '- The architecture is already decided by the program and slice files below.',
    '- Make one bounded attempt, run validation, and state whether the result should be kept or revised.',
    '',
    'Program:',
    program,
    '',
    'Slice:',
    slice,
  ].join('\n')
}

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

const timestamp = (): string => new Date().toISOString()

const createLogger = (quiet: boolean) => {
  return (stage: string, message: string) => {
    if (quiet) return
    console.log(`[${timestamp()}] ${stage} ${message}`)
  }
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

const main = async () => {
  const input = parseInput(process.argv.slice(2))
  const logStatus = createLogger(input.quiet)

  const program = await requireMarkdown(input.programPath, [
    '## Mission',
    '## Fixed Architecture',
    '## Runtime Taxonomy',
    '## Validation',
  ])
  const slice = await requireMarkdown(input.slicePath, ['# Slice', '## Target', '## Acceptance Criteria'])
  const prompt = buildPrompt(program, slice)
  const adapter = await loadAdapter(input.adapterPath)
  const sliceId = input.slicePath.split('/').at(-1)?.replace('.md', '') ?? 'slice'
  const sliceScope = parseSliceScope(slice)
  const allowedPaths = sliceScope.length > 0 ? sliceScope : DEFAULT_ALLOWED_PATHS

  console.log(`mode=repo-harness adapter=${input.adapterPath} slice=${sliceId} judge=${input.judge}`)
  if (input.dryRun) {
    console.log(`dry-run=true attempts=${input.maxAttempts} commit=${input.commit}`)
    console.log(`program=${input.programPath}`)
    console.log(`slice=${input.slicePath}`)
    console.log(`allowedPaths=${allowedPaths.join(', ')}`)
    return
  }

  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    logStatus('attempt:start', `${attempt}/${input.maxAttempts}`)
    const worktree = await createWorktree(`${sliceId}-${attempt}`)
    logStatus('worktree', worktree)

    try {
      logStatus('adapter:start', 'running implementation adapter')
      const result = await adapter({ prompt, cwd: worktree })
      logStatus('adapter:done', `timedOut=${result.timedOut} exitCode=${result.exitCode ?? 'none'}`)
      logStatus('diff:start', 'collecting changed files and patch')
      const changedFiles = await getChangedFiles(worktree)
      const diffStat = await getDiffStat(worktree)
      const patch = await getPatch(worktree)
      const scope = checkScope(changedFiles, allowedPaths)
      logStatus('scope', `${scope.passed ? 'pass' : 'fail'} changed=${changedFiles.length} allowed=${allowedPaths.join(', ')}`)
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
      logStatus(
        'tests:targeted',
        impactedTests.length > 0
          ? `selected ${impactedTests.length} test file(s)`
          : 'falling back to default test roots',
      )
      const tests = scope.passed && typecheck.passed
        ? await runCheck(
            worktree,
            impactedTests.length > 0
              ? ['bun', 'test', ...impactedTests]
              : ['bun', 'test', ...TEST_DIRECTORIES],
          )
        : {
            passed: false,
            notes: 'Skipped: earlier validation failed',
            command: impactedTests.length > 0 ? ['bun', 'test', ...impactedTests] : ['bun', 'test', ...TEST_DIRECTORIES],
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
      const fullTests = fastPassed
        ? await runCheck(worktree, ['bun', 'test', ...TEST_DIRECTORIES])
        : {
            passed: false,
            notes: 'Skipped: fast validation failed',
            command: ['bun', 'test', ...TEST_DIRECTORIES],
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
      const decision: SliceDecision =
        passed ? 'keep' : changedFiles.length > 0 ? 'revise' : 'discard'

      let commit = ''
      if (passed && input.commit) {
        logStatus('commit:start', 'creating experiment commit')
        commit = await commitWorktreeExperiment(worktree, `dev-autoresearch ${sliceId} attempt ${attempt}`)
        logStatus('commit:done', commit)
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
        },
      })
      logStatus('log:done', decision)

      console.log(`attempt=${attempt} decision=${decision}`)
      console.log(`changed=${changedFiles.length} diff="${diffStat || 'no diff'}"`)
      console.log(
        captureAssessment.eligible
          ? `capture=${captureAssessment.richness}`
          : `capture=skip:${captureAssessment.reasons.join('+') || 'unknown'}`,
      )
      if (finalJudges) {
        console.log(`judge=${finalJudges.primary.pass ? 'pass' : 'fail'} score=${finalJudges.primary.score.toFixed(2)}`)
        if (finalJudges.meta) {
          console.log(`meta=${finalJudges.meta.pass ? 'pass' : 'fail'} score=${finalJudges.meta.score.toFixed(2)}`)
        }
      }

      if (decision === 'keep') {
        console.log(commit ? `commit=${commit}` : 'commit=skipped')
        return
      }
    } finally {
      logStatus('cleanup', `removing worktree ${worktree}`)
      await removeWorktree(worktree)
    }
  }

  process.exit(1)
}

if (import.meta.main) {
  await main()
}
