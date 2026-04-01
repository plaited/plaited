#!/usr/bin/env bun

import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { extractFirstJsonObject, extractTaggedJsonObject } from './json-extract.ts'
import { PiRpcClient } from './modnet-pi-rpc.ts'
import {
  buildGeneratorPrompt,
  buildJudgePrompt,
  buildPiPlanPrompt,
  type ContextBundle,
  type GeneratedCandidate,
  loadContextBundle,
  type PiPlan,
  type ReviewPrompt,
  type WorkflowMode,
} from './modnet-pi-workflow.ts'
import { runStructuredLlmQuery } from './structured-llm-query.ts'

type JudgedCandidate = {
  pass: boolean
  score: number
  rationale: string
}

type AttemptRecord = {
  workerIndex: number
  attemptIndex: number
  strategyNote: string
  plan: PiPlan | null
  candidate: GeneratedCandidate | null
  judge: JudgedCandidate | null
  error: string | null
  at: string
}

type WorkerWinner = {
  workerIndex: number
  bestScore: number
  bestAttemptIndex: number
  candidate: GeneratedCandidate
  judge: JudgedCandidate
  strategyNote: string
}

type WorkerInput = {
  programPath: string
  contextPaths?: string[]
  reviewDir: string
  prompt: ReviewPrompt
  mode?: WorkflowMode
  feedback: string
  roundNumber: number
  workerIndex: number
  attemptsPerWorker: number
  retryAttempts: number
  strategyNote: string
  generatorModel: string
  judgeModel: string
}

const PiPlanSchema = z.object({
  rewriteBrief: z.string().min(1),
  rationale: z.string().min(1),
  strategyLabel: z.string().min(1),
})

const GeneratedCandidateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'prompt', 'mss', 'note'],
  properties: {
    title: { type: 'string' },
    prompt: { type: 'string' },
    note: { type: 'string' },
    mss: {
      type: 'object',
      additionalProperties: false,
      required: ['contentType', 'structure', 'mechanics', 'boundary', 'scale'],
      properties: {
        contentType: { type: 'string' },
        structure: { type: 'string' },
        mechanics: {
          type: 'array',
          items: { type: 'string' },
        },
        boundary: { type: 'string' },
        scale: { type: 'number' },
      },
    },
  },
} as const

const JudgeResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pass', 'score', 'rationale'],
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number' },
    rationale: { type: 'string' },
  },
} as const

const buildFallbackPiPlan = ({ input, attemptIndex }: { input: WorkerInput; attemptIndex: number }): PiPlan => ({
  rewriteBrief:
    input.mode === 'derive'
      ? `Derive a smaller-scale standalone child prompt from the source prompt. ${input.feedback} Keep the result concrete, reusable, and bounded. Use this attempt bias: ${input.strategyNote}.`
      : `Rewrite the source prompt into a clearer standalone training prompt. ${input.feedback} Keep it concrete, reusable, and bounded. Use this attempt bias: ${input.strategyNote}.`,
  rationale: 'Fallback strategy brief used because Pi did not return parseable structured output.',
  strategyLabel: `fallback-worker-${input.workerIndex}-attempt-${attemptIndex}`,
})

const delay = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const promptArtifactDir = (reviewDir: string, promptId: string) => join(reviewDir, 'artifacts', promptId)
const roundDir = (reviewDir: string, promptId: string, roundNumber: number) =>
  join(promptArtifactDir(reviewDir, promptId), `round-${roundNumber.toString().padStart(2, '0')}`)
const workerDir = (reviewDir: string, promptId: string, roundNumber: number, workerIndex: number) =>
  join(roundDir(reviewDir, promptId, roundNumber), `worker-${workerIndex.toString().padStart(2, '0')}`)
const attemptPath = (
  reviewDir: string,
  promptId: string,
  roundNumber: number,
  workerIndex: number,
  attemptIndex: number,
) =>
  join(
    workerDir(reviewDir, promptId, roundNumber, workerIndex),
    `attempt-${attemptIndex.toString().padStart(2, '0')}.json`,
  )
const workerWinnerPath = (reviewDir: string, promptId: string, roundNumber: number, workerIndex: number) =>
  join(workerDir(reviewDir, promptId, roundNumber, workerIndex), 'winner.json')
