import { appendFile, readdir, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as z from 'zod'
import {
  behavioral,
  SNAPSHOT_MESSAGE_KINDS,
  SnapshotMessageSchema,
  sync,
  thread,
  WorkerSnapshotSchema,
} from '../behavioral.ts'
import { makeCli } from '../cli/utils/cli.ts'
import { WORKER_EVENTS, WORKER_MESSAGE } from '../worker/worker.constants.ts'
import { type WorkerResearchOutput, WorkerResearchOutputSchema } from '../worker/worker.schemas.ts'
import { gradeResearchResult } from './default.grader.ts'
import {
  CONSUMER_PROMPT_MARKER,
  CONTEXT_PROMPT_MARKER,
  DEFAULT_RESEARCH_TIMEOUT_MS,
  RESEARCH_EVENTS,
  RESEARCHER_COMMAND,
  REVIEW_PROMPT_MARKER,
} from './research.constants.ts'
import {
  type ContextPacket,
  ContextPacketSchema,
  type FileStateSnapshot,
  type FileWriteEvidenceSummary,
  FileWriteEvidenceSummarySchema,
  GradeResultDetailSchema,
  ObservationWriteDetailSchema,
  type ResearchCliInput,
  ResearchCliInputSchema,
  type ResearchCliOutput,
  ResearchCliOutputSchema,
  type ResearchConsumerResult,
  ResearchConsumerResultSchema,
  ResearchErrorDetailSchema,
  type ResearchGrade,
  type ResearchObservation,
  ResearchObservationSchema,
  ResearchTaskDetailSchema,
  WorkerResultDetailSchema,
  WorkerRunDetailSchema,
  WorkerSetupDetailSchema,
} from './research.schemas.ts'

const DEFAULT_CONTEXT_WORKER_ENTRYPOINT = fileURLToPath(new URL('../worker/cline.worker.ts', import.meta.url))
const DEFAULT_CONSUMER_WORKER_ENTRYPOINT = fileURLToPath(new URL('../worker/cline.worker.ts', import.meta.url))
const DEFAULT_REVIEW_WORKER_ENTRYPOINT = fileURLToPath(new URL('../worker/cline.worker.ts', import.meta.url))

const WorkerEnvelopeSchema = z.object({
  message: z.object({
    type: z.literal(WORKER_MESSAGE),
    detail: SnapshotMessageSchema,
  }),
})

type WorkerEnvelope = z.output<typeof WorkerEnvelopeSchema>

type ActiveWorker = {
  workerId: string
  process: Bun.Subprocess
  queue: WorkerEnvelope[]
}

type StageError = {
  stage: string
  message: string
}

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const encodeJson = (value: unknown): string => JSON.stringify(value, null, 2)

const createObservationId = (): string => `research-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`

const sleep = (ms: number): Promise<void> => Bun.sleep(ms)

const extractJsonCandidates = (raw: string): string[] => {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const candidates = new Set<string>()
  candidates.add(trimmed)

  const fenced = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  for (const match of fenced) {
    const candidate = match[1]?.trim()
    if (candidate) candidates.add(candidate)
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1))
  }

  return [...candidates]
}

const parseStructuredFromText = <TSchema extends z.ZodType>(
  raw: string,
  schema: TSchema,
): z.output<TSchema> | undefined => {
  for (const candidate of extractJsonCandidates(raw)) {
    try {
      const parsed = JSON.parse(candidate)
      const validated = schema.safeParse(parsed)
      if (validated.success) return validated.data
    } catch {}
  }
  return
}

const parseWorkerResearchOutput = (payload: Record<string, unknown>): WorkerResearchOutput | undefined => {
  const parsedOutput = WorkerResearchOutputSchema.safeParse(payload.researcherOutput)
  if (!parsedOutput.success) return
  return parsedOutput.data
}

const collectWorkerOutput = ({
  payload,
  streamChunks,
  finalTextCandidates,
}: {
  payload: Record<string, unknown>
  streamChunks: string[]
  finalTextCandidates: string[]
}): { completed: boolean } => {
  const output = parseWorkerResearchOutput(payload)
  if (output?.kind === 'text_chunk') {
    if (output.text.length > 0) {
      streamChunks.push(output.text)
    }
    return { completed: false }
  }
  if (output?.kind === 'final_text') {
    const candidate = output.text.trim()
    if (candidate.length > 0) {
      finalTextCandidates.push(candidate)
    }
    return { completed: false }
  }
  if (output?.kind === 'completed') {
    return { completed: true }
  }
  return { completed: false }
}

