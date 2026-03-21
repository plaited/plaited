import { dirname, relative, resolve } from 'node:path'

type Summary = {
  passRate: number
  eligibleRate: number
  averageScore: number
  passedTrials: number
  failedTrials: number
  eligibleTrials: number
  ineligibleTrials: number
}

type DeltaSummary = {
  passRate: number
  eligibleRate: number
  averageScore: number
  passedTrials: number
  failedTrials: number
  eligibleTrials: number
  ineligibleTrials: number
}

type Comparison = {
  baseline: Summary
  tuned: Summary
  delta: DeltaSummary
  noRegression: boolean
  improved: boolean
  shouldPromote: boolean
}

type CycleConfig = {
  outputDir: string
  promptsPath: string
  runsDir: string
  model: string
  k: number
  concurrency: number
  timeout: number
  train: boolean
  promote: boolean
  maxSeqLength?: number
  numLayers?: number
  iters?: number
  adapterPath?: string
  baselineRunId: string
  resultJsonPath?: string
  strategyLabel?: string
  tunedRunId: string
}

export type NativeModelCycleResult = {
  mode: 'native-model-bootstrap'
  outputDir: string
  promptsPath: string
  runsDir: string
  model: string
  baselineRunId: string
  tunedRunId: string
  tunedAdapterPath: string
  comparison: Comparison
  strategyLabel?: string
  maxSeqLength?: number
  numLayers?: number
  iters?: number
}

const REPO_ROOT = `${import.meta.dir}/..`
const DEFAULT_RUNS_DIR = `${REPO_ROOT}/dev-research/native-model/evals/runs`
const DEFAULT_TRAIN_OUTPUT_DIR = `${REPO_ROOT}/dev-research/native-model/training/runs/bootstrap-cycle-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`
const DEFAULT_PROMPTS_PATH = `${REPO_ROOT}/dev-research/native-model/evals/slice-3-validation-prompts.jsonl`
const DEFAULT_MODEL = process.env.FALCON_MODEL ?? 'mlx-community/Falcon-H1R-7B-4bit'
const DEFAULT_K = 2
const DEFAULT_CONCURRENCY = 1
const DEFAULT_TIMEOUT = Number(process.env.NATIVE_MODEL_VALIDATION_TIMEOUT_MS ?? '90000')
const DEFAULT_BASELINE_RUN_ID = 'bootstrap-cycle-baseline'
const DEFAULT_TUNED_RUN_ID = 'bootstrap-cycle-tuned'
const ENV_SCHEMA_PATH = `${REPO_ROOT}/.env.schema`
const FALCON_SERVER_URL = 'http://127.0.0.1:8080/v1/models'

