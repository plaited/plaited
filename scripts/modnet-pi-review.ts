#!/usr/bin/env bun

import { appendFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import {
  buildBlockedPromptIds,
  buildCompletedPromptIds,
  pickReadyManifest,
  type RoundManifest,
} from './modnet-pi-round-state.ts'
import type { GeneratedCandidate, ReviewPrompt, WorkflowMode } from './modnet-pi-workflow.ts'
import { buildContextPaths } from './modnet-pi-workflow.ts'

type PromptCatalogRow = {
  id: string
  prompt: string
}

type DecisionRow = {
  id: string
  action: string
  source?: string
  feedback?: string
  result?: string
  at: string
}

type ReviewState = {
  currentIndex: number
  updatedAt: string
  completedPromptIds: string[]
}

type JudgedCandidate = {
  pass: boolean
  score: number
  rationale: string
}

type WorkerWinner = {
  workerIndex: number
  bestScore: number
  bestAttemptIndex: number
  candidate: GeneratedCandidate
  judge: JudgedCandidate
  strategyNote: string
}

type RoundWinnerFile = {
  queuePromptId: string
  promptId: string
  roundNumber: number
  mode: WorkflowMode
  feedback: string
  sourcePrompt: ReviewPrompt
  roundWinner: WorkerWinner
  workerWinners: WorkerWinner[]
}

type RoundInput = {
  programPath: string
  contextPaths: string[]
  reviewDir: string
  queuePromptId: string
  prompt: ReviewPrompt
  mode: WorkflowMode
  feedback: string
  roundNumber: number
  attemptsPerWorker: number
  retryAttempts: number
  strategyNotes: string[]
  generatorModel: string
  judgeModel: string
}

type ReadyRound = {
  manifest: RoundManifest
  winner: RoundWinnerFile
}

type WaitResult =
  | {
      kind: 'input'
      value: string
    }
  | {
      kind: 'ready'
      ready: ReadyRound
    }

type SourceAction =
  | 'keep'
  | 'remove'
  | 'skip'
  | 'quit'
  | ReadyRound
  | {
      action: 'refine'
      feedback: string
    }

type WinnerAction =
  | 'accept-winner'
  | 'reject-winner'
  | 'quit'
  | {
      action: 'refine'
      feedback: string
    }
  | {
      action: 'adjust-scale'
      target: 'rel' | `s${number}`
    }
  | 'derive'

const PROGRAM_PATH = join('dev-research', 'training-prompts', 'program.md')
const CATALOG_DIR = join('dev-research', 'training-prompts', 'catalog')
const PROMPTS_PATH = join(CATALOG_DIR, 'prompts.jsonl')
const BUCKETS_DIR = join(CATALOG_DIR, 'buckets')
const BASE_REVIEW_DIR = process.env.MODNET_REVIEW_DIR ?? join('.prompts', 'modnet-review')
const DEFAULT_RETRY_ATTEMPTS = 3
const FANOUT_WORKERS = 5
const ATTEMPTS_PER_WORKER = 15
const GLM_GENERATOR_MODEL = 'z-ai/glm-5'
const M2_5_JUDGE_MODEL = 'minimax/minimax-m2.5'
const STRATEGY_NOTES = [
  'preserve the durable user job and rewrite for training clarity',
  'tighten MSS shape and make the prompt bounded and concrete',
  'optimize for realistic lower-friction implementation semantics',
  'favor a clearer module identity and stronger human readability',
  'favor crisp standalone training usefulness over lineage detail',
]

type ReviewOptions = {
  bucket: string | null
  catalogPath: string
  bucketReviewPath: string | null
  reviewDir: string
}

let activeReviewOptions: ReviewOptions = {
  bucket: null,
  catalogPath: PROMPTS_PATH,
  bucketReviewPath: null,
  reviewDir: BASE_REVIEW_DIR,
}

const getArtifactsDir = () => join(activeReviewOptions.reviewDir, 'artifacts')
const getDecisionsPath = () => join(activeReviewOptions.reviewDir, 'decisions.jsonl')
const getErrorsPath = () => join(activeReviewOptions.reviewDir, 'errors.jsonl')
const getStatePath = () => join(activeReviewOptions.reviewDir, 'state.json')

export const parseCliArgs = (argv: string[]): ReviewOptions => {
  let bucket: string | null = null

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]!

    if (arg === '--bucket') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --bucket')
      }
      bucket = value
      index += 1
      continue
    }

    if (arg.startsWith('--bucket=')) {
      const value = arg.slice('--bucket='.length)
      if (!value) {
        throw new Error('Missing value for --bucket')
      }
      bucket = value
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!bucket) {
    return {
      bucket: null,
      catalogPath: PROMPTS_PATH,
      bucketReviewPath: null,
      reviewDir: BASE_REVIEW_DIR,
    }
  }

  return {
    bucket,
    catalogPath: join(BUCKETS_DIR, `${bucket}.jsonl`),
    bucketReviewPath: join(BUCKETS_DIR, `${bucket}.review.md`),
    reviewDir: join(BASE_REVIEW_DIR, bucket),
  }
}

