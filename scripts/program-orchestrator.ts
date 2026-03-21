import { basename, join, resolve } from 'node:path'
import { resolveProgramPath } from '../src/improve/protocol.ts'
import type { RepoAutoresearchResult } from './dev-autoresearch.ts'
import { type NativeModelCycleResult, updateFalconAdapterPath } from './native-model-bootstrap-cycle.ts'

type CoordinationPattern = 'depth' | 'fanout'
type OrchestrationLane = 'repo' | 'native-model'

type CliInput = {
  lane: OrchestrationLane
  pattern: CoordinationPattern
  slicePath: string
  programPath: string
  agents: number
  quiet: boolean
  resultJsonPath?: string
  promoteWinner: boolean
  repo: {
    adapterPath: string
    judge: boolean
    judgePath: string
    metaVerifierPath: string
    commit: boolean
    push: boolean
    maxAttempts: number
  }
  native: {
    outputDir: string
    promptsPath?: string
    runsDir?: string
    model?: string
    k?: number
    concurrency?: number
    timeout?: number
    maxSeqLength?: number
    numLayers?: number
    iters?: number
  }
}

type RepoCandidate = {
  label: string
  result: RepoAutoresearchResult
  resultPath: string
}

type NativeCandidate = {
  label: string
  result: NativeModelCycleResult
  resultPath: string
}

type OrchestrationSummary =
  | {
      lane: 'repo'
      pattern: CoordinationPattern
      slicePath: string
      programPath: string
      winner: RepoAutoresearchResult
      candidates: Array<{
        label: string
        decision: string
        score: number
        resultPath: string
      }>
      promoted: boolean
    }
  | {
      lane: 'native-model'
      pattern: CoordinationPattern
      slicePath: string
      programPath: string
      winner: NativeModelCycleResult
      candidates: Array<{
        label: string
        shouldPromote: boolean
        averageScoreDelta: number
        passRateDelta: number
        eligibleRateDelta: number
        resultPath: string
      }>
      promoted: boolean
    }

const REPO_ROOT = `${import.meta.dir}/..`
const DEFAULT_NATIVE_OUTPUT_DIR = `${REPO_ROOT}/dev-research/native-model/training/runs/orchestrated-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`
const DEFAULT_RESULTS_DIR = `${REPO_ROOT}/.memory/evals/orchestrator`
const ENV_SCHEMA_PATH = `${REPO_ROOT}/.env.schema`

const BOOLEAN_FLAGS = new Set(['--judge', '--commit', '--push', '--quiet', '--promote-winner'])

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

const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const parseInput = (args: string[]): CliInput => {
  const [slicePathArg] = getPositionalArgs(args)
  const slicePath = slicePathArg ?? getArg(args, '--slice', './dev-research/runtime-taxonomy/slice-1.md')!
  const lane = (getArg(args, '--lane', 'repo') ?? 'repo') as OrchestrationLane
  const pattern = (getArg(args, '--pattern', 'depth') ?? 'depth') as CoordinationPattern

  return {
    lane,
    pattern,
    slicePath,
    programPath: resolveProgramPath(slicePath, getArg(args, '--program')),
    agents: parseNumber(getArg(args, '--agents')) ?? 3,
    quiet: hasFlag(args, '--quiet'),
    resultJsonPath: getArg(args, '--result-json'),
    promoteWinner: hasFlag(args, '--promote-winner'),
    repo: {
      adapterPath: getArg(args, '--adapter', './scripts/codex-cli-adapter.ts')!,
      judge: hasFlag(args, '--judge'),
      judgePath: getArg(args, '--judge-path', './scripts/claude-code-judge.ts')!,
      metaVerifierPath: getArg(args, '--meta-verifier-path', './scripts/claude-haiku-meta-verifier.ts')!,
      commit: hasFlag(args, '--commit'),
      push: hasFlag(args, '--push'),
      maxAttempts: parseNumber(getArg(args, '--max-attempts')) ?? 1,
    },
    native: {
      outputDir: getArg(args, '--output-dir', DEFAULT_NATIVE_OUTPUT_DIR)!,
      promptsPath: getArg(args, '--prompts'),
      runsDir: getArg(args, '--runs-dir'),
      model: getArg(args, '--model') ?? getArg(args, '--base-model'),
      k: parseNumber(getArg(args, '--k')),
      concurrency: parseNumber(getArg(args, '--concurrency')),
      timeout: parseNumber(getArg(args, '--timeout')),
      maxSeqLength: parseNumber(getArg(args, '--max-seq-length')),
      numLayers: parseNumber(getArg(args, '--num-layers')),
      iters: parseNumber(getArg(args, '--iters')),
    },
  }
}

