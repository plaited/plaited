#!/usr/bin/env bun
import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'
import { type HeldoutRow, HeldoutRowSchema, ModnetJudgeAblationRowSchema } from './modnet-judge-ablation.schemas.ts'
import { buildJudgePrompt, toGraderResult as toInclusionJudgeResult } from './modnet-raw-card-inclusion-judge.ts'
import { buildMetaPrompt, toGraderResult as toInclusionMetaResult } from './modnet-raw-card-inclusion-meta-verifier.ts'
import { buildOpenRouterHeaders, extractOpenRouterText } from './openrouter-adapter.ts'

type JudgeModelLabel =
  | 'minimax-m2.7'
  | 'minimax-m2.5'
  | 'glm-5'
  | 'glm-5-turbo'
  | 'kimi-k2.5'
  | 'deepseek-v3.2'
  | 'nemotron-3-super-120b-a12b'
  | 'mistral-small-2603'
  | 'qwen3-coder-prefilter'

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

type InclusionJudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  inclusionDecision: 'retain' | 'retain_low_priority' | 'discard'
  modernAnalog: string
  coreUserJob: string
  whyRelevant: string
  likelyPatternFamily: string
  likelyStructure: string
  searchQuerySeed: string
  dimensions?: {
    relevance: number
    corollaryFit: number
    moduleShape: number
    restraint: number
  }
}

type InclusionMetaOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: {
    consistency: number
    risk: number
    confidence: number
  }
}

const coerceJudgeOutput = (value: Partial<InclusionJudgeOutput>): InclusionJudgeOutput => ({
  pass: typeof value.pass === 'boolean' ? value.pass : false,
  score: normalizeProbabilityValue(value.score) ?? 0,
  reasoning: typeof value.reasoning === 'string' ? value.reasoning : 'Model returned an incomplete judge response.',
  inclusionDecision:
    value.inclusionDecision === 'retain' ||
    value.inclusionDecision === 'retain_low_priority' ||
    value.inclusionDecision === 'discard'
      ? value.inclusionDecision
      : 'discard',
  modernAnalog: typeof value.modernAnalog === 'string' ? value.modernAnalog : '',
  coreUserJob: typeof value.coreUserJob === 'string' ? value.coreUserJob : '',
  whyRelevant:
    typeof value.whyRelevant === 'string'
      ? value.whyRelevant
      : 'The model did not provide a complete structured relevance explanation.',
  likelyPatternFamily: typeof value.likelyPatternFamily === 'string' ? value.likelyPatternFamily : '',
  likelyStructure: typeof value.likelyStructure === 'string' ? value.likelyStructure : '',
  searchQuerySeed: typeof value.searchQuerySeed === 'string' ? value.searchQuerySeed : '',
  ...(value.dimensions ? { dimensions: normalizeRecordNumbers(value.dimensions) } : {}),
})

const coerceMetaOutput = (value: Partial<InclusionMetaOutput>): InclusionMetaOutput => ({
  pass: typeof value.pass === 'boolean' ? value.pass : false,
  score: normalizeProbabilityValue(value.score) ?? 0,
  reasoning:
    typeof value.reasoning === 'string' ? value.reasoning : 'Model returned an incomplete meta-verifier response.',
  ...(value.dimensions ? { dimensions: normalizeRecordNumbers(value.dimensions) } : {}),
})

const normalizeProbabilityValue = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  if (value >= 0 && value <= 1) return value
  if (value > 1 && value <= 100) return Math.max(0, Math.min(1, value / 100))
  return Math.max(0, Math.min(1, value))
}

const normalizeRecordNumbers = <T extends Record<string, unknown>>(record: T | undefined): T | undefined => {
  if (!record) return undefined
  const normalizedEntries = Object.entries(record).map(([key, value]) => [
    key,
    normalizeProbabilityValue(value) ?? value,
  ])
  return Object.fromEntries(normalizedEntries) as T
}

const normalizeJudgeOutput = (result: Partial<InclusionJudgeOutput>): InclusionJudgeOutput => coerceJudgeOutput(result)

const normalizeMetaOutput = (result: Partial<InclusionMetaOutput>): InclusionMetaOutput => coerceMetaOutput(result)

const buildOpenRouterJudgeFailureResult = (reason: string) =>
  toInclusionJudgeResult({
    pass: false,
    score: 0,
    reasoning: `OpenRouter judge error: ${reason}`,
    inclusionDecision: 'discard',
    modernAnalog: '',
    coreUserJob: '',
    whyRelevant: 'The judge failed before returning a structured inclusion result.',
    likelyPatternFamily: '',
    likelyStructure: '',
    searchQuerySeed: '',
  })

const buildOpenRouterMetaFailureResult = (reason: string) =>
  toInclusionMetaResult({
    pass: false,
    score: 0,
    reasoning: `OpenRouter meta verifier error: ${reason}`,
  })

