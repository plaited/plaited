/**
 * Prepare and optionally launch the first local native-model tuning run.
 *
 * @remarks
 * This wrapper treats training as an external CLI concern. It converts the
 * curated Slice 3 dataset into a trainer-friendly SFT chat dataset, writes a
 * run manifest, and optionally invokes an external trainer command with the
 * prepared paths in the environment.
 *
 * The goal is to make the first local tuning run reproducible without locking
 * the repo to one trainer stack too early.
 *
 * @packageDocumentation
 */

import { mkdir } from 'node:fs/promises'

type TrainingCandidate = {
  id: string
  input: string | string[]
  output: string
  trialNum: number
  assessment: {
    eligible: boolean
    weight: number
    reasons: string[]
  }
  metadata?: Record<string, unknown>
}

type SftExample = {
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  weight: number
  metadata?: Record<string, unknown>
}

type TrainConfig = {
  inputPath: string
  outputDir: string
  datasetPath: string
  manifestPath: string
  baseModel: string
  trainerCommand?: string
  runTrainer: boolean
}

const DEFAULT_INPUT_PATH = './dev-research/native-model/evals/curated-good-outputs.jsonl'
const DEFAULT_BASE_MODEL = process.env.NATIVE_MODEL_BASE_MODEL ?? 'tiiuae/Falcon-H1R-7B-Base'

const createTimestamp = (): string => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

const joinPrompt = (input: string | string[]): string => (Array.isArray(input) ? input.join('\n\n') : input)

export const parseArgs = (args: string[]): TrainConfig => {
  let inputPath = process.env.NATIVE_MODEL_TRAIN_INPUT ?? DEFAULT_INPUT_PATH
  let outputDir =
    process.env.NATIVE_MODEL_TRAIN_OUTPUT_DIR ?? `./dev-research/native-model/training/runs/${createTimestamp()}`
  let baseModel = DEFAULT_BASE_MODEL
  let trainerCommand = process.env.NATIVE_MODEL_TRAINER_CMD
  let runTrainer = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    switch (arg) {
      case '--input':
        inputPath = args[index + 1] ?? inputPath
        index += 1
        break
      case '--output-dir':
        outputDir = args[index + 1] ?? outputDir
        index += 1
        break
      case '--base-model':
        baseModel = args[index + 1] ?? baseModel
        index += 1
        break
      case '--trainer-cmd':
        trainerCommand = args[index + 1] ?? trainerCommand
        index += 1
        break
      case '--run':
        runTrainer = true
        break
    }
  }

  const normalizedOutputDir = outputDir.replace(/\/$/, '')

  return {
    inputPath,
    outputDir: normalizedOutputDir,
    datasetPath: `${normalizedOutputDir}/sft-chat.jsonl`,
    manifestPath: `${normalizedOutputDir}/manifest.json`,
    baseModel,
    ...(trainerCommand ? { trainerCommand } : {}),
    runTrainer,
  }
}

export const toSftExample = (candidate: TrainingCandidate): SftExample => ({
  messages: [
    {
      role: 'user',
      content: joinPrompt(candidate.input),
    },
    {
      role: 'assistant',
      content: candidate.output,
    },
  ],
  weight: candidate.assessment.weight,
  ...(candidate.metadata
    ? {
        metadata: {
          ...candidate.metadata,
          sourceCandidateId: candidate.id,
          trialNum: candidate.trialNum,
        },
      }
    : {
        metadata: {
          sourceCandidateId: candidate.id,
          trialNum: candidate.trialNum,
        },
      }),
})

export const loadCandidates = async (path: string): Promise<TrainingCandidate[]> => {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new Error(`Curated dataset not found: ${path}`)
  }

  const content = (await file.text()).trim()
  if (!content) {
    throw new Error(`Curated dataset is empty: ${path}`)
  }

  return content
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as TrainingCandidate
      } catch (error) {
        throw new Error(`Invalid JSON in curated dataset at line ${index + 1}: ${error}`)
      }
    })
}

export const prepareTrainingRun = async (config: TrainConfig) => {
  const candidates = await loadCandidates(config.inputPath)
  const examples = candidates.map(toSftExample)

  await Bun.write(config.datasetPath, `${examples.map((item) => JSON.stringify(item)).join('\n')}\n`)
  await Bun.write(
    config.manifestPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        inputPath: config.inputPath,
        datasetPath: config.datasetPath,
        baseModel: config.baseModel,
        candidateCount: candidates.length,
        exampleCount: examples.length,
        ...(config.trainerCommand ? { trainerCommand: config.trainerCommand } : {}),
      },
      null,
      2,
    ),
  )

  return {
    candidates,
    examples,
  }
}

const printSummary = ({ config, candidateCount }: { config: TrainConfig; candidateCount: number }) => {
  console.log(`# Native-Model Training Prep`)
  console.log()
  console.log(`- Base model: ${config.baseModel}`)
  console.log(`- Curated input: ${config.inputPath}`)
  console.log(`- SFT dataset: ${config.datasetPath}`)
  console.log(`- Manifest: ${config.manifestPath}`)
  console.log(`- Candidates: ${candidateCount}`)
  console.log()

  if (config.trainerCommand) {
    console.log(`Trainer command:`)
    console.log(
      [
        `BASE_MODEL=${JSON.stringify(config.baseModel)}`,
        `TRAIN_DATASET_PATH=${JSON.stringify(config.datasetPath)}`,
        `TRAIN_OUTPUT_DIR=${JSON.stringify(config.outputDir)}`,
        config.trainerCommand,
      ].join(' '),
    )
  } else {
    console.log(`No trainer command configured.`)
    console.log(`Set NATIVE_MODEL_TRAINER_CMD or pass --trainer-cmd to execute training automatically.`)
  }
}

const runTrainer = async (config: TrainConfig) => {
  if (!config.trainerCommand) {
    throw new Error('Cannot run trainer without NATIVE_MODEL_TRAINER_CMD or --trainer-cmd')
  }

  const command = [
    `BASE_MODEL=${JSON.stringify(config.baseModel)}`,
    `TRAIN_DATASET_PATH=${JSON.stringify(config.datasetPath)}`,
    `TRAIN_OUTPUT_DIR=${JSON.stringify(config.outputDir)}`,
    config.trainerCommand,
  ].join(' ')

  const result = await Bun.$`/bin/zsh -lc ${command}`.cwd(process.cwd()).nothrow()
  if (result.exitCode !== 0) {
    throw new Error(`Trainer command failed with exit code ${result.exitCode}`)
  }
}

if (import.meta.main) {
  const config = parseArgs(process.argv.slice(2))
  await mkdir(config.outputDir, { recursive: true })
  const { candidates } = await prepareTrainingRun(config)
  printSummary({
    config,
    candidateCount: candidates.length,
  })

  if (config.runTrainer) {
    await runTrainer(config)
  }
}
