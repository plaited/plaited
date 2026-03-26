#!/usr/bin/env bun

import { join } from 'node:path'
import type { RoundManifest } from './modnet-pi-round-state.ts'
import type { ReviewPrompt, WorkflowMode } from './modnet-pi-workflow.ts'

type CandidateMss = {
  contentType: string
  structure: string
  mechanics: string[]
  boundary: string
  scale: number
}

type GeneratedCandidate = {
  title: string
  prompt: string
  mss: CandidateMss
  note: string
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

type RoundInput = {
  programPath: string
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

const roundDir = (reviewDir: string, promptId: string, roundNumber: number) =>
  join(reviewDir, 'artifacts', promptId, `round-${roundNumber.toString().padStart(2, '0')}`)

const roundManifestPath = (reviewDir: string, promptId: string, roundNumber: number) =>
  join(roundDir(reviewDir, promptId, roundNumber), 'round.json')

const roundWinnerPath = (reviewDir: string, promptId: string, roundNumber: number) =>
  join(roundDir(reviewDir, promptId, roundNumber), 'round-winner.json')

const workerWinnerPath = (reviewDir: string, promptId: string, roundNumber: number, workerIndex: number) =>
  join(roundDir(reviewDir, promptId, roundNumber), `worker-${workerIndex.toString().padStart(2, '0')}`, 'winner.json')

const workerInputPath = (reviewDir: string, promptId: string, roundNumber: number, workerIndex: number) =>
  join(roundDir(reviewDir, promptId, roundNumber), `worker-${workerIndex.toString().padStart(2, '0')}`, 'input.json')

const loadManifest = async (reviewDir: string, promptId: string, roundNumber: number): Promise<RoundManifest> =>
  (await Bun.file(roundManifestPath(reviewDir, promptId, roundNumber)).json()) as RoundManifest

const writeManifest = async (reviewDir: string, promptId: string, roundNumber: number, manifest: RoundManifest) => {
  await Bun.write(roundManifestPath(reviewDir, promptId, roundNumber), `${JSON.stringify(manifest, null, 2)}\n`)
}

const loadWorkerWinner = async (
  reviewDir: string,
  promptId: string,
  roundNumber: number,
  workerIndex: number,
): Promise<WorkerWinner | null> => {
  const path = workerWinnerPath(reviewDir, promptId, roundNumber, workerIndex)
  if (!(await Bun.file(path).exists())) {
    return null
  }
  return (await Bun.file(path).json()) as WorkerWinner
}

const main = async () => {
  const inputPath = Bun.argv[2]
  if (!inputPath) {
    console.error('Usage: bun scripts/modnet-pi-round.ts <input.json>')
    process.exit(1)
  }

  const input = (await Bun.file(inputPath).json()) as RoundInput
  const manifest = await loadManifest(input.reviewDir, input.prompt.id, input.roundNumber)

  await writeManifest(input.reviewDir, input.prompt.id, input.roundNumber, {
    ...manifest,
    status: 'running',
  })

  const workerIndices = Array.from({ length: input.strategyNotes.length }, (_, index) => index + 1)
  const procs: Array<ReturnType<typeof Bun.spawn>> = []

  const shutdownWorkers = () => {
    for (const proc of procs) {
      try {
        proc.kill()
      } catch {
        // ignore
      }
    }
  }

  process.on('SIGTERM', () => {
    shutdownWorkers()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    shutdownWorkers()
    process.exit(0)
  })

  for (const workerIndex of workerIndices) {
    const workerInput = {
      programPath: input.programPath,
      reviewDir: input.reviewDir,
      prompt: input.prompt,
      mode: input.mode,
      feedback: input.feedback,
      roundNumber: input.roundNumber,
      workerIndex,
      attemptsPerWorker: input.attemptsPerWorker,
      retryAttempts: input.retryAttempts,
      strategyNote: input.strategyNotes[workerIndex - 1]!,
      generatorModel: input.generatorModel,
      judgeModel: input.judgeModel,
    }

    await Bun.write(
      workerInputPath(input.reviewDir, input.prompt.id, input.roundNumber, workerIndex),
      JSON.stringify(workerInput, null, 2),
    )
    procs.push(
      Bun.spawn({
        cmd: [
          'bun',
          'scripts/modnet-pi-round-worker.ts',
          workerInputPath(input.reviewDir, input.prompt.id, input.roundNumber, workerIndex),
        ],
        stdin: 'ignore',
        stdout: 'ignore',
        stderr: 'ignore',
      }),
    )
  }

  await Promise.all(procs.map((proc) => proc.exited))

  const workerWinners = (
    await Promise.all(
      workerIndices.map((workerIndex) =>
        loadWorkerWinner(input.reviewDir, input.prompt.id, input.roundNumber, workerIndex),
      ),
    )
  ).filter((winner): winner is WorkerWinner => winner !== null)

  if (workerWinners.length === 0) {
    await writeManifest(input.reviewDir, input.prompt.id, input.roundNumber, {
      ...manifest,
      status: 'failed',
      error: 'No worker produced a valid candidate',
      completedAt: new Date().toISOString(),
    })
    process.exit(1)
  }

  const roundWinner = [...workerWinners].sort((a, b) => b.bestScore - a.bestScore)[0]!
  await Bun.write(
    roundWinnerPath(input.reviewDir, input.prompt.id, input.roundNumber),
    `${JSON.stringify(
      {
        queuePromptId: input.queuePromptId,
        promptId: input.prompt.id,
        roundNumber: input.roundNumber,
        mode: input.mode,
        feedback: input.feedback,
        sourcePrompt: input.prompt,
        roundWinner,
        workerWinners,
      },
      null,
      2,
    )}\n`,
  )

  await writeManifest(input.reviewDir, input.prompt.id, input.roundNumber, {
    ...manifest,
    status: 'completed',
    completedAt: new Date().toISOString(),
  })
}

if (import.meta.main) {
  main().catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