const parseStructuredFromCandidates = <TSchema extends z.ZodType>({
  candidates,
  schema,
}: {
  candidates: string[]
  schema: TSchema
}): { parsed: z.output<TSchema>; raw: string } | undefined => {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index]
    if (!candidate) continue
    const parsed = parseStructuredFromText(candidate, schema)
    if (parsed) {
      return { parsed, raw: candidate }
    }
  }
  return
}

const SCAN_EXCLUDED_DIR_NAMES = new Set(['.git', 'node_modules', '.worktrees'])

const readFileState = async (absolutePath: string): Promise<FileStateSnapshot> => {
  if (!(await Bun.file(absolutePath).exists())) {
    return {
      exists: false,
    }
  }
  const fileStats = await stat(absolutePath)
  return {
    exists: true,
    sizeBytes: fileStats.size,
    modifiedMs: fileStats.mtimeMs,
  }
}

const captureWorkspaceFileState = async ({ cwd }: { cwd: string }): Promise<Map<string, FileStateSnapshot>> => {
  const resolvedCwd = resolve(cwd)
  const stateByAbsolutePath = new Map<string, FileStateSnapshot>()
  const pendingDirs: string[] = [resolvedCwd]

  while (pendingDirs.length > 0) {
    const currentDir = pendingDirs.pop()
    if (!currentDir) continue
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = resolve(currentDir, entry.name)
      if (entry.isDirectory()) {
        if (SCAN_EXCLUDED_DIR_NAMES.has(entry.name)) continue
        pendingDirs.push(absolutePath)
        continue
      }
      if (!entry.isFile()) continue
      stateByAbsolutePath.set(absolutePath, await readFileState(absolutePath))
    }
  }

  return stateByAbsolutePath
}

const collectFileWriteEvidence = async ({
  cwd,
  filesWritten,
  beforeStateByAbsolutePath,
}: {
  cwd: string
  filesWritten: string[]
  beforeStateByAbsolutePath: Map<string, FileStateSnapshot>
}): Promise<FileWriteEvidenceSummary> => {
  const resolvedCwd = resolve(cwd)
  const seen = new Set<string>()
  const evidenceRows: FileWriteEvidenceSummary['files'] = []

  for (const path of filesWritten) {
    const absolutePath = isAbsolute(path) ? resolve(path) : resolve(resolvedCwd, path)
    if (seen.has(absolutePath)) continue
    seen.add(absolutePath)

    const relativePath = relative(resolvedCwd, absolutePath)
    const withinCwd = !relativePath.startsWith('..') && !isAbsolute(relativePath)
    const before = beforeStateByAbsolutePath.get(absolutePath) ?? { exists: false }
    const after = withinCwd ? await readFileState(absolutePath) : { exists: false }
    const createdDuringRun = withinCwd && !before.exists && after.exists
    const modifiedDuringRun =
      withinCwd &&
      before.exists &&
      after.exists &&
      (before.sizeBytes !== after.sizeBytes || before.modifiedMs !== after.modifiedMs)

    evidenceRows.push({
      path,
      absolutePath,
      withinCwd,
      before,
      after,
      createdDuringRun,
      modifiedDuringRun,
      changedDuringRun: createdDuringRun || modifiedDuringRun,
    })
  }

  const claimedFilesWithinCwdCount = evidenceRows.filter((row) => row.withinCwd).length
  const claimedFilesChangedDuringRunCount = evidenceRows.filter((row) => row.changedDuringRun).length

  return FileWriteEvidenceSummarySchema.parse({
    claimedFilesCount: filesWritten.length,
    checkedFilesCount: evidenceRows.length,
    claimedFilesWithinCwdCount,
    claimedFilesChangedDuringRunCount,
    files: evidenceRows,
  })
}

const createFallbackContextPacket = ({ rawOutput, task }: { rawOutput: string; task: string }): ContextPacket => ({
  summary: 'Model A returned unstructured context output; fallback context packet was synthesized.',
  filesToRead: [],
  symbolsOrTargets: [],
  citedDocsSkills: [],
  claims: rawOutput ? [rawOutput] : [`Task received: ${task}`],
  rationale: 'Fallback packet used because Model A output did not parse as ContextPacketSchema JSON.',
  openQuestions: ['What additional source-grounded context should be gathered before implementation?'],
  suggestedChecks: ['bun --bun tsc --noEmit'],
  provenance: [{ source: 'model_a_raw_output', evidence: rawOutput || task, confidence: 0.25 }],
  review: rawOutput || 'No structured model-a review returned.',
})

const createFallbackConsumerResult = ({ rawOutput }: { rawOutput: string }): ResearchConsumerResult => ({
  finalText: rawOutput,
  filesWritten: [],
})

