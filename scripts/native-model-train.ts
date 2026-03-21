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
  maxExampleTokens?: number
  trainerCommand?: string
  runTrainer: boolean
}

const DEFAULT_INPUT_PATH = './dev-research/native-model/evals/curated-good-outputs.jsonl'
const DEFAULT_BASE_MODEL = process.env.NATIVE_MODEL_BASE_MODEL ?? 'tiiuae/Falcon-H1-7B-Base'

const createTimestamp = (): string => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

const joinPrompt = (input: string | string[]): string => (Array.isArray(input) ? input.join('\n\n') : input)
const estimateTokens = (content: string): number => Math.max(1, Math.ceil(content.length / 4))

const splitMarkdownSections = (content: string): string[] => {
  const headingMatches = Array.from(content.matchAll(/^## .+$/gm))
  if (headingMatches.length === 0) {
    return content
      .split(/\n{2,}/)
      .map((section) => section.trim())
      .filter((section) => section.length > 0)
  }

  return headingMatches
    .map((match, index) => {
      const start = match.index ?? 0
      const nextStart = headingMatches[index + 1]?.index ?? content.length
      return content.slice(start, nextStart).trim()
    })
    .filter((section) => section.length > 0)
}

const splitOversizedSection = (section: string, maxTokens: number): string[] => {
  if (estimateTokens(section) <= maxTokens) {
    return [section]
  }

  const paragraphs = section
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (paragraphs.length <= 1) {
    return [section]
  }

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph
    if (current && estimateTokens(next) > maxTokens) {
      chunks.push(current)
      current = paragraph
      continue
    }

    current = next
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

const chunkAssistantContent = (content: string, maxTokens: number): string[] => {
  const sections = splitMarkdownSections(content).flatMap((section) => splitOversizedSection(section, maxTokens))
  const chunks: string[] = []
  let current = ''

  for (const section of sections) {
    const next = current ? `${current}\n\n${section}` : section
    if (current && estimateTokens(next) > maxTokens) {
      chunks.push(current)
      current = section
      continue
    }

    current = next
  }

  if (current) {
    chunks.push(current)
  }

  return chunks.filter((chunk) => chunk.length > 0)
}

const deriveFocusText = (assistantChunk: string, slice: number, totalSlices: number): string => {
  const headings = Array.from(assistantChunk.matchAll(/^## ([^\n]+)$/gm))
    .map((match) => match[1]?.trim())
    .filter((heading): heading is string => typeof heading === 'string' && heading.length > 0)

  if (headings.length > 0) {
    return `\n\nFocus only on these sections for slice ${slice}/${totalSlices}: ${headings.join(', ')}.`
  }

  return `\n\nContinue with only slice ${slice}/${totalSlices} of the answer.`
}

export const shapeSftExample = ({
  example,
  maxExampleTokens,
}: {
  example: SftExample
  maxExampleTokens?: number
}): SftExample[] => {
  if (!maxExampleTokens) {
    return [example]
  }

  const userMessage = example.messages.find((message) => message.role === 'user')
  const assistantMessage = example.messages.find((message) => message.role === 'assistant')

  if (!userMessage || !assistantMessage) {
    return [example]
  }

  const totalTokens = estimateTokens(userMessage.content) + estimateTokens(assistantMessage.content)
  if (totalTokens <= maxExampleTokens) {
    return [example]
  }

  const assistantBudget = maxExampleTokens - estimateTokens(userMessage.content) - 32
  if (assistantBudget < 64) {
    return [example]
  }

  const assistantChunks = chunkAssistantContent(assistantMessage.content, assistantBudget)
  if (assistantChunks.length <= 1) {
    return [example]
  }

  return assistantChunks.map((assistantChunk, index) => ({
    ...example,
    messages: [
      {
        role: 'user',
        content: `${userMessage.content}${deriveFocusText(assistantChunk, index + 1, assistantChunks.length)}`,
      },
      {
        role: 'assistant',
        content: assistantChunk,
      },
    ],
    metadata: {
      ...example.metadata,
      shaping: {
        strategy: 'section_slice',
        slice: index + 1,
        totalSlices: assistantChunks.length,
        maxExampleTokens,
      },
    },
  }))
}

export const parseArgs = (args: string[]): TrainConfig => {
  let inputPath = process.env.NATIVE_MODEL_TRAIN_INPUT ?? DEFAULT_INPUT_PATH
  let outputDir =
    process.env.NATIVE_MODEL_TRAIN_OUTPUT_DIR ?? `./dev-research/native-model/training/runs/${createTimestamp()}`
  let baseModel = DEFAULT_BASE_MODEL
  let maxExampleTokens = process.env.NATIVE_MODEL_MAX_EXAMPLE_TOKENS
    ? Number(process.env.NATIVE_MODEL_MAX_EXAMPLE_TOKENS)
    : undefined
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
      case '--max-example-tokens':
        maxExampleTokens = Number(args[index + 1] ?? maxExampleTokens)
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
    ...(typeof maxExampleTokens === 'number' && Number.isFinite(maxExampleTokens) ? { maxExampleTokens } : {}),
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
  const sourceExamples = candidates.map(toSftExample)
  const examples = sourceExamples.flatMap((example) =>
    shapeSftExample({
      example,
      maxExampleTokens: config.maxExampleTokens,
    }),
  )

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
        sourceExampleCount: sourceExamples.length,
        exampleCount: examples.length,
        ...(typeof config.maxExampleTokens === 'number' ? { maxExampleTokens: config.maxExampleTokens } : {}),
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
  if (typeof config.maxExampleTokens === 'number') {
    console.log(`- Max example tokens: ${config.maxExampleTokens}`)
  }
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
