#!/usr/bin/env bun

import { formatTrialSummary, loadAdapter, loadPrompts, runTrial, summarizeTrialResults } from '../src/improve.ts'
import { grade } from './improve-native-model-validation-grader.ts'

const DEFAULT_K = 2
const DEFAULT_CONCURRENCY = 1
const DEFAULT_BATCH_TIMEOUT = Number(process.env.NATIVE_MODEL_VALIDATION_TIMEOUT_MS ?? 90_000)
const DEFAULT_PROMPTS_PATH = `${import.meta.dir}/../dev-research/native-model/evals/slice-3-validation-prompts.jsonl`
const DEFAULT_RUNS_DIR = `${import.meta.dir}/../dev-research/native-model/evals/runs`

type ValidationDriverOptions = {
  adapterPath?: string
  promptsPath?: string
  outputDir?: string
  runId?: string
  k: number
  concurrency: number
  timeout: number
  progress: boolean
}

const HELP_TEXT = `Usage: bun scripts/improve-native-model-validation.ts --adapter <path> [options]

Required:
  --adapter <path>        Trial adapter module or executable

Optional:
  --prompts <path>        Prompt batch JSONL
  --output-dir <path>     Base directory for run artifacts
  --run-id <value>        Stable run folder name
  --k <number>            Trials per prompt (default: 2)
  --concurrency <number>  Worker concurrency (default: 1)
  --timeout <ms>          Default per-prompt timeout in ms (default: ${DEFAULT_BATCH_TIMEOUT})
  --no-progress           Disable stderr progress logging

Environment:
  NATIVE_MODEL_ADAPTER    Adapter path fallback when --adapter is omitted
  NATIVE_MODEL_VALIDATION_TIMEOUT_MS
                           Timeout fallback when --timeout is omitted
`

const takeValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`)
  }

  return value
}

const parseArgs = (args: string[]): ValidationDriverOptions => {
  const options: ValidationDriverOptions = {
    adapterPath: process.env.NATIVE_MODEL_ADAPTER,
    promptsPath: DEFAULT_PROMPTS_PATH,
    outputDir: DEFAULT_RUNS_DIR,
    k: DEFAULT_K,
    concurrency: DEFAULT_CONCURRENCY,
    timeout: DEFAULT_BATCH_TIMEOUT,
    progress: true,
  }

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]

    if (!arg) {
      continue
    }

    if (arg === '--help' || arg === '-h') {
      console.log(HELP_TEXT)
      process.exit(0)
    }

    if (arg === '--adapter') {
      options.adapterPath = takeValue(args, index, arg)
      index += 1
      continue
    }

    if (arg.startsWith('--adapter=')) {
      options.adapterPath = arg.slice('--adapter='.length)
      continue
    }

    if (arg === '--prompts') {
      options.promptsPath = takeValue(args, index, arg)
      index += 1
      continue
    }

    if (arg.startsWith('--prompts=')) {
      options.promptsPath = arg.slice('--prompts='.length)
      continue
    }

    if (arg === '--output-dir') {
      options.outputDir = takeValue(args, index, arg)
      index += 1
      continue
    }

    if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.slice('--output-dir='.length)
      continue
    }

    if (arg === '--run-id') {
      options.runId = takeValue(args, index, arg)
      index += 1
      continue
    }

    if (arg.startsWith('--run-id=')) {
      options.runId = arg.slice('--run-id='.length)
      continue
    }

    if (arg === '--k') {
      options.k = Number(takeValue(args, index, arg))
      index += 1
      continue
    }

    if (arg.startsWith('--k=')) {
      options.k = Number(arg.slice('--k='.length))
      continue
    }

    if (arg === '--concurrency') {
      options.concurrency = Number(takeValue(args, index, arg))
      index += 1
      continue
    }

    if (arg.startsWith('--concurrency=')) {
      options.concurrency = Number(arg.slice('--concurrency='.length))
      continue
    }

    if (arg === '--timeout') {
      options.timeout = Number(takeValue(args, index, arg))
      index += 1
      continue
    }

    if (arg.startsWith('--timeout=')) {
      options.timeout = Number(arg.slice('--timeout='.length))
      continue
    }

    if (arg === '--no-progress') {
      options.progress = false
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.adapterPath) {
    throw new Error('Adapter path required. Pass --adapter <path> or set NATIVE_MODEL_ADAPTER.')
  }

  if (!options.promptsPath) {
    throw new Error('Prompts path required.')
  }

  if (!options.outputDir) {
    throw new Error('Output directory required.')
  }

  if (!Number.isFinite(options.k) || options.k < 1) {
    throw new Error(`Invalid k value: ${options.k}`)
  }

  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) {
    throw new Error(`Invalid concurrency value: ${options.concurrency}`)
  }

  if (!Number.isFinite(options.timeout) || options.timeout < 1) {
    throw new Error(`Invalid timeout value: ${options.timeout}`)
  }

  return options
}

const createRunId = (): string => {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

const run = async () => {
  const options = parseArgs(Bun.argv.slice(2))
  const runId = options.runId ?? createRunId()
  const adapterPath = options.adapterPath
  const promptsPath = options.promptsPath
  const outputDir = options.outputDir

  if (!adapterPath || !promptsPath || !outputDir) {
    throw new Error('Validation driver requires adapter, prompts, and output directory.')
  }

  const runDir = `${outputDir}/${runId}`
  const resultsPath = `${runDir}/results.jsonl`
  const summaryPath = `${runDir}/summary.md`
  const summaryJsonPath = `${runDir}/summary.json`
  const runPath = `${runDir}/run.json`

  await Bun.$`mkdir -p ${runDir}`.quiet()

  const prompts = await loadPrompts(promptsPath)
  const adapter = await loadAdapter(adapterPath)
  const results = await runTrial({
    adapter,
    prompts,
    grader: grade,
    k: options.k,
    outputPath: resultsPath,
    timeout: options.timeout,
    concurrency: options.concurrency,
    progress: options.progress,
  })

  const summary = summarizeTrialResults(results)
  const summaryMarkdown = formatTrialSummary(summary)
  const runRecord = {
    runId,
    createdAt: new Date().toISOString(),
    adapterPath,
    promptsPath,
    resultsPath,
    summaryPath,
    summaryJsonPath,
    config: {
      k: options.k,
      concurrency: options.concurrency,
      timeout: options.timeout,
      progress: options.progress,
    },
  }

  await Bun.write(summaryPath, summaryMarkdown)
  await Bun.write(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`)
  await Bun.write(runPath, `${JSON.stringify(runRecord, null, 2)}\n`)

  console.log(summaryMarkdown.trimEnd())
  console.log('')
  console.log(`Artifacts:`)
  console.log(`- run: ${runPath}`)
  console.log(`- results: ${resultsPath}`)
  console.log(`- summary: ${summaryPath}`)
  console.log(`- summary json: ${summaryJsonPath}`)
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