const parseNumber = (value: string | undefined, fallback?: number): number | undefined => {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const parseArgs = (args: string[]): CycleConfig => {
  let outputDir = process.env.NATIVE_MODEL_TRAIN_OUTPUT_DIR ?? DEFAULT_TRAIN_OUTPUT_DIR
  let promptsPath = DEFAULT_PROMPTS_PATH
  let runsDir = DEFAULT_RUNS_DIR
  let model = DEFAULT_MODEL
  let k = DEFAULT_K
  let concurrency = DEFAULT_CONCURRENCY
  let timeout = DEFAULT_TIMEOUT
  let train = true
  let promote = false
  let maxSeqLength: number | undefined
  let numLayers: number | undefined
  let iters: number | undefined
  let adapterPath = process.env.FALCON_ADAPTER_PATH
  let baselineRunId = DEFAULT_BASELINE_RUN_ID
  let resultJsonPath: string | undefined
  let strategyLabel: string | undefined
  let tunedRunId = DEFAULT_TUNED_RUN_ID

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]

    switch (arg) {
      case '--output-dir':
        outputDir = next ?? outputDir
        index += 1
        break
      case '--prompts':
        promptsPath = next ?? promptsPath
        index += 1
        break
      case '--runs-dir':
        runsDir = next ?? runsDir
        index += 1
        break
      case '--model':
      case '--base-model':
        model = next ?? model
        index += 1
        break
      case '--k':
        k = parseNumber(next, k) ?? k
        index += 1
        break
      case '--concurrency':
        concurrency = parseNumber(next, concurrency) ?? concurrency
        index += 1
        break
      case '--timeout':
        timeout = parseNumber(next, timeout) ?? timeout
        index += 1
        break
      case '--max-seq-length':
        maxSeqLength = parseNumber(next, maxSeqLength)
        index += 1
        break
      case '--num-layers':
        numLayers = parseNumber(next, numLayers)
        index += 1
        break
      case '--iters':
        iters = parseNumber(next, iters)
        index += 1
        break
      case '--adapter-path':
        adapterPath = next ?? adapterPath
        index += 1
        break
      case '--baseline-run-id':
        baselineRunId = next ?? baselineRunId
        index += 1
        break
      case '--result-json':
        resultJsonPath = next ?? resultJsonPath
        index += 1
        break
      case '--strategy-label':
        strategyLabel = next ?? strategyLabel
        index += 1
        break
      case '--tuned-run-id':
        tunedRunId = next ?? tunedRunId
        index += 1
        break
      case '--skip-train':
        train = false
        break
      case '--promote':
        promote = true
        break
    }
  }

  return {
    outputDir: outputDir.replace(/\/$/, ''),
    promptsPath,
    runsDir: runsDir.replace(/\/$/, ''),
    model,
    k,
    concurrency,
    timeout,
    train,
    promote,
    ...(typeof maxSeqLength === 'number' ? { maxSeqLength } : {}),
    ...(typeof numLayers === 'number' ? { numLayers } : {}),
    ...(typeof iters === 'number' ? { iters } : {}),
    ...(adapterPath ? { adapterPath } : {}),
    baselineRunId,
    ...(resultJsonPath ? { resultJsonPath } : {}),
    ...(strategyLabel ? { strategyLabel } : {}),
    tunedRunId,
  }
}

export const compareSummaries = ({ baseline, tuned }: { baseline: Summary; tuned: Summary }): Comparison => {
  const delta: DeltaSummary = {
    passRate: Number((tuned.passRate - baseline.passRate).toFixed(3)),
    eligibleRate: Number((tuned.eligibleRate - baseline.eligibleRate).toFixed(3)),
    averageScore: Number((tuned.averageScore - baseline.averageScore).toFixed(3)),
    passedTrials: tuned.passedTrials - baseline.passedTrials,
    failedTrials: tuned.failedTrials - baseline.failedTrials,
    eligibleTrials: tuned.eligibleTrials - baseline.eligibleTrials,
    ineligibleTrials: tuned.ineligibleTrials - baseline.ineligibleTrials,
  }

  const noRegression =
    tuned.passRate >= baseline.passRate &&
    tuned.eligibleRate >= baseline.eligibleRate &&
    tuned.averageScore >= baseline.averageScore

  const improved = delta.passRate > 0 || delta.eligibleRate > 0 || delta.averageScore > 0

  return {
    baseline,
    tuned,
    delta,
    noRegression,
    improved,
    shouldPromote: noRegression && improved,
  }
}

export const updateFalconAdapterPath = async ({
  schemaPath,
  adapterPath,
}: {
  schemaPath: string
  adapterPath: string
}) => {
  const schema = await Bun.file(schemaPath).text()
  const normalizedPath = relative(REPO_ROOT, adapterPath)
  const next = schema.replace(
    /^FALCON_ADAPTER_PATH=.*$/m,
    `FALCON_ADAPTER_PATH=./${normalizedPath.replaceAll('\\', '/')}`,
  )

  if (next === schema) {
    throw new Error('FALCON_ADAPTER_PATH not found in .env.schema')
  }

  await Bun.write(schemaPath, next)
}