const DEFAULT_INPUT_PATH =
  '/Users/eirby/Workspace/plaited/dev-research/modnet/catalog/modnet-judge-ablation-heldout.raw-card-inclusion.jsonl'
const DEFAULT_OUTPUT_PATH = '/tmp/modnet-judge-ablation.jsonl'
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const PRIMARY_MODEL_MAP: Record<Exclude<JudgeModelLabel, 'qwen3-coder-prefilter'>, string> = {
  'minimax-m2.7': 'minimax/minimax-m2.7',
  'minimax-m2.5': 'minimax/minimax-m2.5',
  'glm-5': 'z-ai/glm-5',
  'glm-5-turbo': 'z-ai/glm-5-turbo',
  'kimi-k2.5': 'moonshotai/kimi-k2.5',
  'deepseek-v3.2': 'deepseek/deepseek-v3.2',
  'nemotron-3-super-120b-a12b': 'nvidia/nemotron-3-super-120b-a12b',
  'mistral-small-2603': 'mistralai/mistral-small-2603',
}

const META_MODEL_MAP: Record<Exclude<JudgeModelLabel, 'qwen3-coder-prefilter'>, string> = {
  'minimax-m2.7': 'minimax/minimax-m2.7',
  'minimax-m2.5': 'minimax/minimax-m2.5',
  'glm-5': 'z-ai/glm-5',
  'glm-5-turbo': 'z-ai/glm-5-turbo',
  'kimi-k2.5': 'moonshotai/kimi-k2.5',
  'deepseek-v3.2': 'deepseek/deepseek-v3.2',
  'nemotron-3-super-120b-a12b': 'nvidia/nemotron-3-super-120b-a12b',
  'mistral-small-2603': 'mistralai/mistral-small-2603',
}

const parseArgs = (args: string[]) => {
  let inputPath = DEFAULT_INPUT_PATH
  let outputPath = DEFAULT_OUTPUT_PATH
  let label = 'glm-minimax-m2-5'
  let primaryJudge: JudgeModelLabel = 'glm-5'
  let metaVerifier: JudgeModelLabel = 'minimax-m2.5'
  let limit: number | undefined
  let concurrency = 5
  let quiet = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--input' && args[index + 1]) {
      inputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--label' && args[index + 1]) {
      label = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--primary-judge' && args[index + 1]) {
      primaryJudge = args[index + 1]! as JudgeModelLabel
      index += 1
      continue
    }
    if (arg === '--meta-verifier' && args[index + 1]) {
      metaVerifier = args[index + 1]! as JudgeModelLabel
      index += 1
      continue
    }
    if (arg === '--limit' && args[index + 1]) {
      limit = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--concurrency' && args[index + 1]) {
      concurrency = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--quiet') {
      quiet = true
    }
  }

  return { inputPath, outputPath, label, primaryJudge, metaVerifier, limit, concurrency, quiet }
}

const loadHeldoutRows = async (path: string): Promise<HeldoutRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => HeldoutRowSchema.parse(JSON.parse(line)))
}

const extractJsonObject = (value: string): string => {
  const fenced = value.match(/```json\s*([\s\S]*?)```/u)
  if (fenced?.[1]) return fenced[1].trim()
  const objectMatch = value.match(/\{[\s\S]*\}/u)
  if (objectMatch?.[0]) return objectMatch[0]
  throw new Error('No JSON object found in OpenRouter output')
}

const runOpenRouterStructured = async <T>({
  model,
  prompt,
}: {
  model: string
  prompt: string
}): Promise<{ parsed: T; spendUsd: number }> => {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildOpenRouterHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Return only a single JSON object that satisfies the user request. Do not include markdown fences or commentary.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as OpenRouterResponse & {
    usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number }
  }
  const text = extractOpenRouterText(payload)
  const parsed = JSON.parse(extractJsonObject(text)) as T
  const spendUsd = typeof payload.usage?.cost === 'number' ? payload.usage.cost : 0
  return { parsed, spendUsd }
}

const buildOpenRouterJudgePrompt = ({
  task,
  candidateOutput,
  metadata,
}: {
  task: string
  candidateOutput: string
  metadata: Record<string, unknown>
}) =>
  `${buildJudgePrompt({
    task,
    output: candidateOutput,
    metadata,
  })}

Return only JSON with this shape:
{
  "pass": boolean,
  "score": number,
  "reasoning": string,
  "inclusionDecision": "retain" | "retain_low_priority" | "discard",
  "modernAnalog": string,
  "coreUserJob": string,
  "whyRelevant": string,
  "likelyPatternFamily": string,
  "likelyStructure": string,
  "searchQuerySeed": string,
  "dimensions": {
    "relevance": number,
    "corollaryFit": number,
    "moduleShape": number,
    "restraint": number
  }
}`