const ensureDir = async (dir: string) => {
  await Bun.$`mkdir -p ${dir}`.cwd(REPO_ROOT).quiet()
}

const createInternalResultPath = ({ lane, pattern }: { lane: OrchestrationLane; pattern: CoordinationPattern }) =>
  join(DEFAULT_RESULTS_DIR, `${lane}-${pattern}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`)

const getRepoStrategyNotes = (agents: number): string[] => {
  const defaults = [
    'Prefer simplifying existing logic and deleting unnecessary code before adding new abstractions.',
    'Prefer explicit boundary-preserving refactors and clearer composition over cleverness.',
    'Prefer moving repeated or expensive work out of hot paths when relevant, but avoid changing user-visible behavior.',
    'Prefer a conservative implementation with stronger tests and observability around the slice.',
  ]

  return Array.from({ length: agents }, (_, index) => defaults[index % defaults.length]!)
}

type NativeStrategy = {
  label: string
  maxSeqLength?: number
  numLayers?: number
  iters?: number
}

const getNativeStrategies = ({
  agents,
  maxSeqLength,
  numLayers,
  iters,
}: {
  agents: number
  maxSeqLength?: number
  numLayers?: number
  iters?: number
}): NativeStrategy[] => {
  const baseSeq = maxSeqLength ?? 384
  const baseLayers = numLayers ?? 2
  const baseIters = iters ?? 20

  const presets: NativeStrategy[] = [
    {
      label: 'balanced',
      maxSeqLength: baseSeq,
      numLayers: baseLayers,
      iters: baseIters,
    },
    {
      label: 'context-heavy',
      maxSeqLength: Math.max(256, Math.round(baseSeq * 1.5)),
      numLayers: baseLayers,
      iters: baseIters,
    },
    {
      label: 'refinement-heavy',
      maxSeqLength: baseSeq,
      numLayers: baseLayers + 2,
      iters: baseIters * 2,
    },
    {
      label: 'efficiency-heavy',
      maxSeqLength: Math.max(256, Math.round(baseSeq * 0.75)),
      numLayers: Math.max(2, baseLayers - 1),
      iters: baseIters,
    },
  ]

  return Array.from({ length: agents }, (_, index) => presets[index % presets.length]!)
}

const rankRepoResult = (result: RepoAutoresearchResult): number => {
  const decisionRank = result.decision === 'keep' ? 3 : result.decision === 'revise' ? 2 : 1
  const finalScore = result.judges?.final?.score ?? result.judges?.fast?.score ?? 0
  const finalMeta = result.judges?.finalMeta?.score ?? result.judges?.fastMeta?.score ?? 0
  return decisionRank * 1_000 + finalScore * 100 + finalMeta * 10
}

const rankNativeResult = (result: NativeModelCycleResult): number => {
  const promotion = result.comparison.shouldPromote ? 1_000 : 0
  const noRegression = result.comparison.noRegression ? 100 : 0
  return (
    promotion +
    noRegression +
    result.comparison.delta.passRate * 100 +
    result.comparison.delta.eligibleRate * 50 +
    result.comparison.delta.averageScore * 10
  )
}

export const pickRepoWinner = (candidates: RepoCandidate[]): RepoCandidate =>
  [...candidates].sort((left, right) => rankRepoResult(right.result) - rankRepoResult(left.result))[0]!

export const pickNativeWinner = (candidates: NativeCandidate[]): NativeCandidate =>
  [...candidates].sort((left, right) => rankNativeResult(right.result) - rankNativeResult(left.result))[0]!

const ensureMainBranchReady = async () => {
  const status = (await Bun.$`git status --porcelain --untracked-files=no`.cwd(REPO_ROOT).quiet()).text().trim()
  if (status) {
    throw new Error('Main worktree has tracked changes. Clean dev before promoting a fan-out repo winner.')
  }
}