const printComparison = (comparison: Comparison) => {
  console.log(`# Native-Model Bootstrap Comparison`)
  console.log()
  console.log(`- Baseline pass rate: ${comparison.baseline.passRate.toFixed(3)}`)
  console.log(`- Tuned pass rate: ${comparison.tuned.passRate.toFixed(3)}`)
  console.log(`- Pass rate delta: ${comparison.delta.passRate.toFixed(3)}`)
  console.log(`- Baseline eligible rate: ${comparison.baseline.eligibleRate.toFixed(3)}`)
  console.log(`- Tuned eligible rate: ${comparison.tuned.eligibleRate.toFixed(3)}`)
  console.log(`- Eligible rate delta: ${comparison.delta.eligibleRate.toFixed(3)}`)
  console.log(`- Baseline avg score: ${comparison.baseline.averageScore.toFixed(3)}`)
  console.log(`- Tuned avg score: ${comparison.tuned.averageScore.toFixed(3)}`)
  console.log(`- Avg score delta: ${comparison.delta.averageScore.toFixed(3)}`)
  console.log(`- No regression: ${comparison.noRegression}`)
  console.log(`- Improved: ${comparison.improved}`)
  console.log(`- Promotion candidate: ${comparison.shouldPromote}`)
}

const startFalconServer = async ({
  model,
  adapterPath,
}: {
  model: string
  adapterPath?: string
}): Promise<Bun.Subprocess> => {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    FALCON_MODEL: model,
  }

  if (adapterPath) {
    env.FALCON_ADAPTER_PATH = adapterPath
  } else {
    delete env.FALCON_ADAPTER_PATH
  }

  const bunPath = Bun.which('bun')
  if (!bunPath) {
    throw new Error('bun not found on PATH')
  }

  const proc = Bun.spawn([bunPath, '--no-env-file', 'scripts/falcon-mlx-server.ts'], {
    cwd: REPO_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    env,
  })

  const startedAt = Date.now()
  while (Date.now() - startedAt < 120_000) {
    if (proc.exitCode !== null) {
      throw new Error(`Falcon MLX server exited early with code ${proc.exitCode}`)
    }

    try {
      const response = await fetch(FALCON_SERVER_URL, { signal: AbortSignal.timeout(1000) })
      if (response.ok) {
        return proc
      }
    } catch {
      // server still warming up
    }

    await Bun.sleep(1000)
  }

  proc.kill('SIGTERM')
  throw new Error('Falcon MLX server did not become ready within 120s')
}

const stopProcess = async (proc: Bun.Subprocess) => {
  if (proc.exitCode !== null) {
    return
  }

  proc.kill('SIGTERM')
  await proc.exited
}

const runValidation = async ({
  runId,
  runsDir,
  promptsPath,
  k,
  concurrency,
  timeout,
}: {
  runId: string
  runsDir: string
  promptsPath: string
  k: number
  concurrency: number
  timeout: number
}) => {
  const bunPath = Bun.which('bun')
  if (!bunPath) {
    throw new Error('bun not found on PATH')
  }

  const proc = Bun.spawn(
    [
      bunPath,
      '--no-env-file',
      'scripts/improve-native-model-validation.ts',
      '--adapter',
      './scripts/falcon-h1r-mlx-adapter.ts',
      '--prompts',
      promptsPath,
      '--output-dir',
      runsDir,
      '--run-id',
      runId,
      '--k',
      String(k),
      '--concurrency',
      String(concurrency),
      '--timeout',
      String(timeout),
    ],
    {
      cwd: REPO_ROOT,
      stdout: 'inherit',
      stderr: 'inherit',
      env: process.env as Record<string, string>,
    },
  )

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`Validation run failed with exit code ${exitCode}`)
  }

  const summaryPath = `${runsDir}/${runId}/summary.json`
  return (await Bun.file(summaryPath).json()) as Summary
}