const buildOpenRouterMetaPrompt = ({
  task,
  judgeOutput,
  metadata,
}: {
  task: string
  judgeOutput: string
  metadata: Record<string, unknown>
}) =>
  `${buildMetaPrompt({
    task,
    output: judgeOutput,
    metadata,
  })}

Return only JSON with this shape:
{
  "pass": boolean,
  "score": number,
  "reasoning": string,
  "dimensions": {
    "consistency": number,
    "risk": number,
    "confidence": number
  }
}`

const logProgress = (enabled: boolean, message: string) => {
  if (enabled) {
    console.error(`[modnet-judge-ablation] ${message}`)
  }
}

const runConcurrent = async <T>({
  items,
  concurrency,
  worker,
}: {
  items: HeldoutRow[]
  concurrency: number
  worker: (item: HeldoutRow, index: number) => Promise<T>
}) => {
  let nextIndex = 0

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      const item = items[currentIndex]
      if (!item) return
      await worker(item, currentIndex)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()))
}

const main = async () => {
  const { inputPath, outputPath, label, primaryJudge, metaVerifier, limit, concurrency, quiet } = parseArgs(
    Bun.argv.slice(2),
  )
  const allRows = await loadHeldoutRows(inputPath)
  const rows = typeof limit === 'number' ? allRows.slice(0, limit) : allRows
  await resetJsonlOutput(outputPath)
  let recommended = 0
  let writeQueue = Promise.resolve()

  await runConcurrent({
    items: rows,
    concurrency,
    worker: async (row, index) => {
      const startedAt = Date.now()

      try {
        if (row.taskKind !== 'raw-card-inclusion') {
          throw new Error(`Unsupported heldout task kind for current runner: ${row.taskKind}`)
        }

        logProgress(!quiet, `row ${index + 1}/${rows.length}: ${row.id} judge`)

        let judgeResult: ReturnType<typeof buildOpenRouterJudgeFailureResult>
        let judgeSpendUsd = 0

        try {
          const judgeInvocation = await runOpenRouterStructured<InclusionJudgeOutput>({
            model: PRIMARY_MODEL_MAP[primaryJudge as keyof typeof PRIMARY_MODEL_MAP],
            prompt: buildOpenRouterJudgePrompt({
              task: row.task,
              candidateOutput: row.candidateOutput,
              metadata: row.metadata,
            }),
          })
          judgeResult = toInclusionJudgeResult(normalizeJudgeOutput(judgeInvocation.parsed))
          judgeSpendUsd = judgeInvocation.spendUsd
        } catch (error) {
          judgeResult = buildOpenRouterJudgeFailureResult(error instanceof Error ? error.message : String(error))
        }

        logProgress(!quiet, `row ${index + 1}/${rows.length}: ${row.id} meta`)

        let metaResult: ReturnType<typeof buildOpenRouterMetaFailureResult>
        let metaSpendUsd = 0

        try {
          const metaInvocation = await runOpenRouterStructured<InclusionMetaOutput>({
            model: META_MODEL_MAP[metaVerifier as keyof typeof META_MODEL_MAP],
            prompt: buildOpenRouterMetaPrompt({
              task: row.task,
              judgeOutput: JSON.stringify(judgeResult, null, 2),
              metadata: {
                ...row.metadata,
                judgeResult,
              },
            }),
          })
          metaResult = toInclusionMetaResult(normalizeMetaOutput(metaInvocation.parsed))
          metaSpendUsd = metaInvocation.spendUsd
        } catch (error) {
          metaResult = buildOpenRouterMetaFailureResult(error instanceof Error ? error.message : String(error))
        }

        const runtimeMs = Date.now() - startedAt

        const ablationRow = ModnetJudgeAblationRowSchema.parse({
          heldout: row,
          label,
          pair: {
            primaryJudge,
            metaVerifier,
          },
          judgeResult,
          metaResult,
          recommended: judgeResult.pass && metaResult.pass,
          runtimeMs,
          spendUsd: {
            judge: judgeSpendUsd,
            meta: metaSpendUsd,
            total: judgeSpendUsd + metaSpendUsd,
          },
        })

        if (ablationRow.recommended) recommended += 1
        writeQueue = writeQueue.then(() => appendJsonlRow(outputPath, ablationRow))
        await writeQueue
      } catch (error) {
        const runtimeMs = Date.now() - startedAt
        const ablationRow = ModnetJudgeAblationRowSchema.parse({
          heldout: row,
          label,
          pair: {
            primaryJudge,
            metaVerifier,
          },
          judgeResult: buildOpenRouterJudgeFailureResult(error instanceof Error ? error.message : String(error)),
          metaResult: buildOpenRouterMetaFailureResult('Skipped because the row failed before meta verification.'),
          recommended: false,
          runtimeMs,
          spendUsd: {
            judge: 0,
            meta: 0,
            total: 0,
          },
        })

        writeQueue = writeQueue.then(() => appendJsonlRow(outputPath, ablationRow))
        await writeQueue
      }
    },
  })

  await writeQueue

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        label,
        totalRows: rows.length,
        concurrency,
        recommended,
      },
      null,
      2,
    ),
  )
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