const buildContextPrompt = ({ task }: { task: string }): string => {
  return [
    `[${CONTEXT_PROMPT_MARKER}]`,
    'Assemble source-grounded context for the task below.',
    'Return JSON only and match this shape exactly:',
    encodeJson(z.toJSONSchema(ContextPacketSchema)),
    `Task: ${task}`,
  ].join('\n\n')
}

const buildConsumerPrompt = ({ task, contextPacket }: { task: string; contextPacket: ContextPacket }): string => {
  return [
    `[${CONSUMER_PROMPT_MARKER}]`,
    'Use the context packet to answer the task.',
    'Return JSON only with fields:',
    encodeJson(
      z.toJSONSchema(
        z.object({
          finalText: z.string(),
          filesWritten: z.array(z.string()),
          executionOutput: z.string().optional(),
          testOutput: z.string().optional(),
          structuredOutcome: z.record(z.string(), z.json()).optional(),
        }),
      ),
    ),
    `Task: ${task}`,
    `Context packet: ${encodeJson(contextPacket)}`,
  ].join('\n\n')
}

const ModelAReviewEnvelopeSchema = z.object({
  review: z.string(),
})

const parseModelAReviewFromCandidates = (candidates: string[]): string | undefined => {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index]
    if (!candidate) continue
    const parsedReview = parseStructuredFromText(candidate, ModelAReviewEnvelopeSchema)
    if (parsedReview?.review?.trim()) {
      return parsedReview.review.trim()
    }
    const trimmed = candidate.trim()
    if (trimmed.length < 20) continue
    if (/(risk|gap|check|verify|issue|confidence|evidence|pass|fail)/i.test(trimmed)) {
      return trimmed
    }
  }
  return
}

const buildReviewPrompt = ({
  task,
  contextPacket,
  consumerResult,
}: {
  task: string
  contextPacket: ContextPacket
  consumerResult: ResearchConsumerResult
}): string => {
  return [
    `[${REVIEW_PROMPT_MARKER}]`,
    'Review Model B output using the context packet and return JSON only with shape:',
    encodeJson(z.toJSONSchema(ModelAReviewEnvelopeSchema)),
    `Task: ${task}`,
    `Context packet: ${encodeJson(contextPacket)}`,
    `Model B output: ${encodeJson(consumerResult)}`,
  ].join('\n\n')
}

const spawnWorker = ({
  workerId,
  workerEntrypoint,
  cwd,
}: {
  workerId: string
  workerEntrypoint: string
  cwd: string
}): ActiveWorker => {
  const queue: WorkerEnvelope[] = []
  const process = Bun.spawn(['bun', workerEntrypoint], {
    cwd,
    ipc: (message) => {
      const parsed = WorkerEnvelopeSchema.safeParse(message)
      if (parsed.success) {
        queue.push(parsed.data)
      }
    },
  })

  if (process.pid <= 0 || typeof process.send !== 'function') {
    throw new Error(`Failed to spawn worker process for ${workerId}`)
  }

  return {
    workerId,
    process,
    queue,
  }
}

const waitForWorkerMessage = async <TEnvelope extends WorkerEnvelope>({
  worker,
  timeoutMs,
  label,
  predicate,
}: {
  worker: ActiveWorker
  timeoutMs: number
  label: string
  predicate: (message: WorkerEnvelope) => message is TEnvelope
}): Promise<TEnvelope> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const index = worker.queue.findIndex((message) => predicate(message))
    if (index >= 0) {
      const [found] = worker.queue.splice(index, 1)
      return found as TEnvelope
    }
    if (worker.process.exitCode !== null) {
      throw new Error(`Worker ${worker.workerId} exited while waiting for ${label}: ${worker.process.exitCode}`)
    }
    await sleep(10)
  }
  throw new Error(`Timed out waiting for ${label} from worker ${worker.workerId}`)
}

const isSetupSelectionEnvelope = (message: WorkerEnvelope): message is WorkerEnvelope => {
  return message.message.detail.kind === SNAPSHOT_MESSAGE_KINDS.selection
}

const setupWorker = async ({ worker, timeoutMs }: { worker: ActiveWorker; timeoutMs: number }): Promise<void> => {
  const setupEvent = {
    type: WORKER_EVENTS.setup,
    detail: {
      workerId: worker.workerId,
    },
  } as const

  for (let attempt = 0; attempt < 12; attempt += 1) {
    worker.process.send(setupEvent)
    try {
      await waitForWorkerMessage({
        worker,
        timeoutMs: Math.min(180, timeoutMs),
        label: 'setup selection snapshot',
        predicate: isSetupSelectionEnvelope,
      })
      return
    } catch {
      if (worker.process.exitCode !== null) {
        throw new Error(`Worker ${worker.workerId} exited before setup completed`)
      }
    }
  }

  throw new Error(`Timed out waiting for setup on worker ${worker.workerId}`)
}