const cherryPickExperimentCommit = async (sha: string) => {
  const result = await Bun.$`git cherry-pick ${sha}`.cwd(REPO_ROOT).nothrow().quiet()
  if (result.exitCode !== 0) {
    throw new Error(`git cherry-pick failed: ${result.stderr.toString().trim()}`)
  }
}

const runRepoDepth = async (input: CliInput, resultPath?: string): Promise<RepoAutoresearchResult> => {
  const bunPath = Bun.which('bun')
  if (!bunPath) throw new Error('bun not found on PATH')

  const args = [
    bunPath,
    '--no-env-file',
    'scripts/dev-autoresearch.ts',
    input.slicePath,
    '--program',
    input.programPath,
  ]
  args.push('--adapter', input.repo.adapterPath, '--max-attempts', String(input.repo.maxAttempts))
  if (input.repo.judge) args.push('--judge')
  if (input.repo.commit) args.push('--commit')
  if (input.repo.push) args.push('--push')
  args.push('--judge-path', input.repo.judgePath, '--meta-verifier-path', input.repo.metaVerifierPath)
  if (resultPath) args.push('--result-json', resultPath)

  const proc = Bun.spawn(args, {
    cwd: REPO_ROOT,
    stdout: input.quiet ? 'pipe' : 'inherit',
    stderr: 'inherit',
    env: process.env as Record<string, string>,
  })
  if (input.quiet && proc.stdout) await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`Repo executor failed with exit code ${exitCode}`)
  }
  if (!resultPath) {
    throw new Error('Missing result path for repo executor')
  }
  return (await Bun.file(resultPath).json()) as RepoAutoresearchResult
}

const runRepoFanout = async (input: CliInput): Promise<OrchestrationSummary> => {
  const runDir = join(DEFAULT_RESULTS_DIR, `repo-${basename(input.slicePath).replace(/\.md$/, '')}-${Date.now()}`)
  await ensureDir(runDir)
  const strategyNotes = getRepoStrategyNotes(input.agents)
  const bunPath = Bun.which('bun')
  if (!bunPath) throw new Error('bun not found on PATH')

  const procs = strategyNotes.map((strategyNote, index) => {
    const label = `agent-${index + 1}`
    const resultPath = join(runDir, `${label}.json`)
    const args = [
      bunPath,
      '--no-env-file',
      'scripts/dev-autoresearch.ts',
      input.slicePath,
      '--program',
      input.programPath,
      '--adapter',
      input.repo.adapterPath,
      '--max-attempts',
      String(input.repo.maxAttempts),
      '--judge-path',
      input.repo.judgePath,
      '--meta-verifier-path',
      input.repo.metaVerifierPath,
      '--result-json',
      resultPath,
      '--strategy-note',
      strategyNote,
    ]
    if (input.repo.judge) args.push('--judge')
    if (input.promoteWinner) args.push('--commit')
    if (input.quiet) args.push('--quiet')

    const proc = Bun.spawn(args, {
      cwd: REPO_ROOT,
      stdout: input.quiet ? 'pipe' : 'inherit',
      stderr: 'inherit',
      env: process.env as Record<string, string>,
    })

    return { label, resultPath, proc }
  })

  for (const { proc } of procs) {
    if (input.quiet && proc.stdout) {
      void new Response(proc.stdout).text()
    }
  }

  const exitCodes = await Promise.all(procs.map(async ({ proc }) => proc.exited))
  const failed = exitCodes.findIndex((code) => code !== 0)
  if (failed !== -1) {
    throw new Error(`Repo fan-out candidate ${procs[failed]!.label} failed with exit code ${exitCodes[failed]}`)
  }

  const candidates: RepoCandidate[] = []
  for (const { label, resultPath } of procs) {
    candidates.push({
      label,
      result: (await Bun.file(resultPath).json()) as RepoAutoresearchResult,
      resultPath,
    })
  }

  const winner = pickRepoWinner(candidates)

  let promoted = false
  if (input.promoteWinner && winner.result.decision === 'keep' && winner.result.commit) {
    await ensureMainBranchReady()
    await cherryPickExperimentCommit(winner.result.commit)
    promoted = true
  }

  return {
    lane: 'repo',
    pattern: 'fanout',
    slicePath: input.slicePath,
    programPath: input.programPath,
    winner: winner.result,
    candidates: candidates.map((candidate) => ({
      label: candidate.label,
      decision: candidate.result.decision,
      score: candidate.result.judges?.final?.score ?? candidate.result.judges?.fast?.score ?? 0,
      resultPath: candidate.resultPath,
    })),
    promoted,
  }
}