const readJsonl = async <T>(path: string): Promise<T[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

const loadPrompts = async (): Promise<ReviewPrompt[]> => {
  const rows = await readJsonl<PromptCatalogRow>(activeReviewOptions.catalogPath)
  return rows.map((row) => ({
    id: row.id,
    title: row.id,
    prompt: row.prompt,
    hint: null,
    source: 'catalog',
    patternFamily: null,
    scale: null,
  }))
}

const ensureReviewDir = async () => {
  await Bun.$`mkdir -p ${activeReviewOptions.reviewDir} ${getArtifactsDir()}`.quiet()
}

const appendDecision = async (row: Record<string, unknown>) => {
  await ensureReviewDir()
  await appendFile(getDecisionsPath(), `${JSON.stringify(row)}\n`)
}

const appendError = async (row: Record<string, unknown>) => {
  await ensureReviewDir()
  await appendFile(getErrorsPath(), `${JSON.stringify(row)}\n`)
}

const loadDecisions = async (): Promise<DecisionRow[]> => {
  if (!(await Bun.file(getDecisionsPath()).exists())) {
    return []
  }
  return readJsonl<DecisionRow>(getDecisionsPath())
}

const loadState = async (): Promise<ReviewState | null> => {
  if (!(await Bun.file(getStatePath()).exists())) {
    return null
  }
  return (await Bun.file(getStatePath()).json()) as ReviewState
}

const writeState = async (state: ReviewState) => {
  await ensureReviewDir()
  await Bun.write(getStatePath(), `${JSON.stringify(state, null, 2)}\n`)
}

const promptArtifactDir = (promptId: string) => join(getArtifactsDir(), promptId)
const roundDir = (promptId: string, roundNumber: number) =>
  join(promptArtifactDir(promptId), `round-${roundNumber.toString().padStart(2, '0')}`)
const roundManifestPath = (promptId: string, roundNumber: number) => join(roundDir(promptId, roundNumber), 'round.json')
const roundWinnerPath = (promptId: string, roundNumber: number) =>
  join(roundDir(promptId, roundNumber), 'round-winner.json')
const roundInputPath = (promptId: string, roundNumber: number) =>
  join(roundDir(promptId, roundNumber), 'round-input.json')
const roundStdoutPath = (promptId: string, roundNumber: number) =>
  join(roundDir(promptId, roundNumber), 'round.stdout.log')
const roundStderrPath = (promptId: string, roundNumber: number) =>
  join(roundDir(promptId, roundNumber), 'round.stderr.log')

const delay = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const listRoundNumbers = async (promptId: string): Promise<number[]> => {
  try {
    const entries = await readdir(promptArtifactDir(promptId), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => /^round-(\d+)$/u.exec(entry.name)?.[1] ?? null)
      .filter((value): value is string => value !== null)
      .map((value) => Number(value))
      .sort((a, b) => a - b)
  } catch {
    return []
  }
}

const loadRoundManifest = async (promptId: string, roundNumber: number): Promise<RoundManifest | null> => {
  const path = roundManifestPath(promptId, roundNumber)
  if (!(await Bun.file(path).exists())) {
    return null
  }
  return (await Bun.file(path).json()) as RoundManifest
}

const writeRoundManifest = async (manifest: RoundManifest) => {
  await Bun.$`mkdir -p ${roundDir(manifest.promptId, manifest.roundNumber)}`.quiet()
  await Bun.write(roundManifestPath(manifest.promptId, manifest.roundNumber), `${JSON.stringify(manifest, null, 2)}\n`)
}

const loadRoundWinner = async (promptId: string, roundNumber: number): Promise<RoundWinnerFile | null> => {
  const path = roundWinnerPath(promptId, roundNumber)
  if (!(await Bun.file(path).exists())) {
    return null
  }
  return (await Bun.file(path).json()) as RoundWinnerFile
}

const resolveRoundNumber = async (promptId: string): Promise<number> => {
  const rounds = await listRoundNumbers(promptId)
  return rounds.length === 0 ? 1 : rounds.at(-1)! + 1
}

const buildDerivedReviewPrompt = ({
  parent,
  candidate,
}: {
  parent: ReviewPrompt
  candidate: GeneratedCandidate
}): ReviewPrompt => ({
  id: `${parent.id}--derived`,
  title: candidate.title,
  prompt: candidate.prompt,
  hint: null,
  source: 'catalog',
  patternFamily: null,
  scale: `S${candidate.mss.scale}`,
})

const launchRound = async ({
  queuePromptId,
  prompt,
  mode,
  feedback,
  contextPaths,
  basedOnRoundNumber,
}: {
  queuePromptId: string
  prompt: ReviewPrompt
  mode: WorkflowMode
  feedback: string
  contextPaths: string[]
  basedOnRoundNumber?: number
}) => {
  const roundNumber = await resolveRoundNumber(prompt.id)
  const manifest: RoundManifest = {
    queuePromptId,
    promptId: prompt.id,
    promptTitle: prompt.title,
    mode,
    feedback,
    roundNumber,
    sourcePrompt: prompt,
    createdAt: new Date().toISOString(),
    status: 'running',
    basedOnRoundNumber,
  }

  const inputPayload: RoundInput = {
    programPath: PROGRAM_PATH,
    contextPaths,
    reviewDir: activeReviewOptions.reviewDir,
    queuePromptId,
    prompt,
    mode,
    feedback,
    roundNumber,
    attemptsPerWorker: ATTEMPTS_PER_WORKER,
    retryAttempts: DEFAULT_RETRY_ATTEMPTS,
    strategyNotes: STRATEGY_NOTES.slice(0, FANOUT_WORKERS),
    generatorModel: GLM_GENERATOR_MODEL,
    judgeModel: M2_5_JUDGE_MODEL,
  }

  await writeRoundManifest(manifest)
  await Bun.write(roundInputPath(prompt.id, roundNumber), `${JSON.stringify(inputPayload, null, 2)}\n`)

  const stdoutFile = Bun.file(roundStdoutPath(prompt.id, roundNumber))
  const stderrFile = Bun.file(roundStderrPath(prompt.id, roundNumber))
  const proc = Bun.spawn({
    cmd: ['bun', 'scripts/modnet-pi-round.ts', roundInputPath(prompt.id, roundNumber)],
    cwd: process.cwd(),
    env: process.env,
    stdin: 'ignore',
    stdout: stdoutFile,
    stderr: stderrFile,
    detached: true,
  })
  proc.unref()
  await writeRoundManifest({
    ...manifest,
    launchedPid: proc.pid,
  })

  return manifest
}

const loadAllManifests = async (): Promise<RoundManifest[]> => {
  try {
    const promptEntries = await readdir(getArtifactsDir(), { withFileTypes: true })
    const manifests: RoundManifest[] = []

    for (const promptEntry of promptEntries) {
      if (!promptEntry.isDirectory()) {
        continue
      }
      const promptId = promptEntry.name
      const roundNumbers = await listRoundNumbers(promptId)
      for (const roundNumber of roundNumbers) {
        const manifest = await loadRoundManifest(promptId, roundNumber)
        if (manifest) {
          manifests.push(manifest)
        }
      }
    }

    return manifests
  } catch {
    return []
  }
}

const loadReadyRound = async (): Promise<ReadyRound | null> => {
  const manifests = await loadAllManifests()
  const readyManifest = pickReadyManifest(manifests)
  if (!readyManifest) {
    return null
  }

  const winner = await loadRoundWinner(readyManifest.promptId, readyManifest.roundNumber)
  if (!winner) {
    await appendError({
      promptId: readyManifest.promptId,
      roundNumber: readyManifest.roundNumber,
      error: 'Completed round missing round-winner.json',
      at: new Date().toISOString(),
    })
    await writeRoundManifest({
      ...readyManifest,
      status: 'failed',
      resolvedAt: new Date().toISOString(),
      error: 'Completed round missing round-winner.json',
    })
    return null
  }

  return {
    manifest: readyManifest,
    winner,
  }
}

const waitForInputOrReady = async ({
  rl,
  question,
  reviewDir,
}: {
  rl: ReturnType<typeof createInterface>
  question: string
  reviewDir?: string
}): Promise<WaitResult> => {
  const controller = new AbortController()
  const answerPromise = rl
    .question(question, {
      signal: controller.signal,
    })
    .then(
      (value) =>
        ({
          kind: 'input',
          value,
        }) as const,
    )
    .catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') {
        return null
      }
      throw error
    })

  while (true) {
    const result = await Promise.race([answerPromise, delay(1000).then(() => 'tick' as const)])
    if (result && result !== 'tick') {
      return result
    }

    const previousReviewDir = activeReviewOptions.reviewDir
    if (reviewDir) {
      activeReviewOptions = {
        ...activeReviewOptions,
        reviewDir,
      }
    }
    const ready = await loadReadyRound()
    activeReviewOptions = {
      ...activeReviewOptions,
      reviewDir: previousReviewDir,
    }
    if (ready) {
      controller.abort()
      await answerPromise
      output.write('\n')
      return {
        kind: 'ready',
        ready,
      }
    }
  }
}