const runTraining = async (config: CycleConfig): Promise<string> => {
  const bunPath = Bun.which('bun')
  if (!bunPath) {
    throw new Error('bun not found on PATH')
  }

  const args = [
    bunPath,
    '--no-env-file',
    'scripts/native-model-train-mlx.ts',
    '--output-dir',
    config.outputDir,
    '--base-model',
    config.model,
    '--run',
  ]

  if (typeof config.maxSeqLength === 'number') {
    args.push('--max-seq-length', String(config.maxSeqLength))
  }

  if (typeof config.numLayers === 'number') {
    args.push('--num-layers', String(config.numLayers))
  }

  if (typeof config.iters === 'number') {
    args.push('--iters', String(config.iters))
  }

  const proc = Bun.spawn(args, {
    cwd: REPO_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env as Record<string, string>,
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`Training run failed with exit code ${exitCode}`)
  }

  return `${resolve(config.outputDir)}/adapters`
}

export const run = async () => {
  const config = parseArgs(Bun.argv.slice(2))
  const tunedAdapterPath = config.train
    ? await runTraining(config)
    : config.adapterPath
      ? resolve(config.adapterPath)
      : undefined
  if (!tunedAdapterPath) {
    throw new Error('Adapter path required when using --skip-train')
  }

  const baselineServer = await startFalconServer({
    model: config.model,
  })

  let baselineSummary: Summary
  try {
    baselineSummary = await runValidation({
      runId: config.baselineRunId,
      runsDir: config.runsDir,
      promptsPath: config.promptsPath,
      k: config.k,
      concurrency: config.concurrency,
      timeout: config.timeout,
    })
  } finally {
    await stopProcess(baselineServer)
  }

  const tunedServer = await startFalconServer({
    model: config.model,
    adapterPath: tunedAdapterPath,
  })

  let tunedSummary: Summary
  try {
    tunedSummary = await runValidation({
      runId: config.tunedRunId,
      runsDir: config.runsDir,
      promptsPath: config.promptsPath,
      k: config.k,
      concurrency: config.concurrency,
      timeout: config.timeout,
    })
  } finally {
    await stopProcess(tunedServer)
  }

  const comparison = compareSummaries({
    baseline: baselineSummary,
    tuned: tunedSummary,
  })

  const result: NativeModelCycleResult = {
    mode: 'native-model-bootstrap',
    outputDir: resolve(config.outputDir),
    promptsPath: resolve(config.promptsPath),
    runsDir: resolve(config.runsDir),
    model: config.model,
    baselineRunId: config.baselineRunId,
    tunedRunId: config.tunedRunId,
    tunedAdapterPath,
    comparison,
    ...(config.strategyLabel ? { strategyLabel: config.strategyLabel } : {}),
    ...(typeof config.maxSeqLength === 'number' ? { maxSeqLength: config.maxSeqLength } : {}),
    ...(typeof config.numLayers === 'number' ? { numLayers: config.numLayers } : {}),
    ...(typeof config.iters === 'number' ? { iters: config.iters } : {}),
  }

  const comparisonPath = `${resolve(config.outputDir)}/bootstrap-comparison.json`
  await Bun.write(`${comparisonPath}`, `${JSON.stringify(comparison, null, 2)}\n`)
  if (config.resultJsonPath) {
    await Bun.$`mkdir -p ${dirname(config.resultJsonPath)}`.quiet()
    await Bun.write(config.resultJsonPath, `${JSON.stringify(result, null, 2)}\n`)
  }
  printComparison(comparison)
  console.log(`- Comparison artifact: ${comparisonPath}`)

  if (config.promote && comparison.shouldPromote) {
    await updateFalconAdapterPath({
      schemaPath: ENV_SCHEMA_PATH,
      adapterPath: tunedAdapterPath,
    })
    console.log(`- Promoted adapter: ${tunedAdapterPath}`)
  } else if (config.promote) {
    console.log(`- Promotion skipped: tuned adapter did not clear the no-regression gate`)
  }
}

if (import.meta.main) {
  await run()
}