const runNativeDepth = async (input: CliInput, resultPath?: string): Promise<NativeModelCycleResult> => {
  const bunPath = Bun.which('bun')
  if (!bunPath) throw new Error('bun not found on PATH')
  const args = [
    bunPath,
    '--no-env-file',
    'scripts/native-model-bootstrap-cycle.ts',
    '--output-dir',
    input.native.outputDir,
    '--result-json',
    resultPath ?? join(DEFAULT_RESULTS_DIR, `native-depth-${Date.now()}.json`),
  ]
  if (input.native.model) args.push('--model', input.native.model)
  if (input.native.promptsPath) args.push('--prompts', input.native.promptsPath)
  if (input.native.runsDir) args.push('--runs-dir', input.native.runsDir)
  if (typeof input.native.k === 'number') args.push('--k', String(input.native.k))
  if (typeof input.native.concurrency === 'number') args.push('--concurrency', String(input.native.concurrency))
  if (typeof input.native.timeout === 'number') args.push('--timeout', String(input.native.timeout))
  if (typeof input.native.maxSeqLength === 'number') args.push('--max-seq-length', String(input.native.maxSeqLength))
  if (typeof input.native.numLayers === 'number') args.push('--num-layers', String(input.native.numLayers))
  if (typeof input.native.iters === 'number') args.push('--iters', String(input.native.iters))
  if (input.promoteWinner) args.push('--promote')

  const proc = Bun.spawn(args, {
    cwd: REPO_ROOT,
    stdout: input.quiet ? 'pipe' : 'inherit',
    stderr: 'inherit',
    env: process.env as Record<string, string>,
  })
  if (input.quiet && proc.stdout) await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`Native-model executor failed with exit code ${exitCode}`)
  }
  const finalPath = args[args.indexOf('--result-json') + 1]!
  return (await Bun.file(finalPath).json()) as NativeModelCycleResult
}

const runNativeFanout = async (input: CliInput): Promise<OrchestrationSummary> => {
  const runDir = join(DEFAULT_RESULTS_DIR, `native-${basename(input.slicePath).replace(/\.md$/, '')}-${Date.now()}`)
  await ensureDir(runDir)
  const strategies = getNativeStrategies({
    agents: input.agents,
    maxSeqLength: input.native.maxSeqLength,
    numLayers: input.native.numLayers,
    iters: input.native.iters,
  })
  const bunPath = Bun.which('bun')
  if (!bunPath) throw new Error('bun not found on PATH')

  const candidates: NativeCandidate[] = []
  for (let index = 0; index < strategies.length; index += 1) {
    const strategy = strategies[index]!
    const label = `agent-${index + 1}-${strategy.label}`
    const resultPath = join(runDir, `${label}.json`)
    const outputDir = join(resolve(input.native.outputDir), label)
    const args = [
      bunPath,
      '--no-env-file',
      'scripts/native-model-bootstrap-cycle.ts',
      '--output-dir',
      outputDir,
      '--result-json',
      resultPath,
      '--strategy-label',
      strategy.label,
      '--baseline-run-id',
      `${label}-baseline`,
      '--tuned-run-id',
      `${label}-tuned`,
    ]

    if (input.native.model) args.push('--model', input.native.model)
    if (input.native.promptsPath) args.push('--prompts', input.native.promptsPath)
    if (input.native.runsDir) args.push('--runs-dir', input.native.runsDir)
    if (typeof input.native.k === 'number') args.push('--k', String(input.native.k))
    if (typeof input.native.concurrency === 'number') args.push('--concurrency', String(input.native.concurrency))
    if (typeof input.native.timeout === 'number') args.push('--timeout', String(input.native.timeout))
    if (typeof strategy.maxSeqLength === 'number') args.push('--max-seq-length', String(strategy.maxSeqLength))
    if (typeof strategy.numLayers === 'number') args.push('--num-layers', String(strategy.numLayers))
    if (typeof strategy.iters === 'number') args.push('--iters', String(strategy.iters))

    const proc = Bun.spawn(args, {
      cwd: REPO_ROOT,
      stdout: input.quiet ? 'pipe' : 'inherit',
      stderr: 'inherit',
      env: process.env as Record<string, string>,
    })

    if (input.quiet && proc.stdout) {
      void new Response(proc.stdout).text()
    }

    const exitCode = await proc.exited
    if (exitCode !== 0) {
      throw new Error(`Native-model candidate ${label} failed with exit code ${exitCode}`)
    }

    candidates.push({
      label,
      result: (await Bun.file(resultPath).json()) as NativeModelCycleResult,
      resultPath,
    })
  }

  const winner = pickNativeWinner(candidates)

  let promoted = false
  if (input.promoteWinner && winner.result.comparison.shouldPromote) {
    await updateFalconAdapterPath({
      schemaPath: ENV_SCHEMA_PATH,
      adapterPath: winner.result.tunedAdapterPath,
    })
    promoted = true
  }

  return {
    lane: 'native-model',
    pattern: 'fanout',
    slicePath: input.slicePath,
    programPath: input.programPath,
    winner: winner.result,
    candidates: candidates.map((candidate) => ({
      label: candidate.label,
      shouldPromote: candidate.result.comparison.shouldPromote,
      averageScoreDelta: candidate.result.comparison.delta.averageScore,
      passRateDelta: candidate.result.comparison.delta.passRate,
      eligibleRateDelta: candidate.result.comparison.delta.eligibleRate,
      resultPath: candidate.resultPath,
    })),
    promoted,
  }
}