export const parseSourceInput = (value: string): SourceAction | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  switch (trimmed) {
    case '1':
      return 'keep'
    case '2':
      return 'remove'
    case '4':
      return 'skip'
    case '5':
      return 'quit'
    default:
      if (/^\d+$/u.test(trimmed)) {
        return null
      }
      return {
        action: 'refine',
        feedback: trimmed,
      }
  }
}

export const parseWinnerInput = (value: string): WinnerAction | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const lower = trimmed.toLowerCase()
  if (lower === 'rel' || /^s[1-5]$/u.test(lower)) {
    return {
      action: 'adjust-scale',
      target: lower as 'rel' | `s${number}`,
    }
  }

  switch (trimmed) {
    case '1':
      return 'accept-winner'
    case '2':
      return 'reject-winner'
    case '4':
      return 'derive'
    case '5':
      return 'quit'
    default:
      if (/^\d+$/u.test(trimmed)) {
        return null
      }
      return {
        action: 'refine',
        feedback: trimmed,
      }
  }
}

const promptSourceAction = async (rl: ReturnType<typeof createInterface>): Promise<SourceAction | null> => {
  console.log('\nChoose action:')
  console.log('  1. keep')
  console.log('  2. remove')
  console.log('  3. type feedback to refine')
  console.log('  4. skip')
  console.log('  5. quit')
  const result = await waitForInputOrReady({
    rl,
    question: 'Enter number or refine feedback: ',
    reviewDir: activeReviewOptions.reviewDir,
  })
  if (result.kind === 'ready') {
    return result.ready
  }
  return parseSourceInput(result.value)
}