const runWorkerPrompt = async ({
  worker,
  prompt,
  cwd,
  timeoutMs,
}: {
  worker: ActiveWorker
  prompt: string
  cwd: string
  timeoutMs: number
}): Promise<{
  sessionId: string
  snapshots: z.output<typeof WorkerSnapshotSchema>[]
  parseCandidates: string[]
  rawOutput: string
}> => {
  const runDetail = WorkerRunDetailSchema.parse({
    workerId: worker.workerId,
    prompt,
    cwd,
  })

  worker.queue.length = 0
  worker.process.send({
    type: WORKER_EVENTS.run,
    detail: {
      prompt: runDetail.prompt,
      cwd: runDetail.cwd,
    },
  })

  const snapshots: z.output<typeof WorkerSnapshotSchema>[] = []
  const streamChunks: string[] = []
  const finalTextCandidates: string[] = []
  let sessionId: string | undefined

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const envelope = worker.queue.shift()
    if (!envelope) {
      if (worker.process.exitCode !== null) {
        throw new Error(`Worker ${worker.workerId} exited during run: ${worker.process.exitCode}`)
      }
      await sleep(10)
      continue
    }

    const detail = envelope.message.detail
    if (detail.kind === SNAPSHOT_MESSAGE_KINDS.runtime_error) {
      throw new Error(detail.error)
    }
    if (detail.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error) {
      throw new Error(detail.error)
    }
    if (detail.kind !== SNAPSHOT_MESSAGE_KINDS.worker) {
      continue
    }
    if (detail.workerId !== worker.workerId) {
      continue
    }

    const parsedSnapshot = WorkerSnapshotSchema.parse(detail)
    if (!sessionId) {
      sessionId = parsedSnapshot.sessionId
    }
    if (parsedSnapshot.sessionId !== sessionId) {
      continue
    }

    snapshots.push(parsedSnapshot)
    const outputCollection = collectWorkerOutput({
      payload: parsedSnapshot.payload,
      streamChunks,
      finalTextCandidates,
    })

    if (outputCollection.completed) {
      const reconstructedStream = streamChunks.join('').trim()
      const parseCandidates = [reconstructedStream, ...finalTextCandidates]
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0)
      const explicitFinalText = finalTextCandidates[finalTextCandidates.length - 1]
      const rawOutput = explicitFinalText ?? reconstructedStream ?? ''
      return {
        sessionId: sessionId ?? parsedSnapshot.sessionId,
        snapshots,
        parseCandidates,
        rawOutput,
      }
    }
  }

  throw new Error(`Timed out waiting for worker completion: ${worker.workerId}`)
}

const ensureParentDirectory = async (path: string): Promise<void> => {
  const parent = dirname(path)
  await Bun.$`mkdir -p ${parent}`.quiet()
}

const appendObservation = async ({ path, row }: { path: string; row: ResearchObservation }): Promise<void> => {
  await ensureParentDirectory(path)
  await appendFile(path, `${JSON.stringify(row)}\n`, 'utf8')
}