const roundManifestPath = (reviewDir: string, promptId: string, roundNumber: number) =>
  join(roundDir(reviewDir, promptId, roundNumber), 'round.json')

const ensureArtifactDir = async (path: string) => {
  await Bun.$`mkdir -p ${path}`.quiet()
}

const appendError = async (reviewDir: string, row: Record<string, unknown>) => {
  const errorsPath = join(reviewDir, 'errors.jsonl')
  await ensureArtifactDir(reviewDir)
  await appendFile(errorsPath, `${JSON.stringify(row)}\n`)
}

const loadRoundManifest = async (
  reviewDir: string,
  promptId: string,
  roundNumber: number,
): Promise<Record<string, unknown> | null> => {
  const path = roundManifestPath(reviewDir, promptId, roundNumber)
  if (!(await Bun.file(path).exists())) return null
  return (await Bun.file(path).json()) as Record<string, unknown>
}

const loadAttemptRecord = async (
  reviewDir: string,
  promptId: string,
  roundNumber: number,
  workerIndex: number,
  attemptIndex: number,
): Promise<AttemptRecord | null> => {
  const path = attemptPath(reviewDir, promptId, roundNumber, workerIndex, attemptIndex)
  if (!(await Bun.file(path).exists())) return null
  return (await Bun.file(path).json()) as AttemptRecord
}

const writeAttemptRecord = async (reviewDir: string, promptId: string, roundNumber: number, record: AttemptRecord) => {
  const dir = workerDir(reviewDir, promptId, roundNumber, record.workerIndex)
  await ensureArtifactDir(dir)
  await Bun.write(
    attemptPath(reviewDir, promptId, roundNumber, record.workerIndex, record.attemptIndex),
    `${JSON.stringify(record, null, 2)}\n`,
  )
}

const writeWorkerWinner = async (reviewDir: string, promptId: string, roundNumber: number, winner: WorkerWinner) => {
  const dir = workerDir(reviewDir, promptId, roundNumber, winner.workerIndex)
  await ensureArtifactDir(dir)
  await Bun.write(
    workerWinnerPath(reviewDir, promptId, roundNumber, winner.workerIndex),
    `${JSON.stringify(winner, null, 2)}\n`,
  )
}

const runPiPlanWithRetry = async ({
  input,
  context,
  attemptIndex,
}: {
  input: WorkerInput
  context: ContextBundle
  attemptIndex: number
}): Promise<PiPlan> => {
  let lastError: unknown = null

  for (let retry = 1; retry <= input.retryAttempts; retry += 1) {
    const client = new PiRpcClient()

    try {
      const result = await client.prompt(
        buildPiPlanPrompt({
          mode: input.mode ?? 'refine',
          context,
          prompt: input.prompt,
          feedback: input.feedback,
          strategyNote: input.strategyNote,
          workerIndex: input.workerIndex,
          attemptIndex,
        }),
      )
      const jsonText =
        extractTaggedJsonObject({
          text: result.text,
          tag: 'json',
        }) ?? extractFirstJsonObject(result.text)
      if (!jsonText) {
        throw new Error('Unable to parse JSON string')
      }
      const parsed = JSON.parse(jsonText) as unknown
      const validated = PiPlanSchema.safeParse(parsed)
      if (!validated.success) {
        throw new Error(validated.error.message)
      }
      await client.close()
      return validated.data
    } catch (error) {
      lastError = error
      await appendError(input.reviewDir, {
        id: input.prompt.id,
        source: input.prompt.source,
        action: 'pi-plan',
        workerIndex: input.workerIndex,
        attemptIndex,
        retry,
        error: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      })
      await client.close()
      if (retry < input.retryAttempts) {
        await delay(500 * 2 ** (retry - 1))
      }
    }
  }

  await appendError(input.reviewDir, {
    id: input.prompt.id,
    source: input.prompt.source,
    action: 'pi-plan-fallback',
    workerIndex: input.workerIndex,
    attemptIndex,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    at: new Date().toISOString(),
  })

  return buildFallbackPiPlan({
    input,
    attemptIndex,
  })
}