const promptWinnerAction = async (rl: ReturnType<typeof createInterface>): Promise<WinnerAction | null> => {
  console.log('\nChoose winner action:')
  console.log('  1. accept winner')
  console.log('  2. reject winner')
  console.log('  3. type feedback to refine')
  console.log('  4. derive lower-scale prompt(s)')
  console.log('  5. quit')
  console.log('  type s1-s5 or rel to adjust scale')
  const choice = await rl.question('Enter number, scale token, or refine feedback: ')
  return parseWinnerInput(choice)
}

const promptIdleAction = async (
  rl: ReturnType<typeof createInterface>,
): Promise<'refresh' | 'quit' | ReadyRound | null> => {
  console.log('\nNo source prompts are ready right now.')
  console.log('  1. refresh')
  console.log('  2. quit')
  const result = await waitForInputOrReady({
    rl,
    question: 'Enter number: ',
    reviewDir: activeReviewOptions.reviewDir,
  })
  if (result.kind === 'ready') {
    return result.ready
  }
  const choice = result.value.trim()
  switch (choice) {
    case '1':
      return 'refresh'
    case '2':
      return 'quit'
    default:
      return null
  }
}

const printWinner = ({ manifest, winner }: { manifest: RoundManifest; winner: RoundWinnerFile }) => {
  console.log(`\n--- ${manifest.mode === 'derive' ? 'Derived' : 'Round'} Winner ---\n`)
  console.log('based on:')
  console.log(manifest.sourcePrompt.title)
  console.log(manifest.sourcePrompt.prompt)
  console.log('')
  console.log(`round: ${winner.roundNumber}`)
  console.log(`worker: ${winner.roundWinner.workerIndex}`)
  console.log(`attempt: ${winner.roundWinner.bestAttemptIndex}`)
  console.log(`score: ${winner.roundWinner.bestScore.toFixed(3)}`)
  console.log(`title: ${winner.roundWinner.candidate.title}`)
  console.log(`prompt: ${winner.roundWinner.candidate.prompt}`)
  console.log(
    `mss: ${winner.roundWinner.candidate.mss.contentType} / ${winner.roundWinner.candidate.mss.structure} / S${winner.roundWinner.candidate.mss.scale}`,
  )
  console.log(`judge: ${winner.roundWinner.judge.rationale}`)
}