const buildObservation = ({
  observationId,
  startedAt,
  task,
  status,
  contextPacket,
  contextRawOutput,
  modelAReview,
  consumerResult,
  consumerRawOutput,
  fileWriteEvidence,
  grade,
  contextWorkerSnapshots,
  reviewWorkerSnapshots,
  consumerWorkerSnapshots,
  contextSessionId,
  reviewSessionId,
  consumerSessionId,
  behavioralSnapshots,
  error,
  contextWorkerId,
  consumerWorkerId,
  reviewWorkerId,
  contextWorkerEntrypoint,
  consumerWorkerEntrypoint,
  reviewWorkerEntrypoint,
  observationPath,
}: {
  observationId: string
  startedAt: number
  task: string
  status: 'done' | 'error'
  contextPacket?: ContextPacket
  contextRawOutput?: string
  modelAReview?: string
  consumerResult?: ResearchConsumerResult
  consumerRawOutput?: string
  fileWriteEvidence?: FileWriteEvidenceSummary
  grade?: ResearchGrade
  contextWorkerSnapshots: z.output<typeof WorkerSnapshotSchema>[]
  reviewWorkerSnapshots: z.output<typeof WorkerSnapshotSchema>[]
  consumerWorkerSnapshots: z.output<typeof WorkerSnapshotSchema>[]
  contextSessionId?: string
  reviewSessionId?: string
  consumerSessionId?: string
  behavioralSnapshots: z.output<typeof SnapshotMessageSchema>[]
  error?: StageError
  contextWorkerId: string
  consumerWorkerId: string
  reviewWorkerId: string
  contextWorkerEntrypoint: string
  consumerWorkerEntrypoint: string
  reviewWorkerEntrypoint: string
  observationPath: string
}): ResearchObservation => {
  const hasModelASessionIds = Boolean(contextSessionId || reviewSessionId)
  return ResearchObservationSchema.parse({
    observationId,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    task,
    status,
    ...(contextPacket && { contextPacket }),
    ...(contextRawOutput && { contextRawOutput }),
    ...(modelAReview && { modelAReview }),
    ...(consumerResult && { consumerResult }),
    ...(consumerRawOutput && { consumerRawOutput }),
    ...(fileWriteEvidence && { fileWriteEvidence }),
    ...(grade && { grade }),
    traces: {
      behavioralSnapshots,
      contextWorkerSnapshots,
      reviewWorkerSnapshots,
      consumerWorkerSnapshots,
      ...(hasModelASessionIds && {
        modelASessionIds: {
          ...(contextSessionId && { context: contextSessionId }),
          ...(reviewSessionId && { review: reviewSessionId }),
        },
      }),
      ...(consumerSessionId && { consumerSessionId }),
    },
    ...(error && {
      error: {
        stage: error.stage,
        message: error.message,
      },
    }),
    meta: {
      contextWorkerId,
      consumerWorkerId,
      reviewWorkerId,
      contextWorkerEntrypoint,
      consumerWorkerEntrypoint,
      reviewWorkerEntrypoint,
      observationPath,
    },
  })
}