const generateCandidate = async ({
  input,
  context,
  plan,
}: {
  input: WorkerInput
  context: ContextBundle
  plan: PiPlan
}): Promise<GeneratedCandidate> => {
  const result = await runStructuredLlmQuery<GeneratedCandidate>({
    model: input.generatorModel,
    prompt: buildGeneratorPrompt({
      mode: input.mode ?? 'refine',
      context,
      prompt: input.prompt,
      feedback: input.feedback,
      plan,
    }),
    schema: GeneratedCandidateSchema,
  })

  if (!result.ok) {
    throw new Error(result.reason)
  }

  return result.value
}

const judgeCandidate = async ({
  input,
  context,
  candidate,
}: {
  input: WorkerInput
  context: ContextBundle
  candidate: GeneratedCandidate
}): Promise<JudgedCandidate> => {
  const result = await runStructuredLlmQuery<JudgedCandidate>({
    model: input.judgeModel,
    prompt: buildJudgePrompt({
      mode: input.mode ?? 'refine',
      context,
      prompt: input.prompt,
      feedback: input.feedback,
      candidate,
    }),
    schema: JudgeResultSchema,
  })

  if (!result.ok) {
    throw new Error(result.reason)
  }

  return {
    ...result.value,
    score: Math.max(0, Math.min(1, result.value.score)),
  }
}

const main = async () => {
  const inputPath = Bun.argv[2]
  if (!inputPath) {
    console.error('Usage: bun scripts/modnet-pi-round-worker.ts <input.json>')
    process.exit(1)
  }

  const input = (await Bun.file(inputPath).json()) as WorkerInput
  const context: ContextBundle = await loadContextBundle(input.contextPaths)

  const manifest = await loadRoundManifest(input.reviewDir, input.prompt.id, input.roundNumber)
  if (!manifest) {
    throw new Error('Missing round manifest')
  }

  let best: WorkerWinner | null = null
  for (let attemptIndex = 1; attemptIndex <= input.attemptsPerWorker; attemptIndex += 1) {
    const existing = await loadAttemptRecord(
      input.reviewDir,
      input.prompt.id,
      input.roundNumber,
      input.workerIndex,
      attemptIndex,
    )
    if (existing) {
      if (existing.candidate && existing.judge && !existing.error) {
        const winner: WorkerWinner = {
          workerIndex: input.workerIndex,
          bestScore: existing.judge.score,
          bestAttemptIndex: attemptIndex,
          candidate: existing.candidate,
          judge: existing.judge,
          strategyNote: input.strategyNote,
        }
        if (!best || winner.bestScore > best.bestScore) {
          best = winner
        }
      }
      continue
    }

    try {
      const plan = await runPiPlanWithRetry({
        input,
        context,
        attemptIndex,
      })
      const candidate = await generateCandidate({ input, context, plan })
      const judge = await judgeCandidate({ input, context, candidate })

      const record: AttemptRecord = {
        workerIndex: input.workerIndex,
        attemptIndex,
        strategyNote: input.strategyNote,
        plan,
        candidate,
        judge,
        error: null,
        at: new Date().toISOString(),
      }
      await writeAttemptRecord(input.reviewDir, input.prompt.id, input.roundNumber, record)

      const winner: WorkerWinner = {
        workerIndex: input.workerIndex,
        bestScore: judge.score,
        bestAttemptIndex: attemptIndex,
        candidate,
        judge,
        strategyNote: input.strategyNote,
      }

      if (!best || winner.bestScore > best.bestScore) {
        best = winner
        await writeWorkerWinner(input.reviewDir, input.prompt.id, input.roundNumber, best)
      }
    } catch (error) {
      const record: AttemptRecord = {
        workerIndex: input.workerIndex,
        attemptIndex,
        strategyNote: input.strategyNote,
        plan: null,
        candidate: null,
        judge: null,
        error: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      }
      await writeAttemptRecord(input.reviewDir, input.prompt.id, input.roundNumber, record)
      await appendError(input.reviewDir, {
        id: input.prompt.id,
        source: input.prompt.source,
        action: 'fanout-attempt',
        workerIndex: input.workerIndex,
        attemptIndex,
        error: record.error,
        at: record.at,
      })
    }
  }

  if (best) {
    await writeWorkerWinner(input.reviewDir, input.prompt.id, input.roundNumber, best)
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