const advanceIndex = ({
  prompts,
  startIndex,
  completedPromptIds,
  blockedPromptIds,
}: {
  prompts: ReviewPrompt[]
  startIndex: number
  completedPromptIds: Set<string>
  blockedPromptIds: Set<string>
}): number => {
  let index = Math.max(0, startIndex)
  while (index < prompts.length) {
    const prompt = prompts[index]!
    if (!completedPromptIds.has(prompt.id) && !blockedPromptIds.has(prompt.id)) {
      return index
    }
    index += 1
  }
  return index
}

const stopRunningRounds = async (manifests: RoundManifest[]) => {
  const running = manifests.filter(
    (manifest) => manifest.status === 'running' && typeof manifest.launchedPid === 'number',
  )

  for (const manifest of running) {
    try {
      process.kill(manifest.launchedPid!, 'SIGTERM')
    } catch {
      // ignore missing/already-exited processes
    }

    await writeRoundManifest({
      ...manifest,
      status: 'stopped',
      resolvedAt: new Date().toISOString(),
      error: 'Stopped on quit',
    })
  }
}

const handleReadyRound = async ({
  rl,
  manifest,
  winner,
  contextPaths,
}: {
  rl: ReturnType<typeof createInterface>
  manifest: RoundManifest
  winner: RoundWinnerFile
  contextPaths: string[]
}): Promise<'quit' | 'continue'> => {
  printWinner({ manifest, winner })

  while (true) {
    const action = await promptWinnerAction(rl)
    if (!action) {
      console.log('Unknown winner action.')
      continue
    }

    if (action === 'quit') {
      return 'quit'
    }

    if (action === 'accept-winner' || action === 'reject-winner') {
      await appendDecision({
        id: manifest.queuePromptId,
        action,
        source: manifest.sourcePrompt.source,
        feedback: manifest.feedback,
        result: winner.roundWinner.candidate.prompt,
        at: new Date().toISOString(),
      })
      await writeRoundManifest({
        ...manifest,
        status: action === 'accept-winner' ? 'accepted' : 'rejected',
        resolvedAt: new Date().toISOString(),
      })
      return 'continue'
    }

    const nextSourcePrompt =
      action === 'derive'
        ? buildDerivedReviewPrompt({
            parent: manifest.sourcePrompt,
            candidate: winner.roundWinner.candidate,
          })
        : {
            ...manifest.sourcePrompt,
            title: winner.roundWinner.candidate.title,
            prompt: winner.roundWinner.candidate.prompt,
            scale: `S${winner.roundWinner.candidate.mss.scale}`,
          }

    const feedback =
      action === 'derive'
        ? 'Derive a smaller-scale prompt from the approved parent prompt.'
        : action.action === 'adjust-scale'
          ? action.target === 'rel'
            ? 'Adjust the scale of the prompt and MSS tags using relative scale semantics.'
            : `Adjust the scale of the prompt and MSS tags to ${action.target.toUpperCase()}.`
          : action.feedback

    await appendDecision({
      id: manifest.queuePromptId,
      action: typeof action === 'string' ? action : action.action,
      source: manifest.sourcePrompt.source,
      feedback,
      at: new Date().toISOString(),
    })
    await writeRoundManifest({
      ...manifest,
      status: 'superseded',
      resolvedAt: new Date().toISOString(),
    })

    await launchRound({
      queuePromptId: manifest.queuePromptId,
      prompt: nextSourcePrompt,
      mode: action === 'derive' ? 'derive' : 'refine',
      feedback,
      contextPaths,
      basedOnRoundNumber: manifest.roundNumber,
    })
    return 'continue'
  }
}