const printSummary = (summary: OrchestrationSummary) => {
  console.log(`# Program Orchestrator`)
  console.log()
  console.log(`- Lane: ${summary.lane}`)
  console.log(`- Pattern: ${summary.pattern}`)
  console.log(`- Slice: ${summary.slicePath}`)
  console.log(`- Program: ${summary.programPath}`)
  console.log(`- Promoted winner: ${summary.promoted}`)
  if (summary.lane === 'repo') {
    console.log(`- Winner decision: ${summary.winner.decision}`)
    console.log(
      `- Winner score: ${(summary.winner.judges?.final?.score ?? summary.winner.judges?.fast?.score ?? 0).toFixed(3)}`,
    )
  } else {
    console.log(`- Winner should promote: ${summary.winner.comparison.shouldPromote}`)
    console.log(`- Winner avg score delta: ${summary.winner.comparison.delta.averageScore.toFixed(3)}`)
  }
}

const main = async () => {
  const input = parseInput(Bun.argv.slice(2))
  let summary: OrchestrationSummary

  if (input.pattern === 'depth') {
    if (input.lane === 'repo') {
      const resultPath = createInternalResultPath({ lane: 'repo', pattern: 'depth' })
      await ensureDir(dirnameSafe(resultPath))
      const result = await runRepoDepth(input, resultPath)
      summary = {
        lane: 'repo',
        pattern: 'depth',
        slicePath: input.slicePath,
        programPath: input.programPath,
        winner: result,
        candidates: [
          {
            label: 'depth',
            decision: result.decision,
            score: result.judges?.final?.score ?? result.judges?.fast?.score ?? 0,
            resultPath,
          },
        ],
        promoted: Boolean(result.pushedBranch),
      }
    } else {
      const resultPath = createInternalResultPath({ lane: 'native-model', pattern: 'depth' })
      await ensureDir(dirnameSafe(resultPath))
      const result = await runNativeDepth(input, resultPath)
      summary = {
        lane: 'native-model',
        pattern: 'depth',
        slicePath: input.slicePath,
        programPath: input.programPath,
        winner: result,
        candidates: [
          {
            label: 'depth',
            shouldPromote: result.comparison.shouldPromote,
            averageScoreDelta: result.comparison.delta.averageScore,
            passRateDelta: result.comparison.delta.passRate,
            eligibleRateDelta: result.comparison.delta.eligibleRate,
            resultPath,
          },
        ],
        promoted: input.promoteWinner && result.comparison.shouldPromote,
      }
    }
  } else {
    summary = input.lane === 'repo' ? await runRepoFanout(input) : await runNativeFanout(input)
  }

  if (input.resultJsonPath) {
    await Bun.write(input.resultJsonPath, `${JSON.stringify(summary, null, 2)}\n`)
  }
  printSummary(summary)
}

const dirnameSafe = (path: string) => {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index === -1 ? '.' : normalized.slice(0, index)
}

if (import.meta.main) {
  await main()
}