export const runResearch = async (input: ResearchCliInput): Promise<ResearchCliOutput> => {
  const parsedInput = ResearchCliInputSchema.parse(input)
  const startedAt = Date.now()
  const observationId = createObservationId()

  const resolvedInput = ResearchTaskDetailSchema.parse({
    task: parsedInput.task,
    cwd: parsedInput.cwd ?? process.cwd(),
    contextWorkerId: parsedInput.contextWorkerId,
    consumerWorkerId: parsedInput.consumerWorkerId,
    reviewWorkerId: parsedInput.reviewWorkerId,
    timeoutMs: parsedInput.timeoutMs ?? DEFAULT_RESEARCH_TIMEOUT_MS,
    observationPath: parsedInput.observationPath,
    contextWorkerEntrypoint: parsedInput.contextWorkerEntrypoint ?? DEFAULT_CONTEXT_WORKER_ENTRYPOINT,
    consumerWorkerEntrypoint: parsedInput.consumerWorkerEntrypoint ?? DEFAULT_CONSUMER_WORKER_ENTRYPOINT,
    reviewWorkerEntrypoint: parsedInput.reviewWorkerEntrypoint ?? DEFAULT_REVIEW_WORKER_ENTRYPOINT,
  })

  const workerState = {
    context: undefined as ActiveWorker | undefined,
    review: undefined as ActiveWorker | undefined,
    consumer: undefined as ActiveWorker | undefined,
  }

  const state = {
    error: undefined as StageError | undefined,
    observationQueued: false,
    observationWritten: false,
    contextPacket: undefined as ContextPacket | undefined,
    contextRawOutput: '',
    modelAReview: undefined as string | undefined,
    contextSessionId: undefined as string | undefined,
    contextWorkerSnapshots: [] as z.output<typeof WorkerSnapshotSchema>[],
    reviewSessionId: undefined as string | undefined,
    reviewWorkerSnapshots: [] as z.output<typeof WorkerSnapshotSchema>[],
    consumerResult: undefined as ResearchConsumerResult | undefined,
    consumerRawOutput: '',
    fileWriteEvidence: undefined as FileWriteEvidenceSummary | undefined,
    consumerFileStateBeforeRun: new Map<string, FileStateSnapshot>(),
    consumerSessionId: undefined as string | undefined,
    consumerWorkerSnapshots: [] as z.output<typeof WorkerSnapshotSchema>[],
    grade: undefined as ResearchGrade | undefined,
    behavioralSnapshots: [] as z.output<typeof SnapshotMessageSchema>[],
  }

  const queueObservationWrite = (detail: z.output<typeof ObservationWriteDetailSchema>): void => {
    if (state.observationQueued) return
    state.observationQueued = true
    trigger({ type: RESEARCH_EVENTS.observation_write, detail })
  }

  const failStage = ({ stage, error }: { stage: string; error: unknown }): void => {
    if (state.error) return
    state.error = {
      stage,
      message: toErrorMessage(error),
    }
    queueObservationWrite({ reason: 'error', stage })
  }

  const cleanupWorkers = async (): Promise<void> => {
    const workers = [workerState.context, workerState.review, workerState.consumer].filter(
      (candidate): candidate is ActiveWorker => Boolean(candidate),
    )
    for (const worker of workers) {
      if (worker.process.exitCode === null) {
        worker.process.kill()
      }
    }
    for (const worker of workers) {
      await worker.process.exited
    }
  }

  const { addHandler, addThread, trigger, useSnapshot } = behavioral()

  useSnapshot((snapshot) => {
    state.behavioralSnapshots.push(SnapshotMessageSchema.parse(snapshot))
  })

  addThread(
    'researcher-first-pass-flow',
    thread(
      [
        sync({
          waitFor: {
            type: RESEARCH_EVENTS.research_task,
            detailSchema: ResearchTaskDetailSchema,
          },
        }),
        sync({
          request: {
            type: RESEARCH_EVENTS.context_worker_setup,
            detail: WorkerSetupDetailSchema.parse({
              workerId: resolvedInput.contextWorkerId,
            }),
          },
        }),
        sync({
          waitFor: {
            type: RESEARCH_EVENTS.context_worker_run,
            detailSchema: WorkerRunDetailSchema,
          },
        }),
        sync({
          waitFor: {
            type: RESEARCH_EVENTS.context_worker_result,
            detailSchema: WorkerResultDetailSchema,
          },
        }),
        sync({
          request: {
            type: RESEARCH_EVENTS.consumer_worker_setup,
            detail: WorkerSetupDetailSchema.parse({
              workerId: resolvedInput.consumerWorkerId,
            }),
          },
        }),
        sync({
          waitFor: {
            type: RESEARCH_EVENTS.consumer_worker_run,
            detailSchema: WorkerRunDetailSchema,
          },
        }),
        sync({
          waitFor: {
            type: RESEARCH_EVENTS.consumer_worker_result,
            detailSchema: WorkerResultDetailSchema,
          },
        }),
        sync({
          request: {
            type: RESEARCH_EVENTS.grade_request,
            detail: {
              task: resolvedInput.task,
            },
          },
        }),
        sync({
          waitFor: {
            type: RESEARCH_EVENTS.grade_result,
            detailSchema: GradeResultDetailSchema,
          },
        }),
        sync({
          request: {
            type: RESEARCH_EVENTS.observation_write,
            detail: ObservationWriteDetailSchema.parse({
              reason: 'success',
            }),
          },
        }),
      ],
      true,
    ),
  )

  addHandler(RESEARCH_EVENTS.context_worker_setup, async (detail) => {
    if (state.error) return
    try {
      const setupDetail = WorkerSetupDetailSchema.parse(detail)
      const worker = spawnWorker({
        workerId: setupDetail.workerId,
        workerEntrypoint: resolvedInput.contextWorkerEntrypoint,
        cwd: resolvedInput.cwd,
      })
      await setupWorker({ worker, timeoutMs: resolvedInput.timeoutMs })
      workerState.context = worker

      const runDetail = WorkerRunDetailSchema.parse({
        workerId: setupDetail.workerId,
        prompt: buildContextPrompt({ task: resolvedInput.task }),
        cwd: resolvedInput.cwd,
      })
      trigger({
        type: RESEARCH_EVENTS.context_worker_run,
        detail: runDetail,
      })
    } catch (error) {
      failStage({ stage: RESEARCH_EVENTS.context_worker_setup, error })
    }
  })

  addHandler(RESEARCH_EVENTS.context_worker_run, async (detail) => {
    if (state.error) return
    try {
      const runDetail = WorkerRunDetailSchema.parse(detail)
      if (!workerState.context) {
        throw new Error('Context worker was not initialized before run')
      }

      const runResult = await runWorkerPrompt({
        worker: workerState.context,
        prompt: runDetail.prompt,
        cwd: runDetail.cwd,
        timeoutMs: resolvedInput.timeoutMs,
      })

      state.contextWorkerSnapshots = runResult.snapshots
      state.contextSessionId = runResult.sessionId

      const contextPacket = parseStructuredFromCandidates({
        candidates: runResult.parseCandidates,
        schema: ContextPacketSchema,
      })
      state.contextPacket =
        contextPacket?.parsed ??
        createFallbackContextPacket({ rawOutput: runResult.rawOutput, task: resolvedInput.task })
      state.contextRawOutput = contextPacket?.raw ?? runResult.rawOutput

      trigger({
        type: RESEARCH_EVENTS.context_worker_result,
        detail: WorkerResultDetailSchema.parse({
          workerId: runDetail.workerId,
          sessionId: runResult.sessionId,
          rawOutput: runResult.rawOutput,
        }),
      })
    } catch (error) {
      failStage({ stage: RESEARCH_EVENTS.context_worker_run, error })
    }
  })

  addHandler(RESEARCH_EVENTS.consumer_worker_setup, async (detail) => {
    if (state.error) return
    try {
      const setupDetail = WorkerSetupDetailSchema.parse(detail)
      const worker = spawnWorker({
        workerId: setupDetail.workerId,
        workerEntrypoint: resolvedInput.consumerWorkerEntrypoint,
        cwd: resolvedInput.cwd,
      })
      await setupWorker({ worker, timeoutMs: resolvedInput.timeoutMs })
      workerState.consumer = worker

      const contextPacket = state.contextPacket
      if (!contextPacket) {
        throw new Error('Context packet is missing before consumer run')
      }

      const runDetail = WorkerRunDetailSchema.parse({
        workerId: setupDetail.workerId,
        prompt: buildConsumerPrompt({ task: resolvedInput.task, contextPacket }),
        cwd: resolvedInput.cwd,
      })

      trigger({
        type: RESEARCH_EVENTS.consumer_worker_run,
        detail: runDetail,
      })
    } catch (error) {
      failStage({ stage: RESEARCH_EVENTS.consumer_worker_setup, error })
    }
  })

  addHandler(RESEARCH_EVENTS.consumer_worker_run, async (detail) => {
    if (state.error) return
    try {
      const runDetail = WorkerRunDetailSchema.parse(detail)
      if (!workerState.consumer) {
        throw new Error('Consumer worker was not initialized before run')
      }

      state.consumerFileStateBeforeRun = await captureWorkspaceFileState({
        cwd: runDetail.cwd,
      })
      const runResult = await runWorkerPrompt({
        worker: workerState.consumer,
        prompt: runDetail.prompt,
        cwd: runDetail.cwd,
        timeoutMs: resolvedInput.timeoutMs,
      })

      state.consumerWorkerSnapshots = runResult.snapshots
      state.consumerSessionId = runResult.sessionId

      const parsedConsumer = parseStructuredFromCandidates({
        candidates: runResult.parseCandidates,
        schema: ResearchConsumerResultSchema,
      })
      state.consumerResult = parsedConsumer?.parsed ?? createFallbackConsumerResult({ rawOutput: runResult.rawOutput })
      state.consumerRawOutput = parsedConsumer?.raw ?? runResult.rawOutput

      trigger({
        type: RESEARCH_EVENTS.consumer_worker_result,
        detail: WorkerResultDetailSchema.parse({
          workerId: runDetail.workerId,
          sessionId: runResult.sessionId,
          rawOutput: runResult.rawOutput,
        }),
      })
    } catch (error) {
      failStage({ stage: RESEARCH_EVENTS.consumer_worker_run, error })
    }
  })

  addHandler(RESEARCH_EVENTS.grade_request, async (detail) => {
    if (state.error) return
    try {
      const gradeDetail = z.object({ task: z.string() }).parse(detail)
      if (!state.contextPacket || !state.consumerResult) {
        throw new Error('Cannot grade without context packet and consumer result')
      }
      if (!workerState.review) {
        const reviewWorker = spawnWorker({
          workerId: resolvedInput.reviewWorkerId,
          workerEntrypoint: resolvedInput.reviewWorkerEntrypoint,
          cwd: resolvedInput.cwd,
        })
        await setupWorker({ worker: reviewWorker, timeoutMs: resolvedInput.timeoutMs })
        workerState.review = reviewWorker
      }
      if (!workerState.review) {
        throw new Error('Review worker is unavailable for Model A review pass')
      }

      const reviewRunResult = await runWorkerPrompt({
        worker: workerState.review,
        prompt: buildReviewPrompt({
          task: gradeDetail.task,
          contextPacket: state.contextPacket,
          consumerResult: state.consumerResult,
        }),
        cwd: resolvedInput.cwd,
        timeoutMs: resolvedInput.timeoutMs,
      })
      state.reviewWorkerSnapshots = reviewRunResult.snapshots
      state.reviewSessionId = reviewRunResult.sessionId
      state.modelAReview = parseModelAReviewFromCandidates(reviewRunResult.parseCandidates) ?? state.modelAReview

      const fileWriteEvidence = await collectFileWriteEvidence({
        cwd: resolvedInput.cwd,
        filesWritten: state.consumerResult.filesWritten,
        beforeStateByAbsolutePath: state.consumerFileStateBeforeRun,
      })
      state.fileWriteEvidence = fileWriteEvidence

      const grade = gradeResearchResult({
        task: gradeDetail.task,
        contextPacket: state.contextPacket,
        consumerResult: state.consumerResult,
        modelAReview: state.modelAReview,
        contextWorkerSnapshots: state.contextWorkerSnapshots,
        reviewWorkerSnapshots: state.reviewWorkerSnapshots,
        consumerWorkerSnapshots: state.consumerWorkerSnapshots,
        fileWriteEvidence,
      })

      state.grade = grade
      trigger({
        type: RESEARCH_EVENTS.grade_result,
        detail: GradeResultDetailSchema.parse({
          grade,
        }),
      })
    } catch (error) {
      failStage({ stage: RESEARCH_EVENTS.grade_request, error })
    }
  })

  addHandler(RESEARCH_EVENTS.observation_write, async (detail) => {
    try {
      ObservationWriteDetailSchema.parse(detail)
      if (state.observationWritten) return
      state.observationWritten = true

      const status = state.error ? 'error' : 'done'
      const observation = buildObservation({
        observationId,
        startedAt,
        task: resolvedInput.task,
        status,
        contextPacket: state.contextPacket,
        contextRawOutput: state.contextRawOutput,
        modelAReview: state.modelAReview,
        consumerResult: state.consumerResult,
        consumerRawOutput: state.consumerRawOutput,
        fileWriteEvidence: state.fileWriteEvidence,
        grade: state.grade,
        contextWorkerSnapshots: state.contextWorkerSnapshots,
        reviewWorkerSnapshots: state.reviewWorkerSnapshots,
        consumerWorkerSnapshots: state.consumerWorkerSnapshots,
        contextSessionId: state.contextSessionId,
        reviewSessionId: state.reviewSessionId,
        consumerSessionId: state.consumerSessionId,
        behavioralSnapshots: state.behavioralSnapshots,
        error: state.error,
        contextWorkerId: resolvedInput.contextWorkerId,
        consumerWorkerId: resolvedInput.consumerWorkerId,
        reviewWorkerId: resolvedInput.reviewWorkerId,
        contextWorkerEntrypoint: resolvedInput.contextWorkerEntrypoint,
        consumerWorkerEntrypoint: resolvedInput.consumerWorkerEntrypoint,
        reviewWorkerEntrypoint: resolvedInput.reviewWorkerEntrypoint,
        observationPath: resolvedInput.observationPath,
      })

      await appendObservation({
        path: resolvedInput.observationPath,
        row: observation,
      })

      if (state.error) {
        trigger({
          type: RESEARCH_EVENTS.research_error,
          detail: ResearchErrorDetailSchema.parse({
            stage: state.error.stage,
            error: state.error.message,
            observationId,
            observationPath: resolvedInput.observationPath,
          }),
        })
        return
      }

      trigger({
        type: RESEARCH_EVENTS.research_done,
        detail: {
          observationId,
          observationPath: resolvedInput.observationPath,
        },
      })
    } catch (error) {
      const fallbackError = {
        stage: RESEARCH_EVENTS.observation_write,
        error: toErrorMessage(error),
        observationId,
        observationPath: resolvedInput.observationPath,
      }
      trigger({
        type: RESEARCH_EVENTS.research_error,
        detail: fallbackError,
      })
    }
  })

  const finalResult = new Promise<ResearchCliOutput>((resolve) => {
    addHandler(
      RESEARCH_EVENTS.research_done,
      () => {
        resolve(
          ResearchCliOutputSchema.parse({
            status: 'done',
            observationId,
            observationPath: resolvedInput.observationPath,
            durationMs: Date.now() - startedAt,
            contextPacket: state.contextPacket,
            modelAReview: state.modelAReview,
            consumerResult: state.consumerResult,
            fileWriteEvidence: state.fileWriteEvidence,
            grade: state.grade,
          }),
        )
      },
      true,
    )

    addHandler(
      RESEARCH_EVENTS.research_error,
      (detail) => {
        resolve(
          ResearchCliOutputSchema.parse({
            status: 'error',
            observationId,
            observationPath: resolvedInput.observationPath,
            durationMs: Date.now() - startedAt,
            contextPacket: state.contextPacket,
            modelAReview: state.modelAReview,
            consumerResult: state.consumerResult,
            fileWriteEvidence: state.fileWriteEvidence,
            grade: state.grade,
            error: ResearchErrorDetailSchema.parse(detail),
          }),
        )
      },
      true,
    )
  })

  trigger({
    type: RESEARCH_EVENTS.research_task,
    detail: resolvedInput,
  })

  const result = await finalResult.finally(async () => {
    await cleanupWorkers()
  })

  return result
}

export const researchCli = makeCli({
  name: RESEARCHER_COMMAND,
  inputSchema: ResearchCliInputSchema,
  outputSchema: ResearchCliOutputSchema,
  run: async (input) => runResearch(input),
})