const main = async () => {
  activeReviewOptions = parseCliArgs(Bun.argv)
  const contextPaths = buildContextPaths({
    extraPaths: activeReviewOptions.bucketReviewPath ? [activeReviewOptions.bucketReviewPath] : [],
  })

  await ensureReviewDir()
  const prompts = await loadPrompts()
  let decisions = await loadDecisions()
  const existingState = await loadState()
  const rl = createInterface({ input, output })
  let index = Math.max(0, existingState?.currentIndex ?? 0)

  while (true) {
    const manifests = await loadAllManifests()
    const readyRound = await loadReadyRound()
    if (readyRound) {
      const result = await handleReadyRound({
        rl,
        manifest: readyRound.manifest,
        winner: readyRound.winner,
        contextPaths,
      })
      if (result === 'quit') {
        await stopRunningRounds(await loadAllManifests())
        break
      }
      decisions = await loadDecisions()
      continue
    }

    const completedPromptIds = buildCompletedPromptIds(decisions)
    const blockedPromptIds = buildBlockedPromptIds(manifests)
    index = advanceIndex({
      prompts,
      startIndex: index,
      completedPromptIds,
      blockedPromptIds,
    })

    await writeState({
      currentIndex: index,
      updatedAt: new Date().toISOString(),
      completedPromptIds: [...completedPromptIds],
    })

    if (index >= prompts.length) {
      if (blockedPromptIds.size === 0) {
        break
      }

      const idleAction = await promptIdleAction(rl)
      if (idleAction && typeof idleAction === 'object' && 'manifest' in idleAction) {
        const result = await handleReadyRound({
          rl,
          manifest: idleAction.manifest,
          winner: idleAction.winner,
          contextPaths,
        })
        if (result === 'quit') {
          await stopRunningRounds(await loadAllManifests())
          break
        }
        decisions = await loadDecisions()
        continue
      }
      if (idleAction === 'quit') {
        await stopRunningRounds(await loadAllManifests())
        break
      }
      continue
    }

    const prompt = prompts[index]!
    console.log('')
    console.log(`[${index + 1}/${prompts.length}] ${prompt.title}`)
    console.log(`id: ${prompt.id}`)
    console.log('')
    console.log(prompt.prompt)

    const action = await promptSourceAction(rl)
    if (action && typeof action === 'object' && 'manifest' in action) {
      const result = await handleReadyRound({
        rl,
        manifest: action.manifest,
        winner: action.winner,
        contextPaths,
      })
      if (result === 'quit') {
        await stopRunningRounds(await loadAllManifests())
        break
      }
      decisions = await loadDecisions()
      continue
    }
    if (!action) {
      console.log('Unknown action.')
      continue
    }

    if (action === 'quit') {
      await stopRunningRounds(await loadAllManifests())
      break
    }

    if (action === 'keep' || action === 'remove' || action === 'skip') {
      await appendDecision({
        id: prompt.id,
        action,
        source: prompt.source,
        at: new Date().toISOString(),
      })
      decisions = await loadDecisions()
      index += 1
      continue
    }

    await launchRound({
      queuePromptId: prompt.id,
      prompt,
      mode: 'refine',
      feedback: action.feedback,
      contextPaths,
    })
    await appendDecision({
      id: prompt.id,
      action: 'refine-launched',
      source: prompt.source,
      feedback: action.feedback,
      at: new Date().toISOString(),
    })
    decisions = await loadDecisions()
    index += 1
  }

  rl.close()
  const finalDecisions = await loadDecisions()
  await writeState({
    currentIndex: index,
    updatedAt: new Date().toISOString(),
    completedPromptIds: [...buildCompletedPromptIds(finalDecisions)],
  })
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
